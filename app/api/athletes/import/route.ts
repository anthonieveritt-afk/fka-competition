import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { athletes, registrations, categories } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import * as XLSX from 'xlsx';

// Raise Next.js body size limit for large uploads
export const maxDuration = 60; // 60s timeout for large imports

// FKA Template column mapping (0-indexed)
const EVENT_COLUMNS: Record<number, { name: string; discipline: string; ageGroup: string; gender: string }> = {
  6:  { name: 'Event 1: 4-6 Years Kata',            discipline: 'kata',     ageGroup: '4-6 Years',   gender: 'mixed'  },
  7:  { name: 'Event 2: 4-6 Years Kumite',           discipline: 'kumite',   ageGroup: '4-6 Years',   gender: 'mixed'  },
  8:  { name: 'Event 3: 4-6 Years Slam-Man',         discipline: 'slam_man', ageGroup: '4-6 Years',   gender: 'mixed'  },
  9:  { name: 'Event 4: 7-9 Years Kata',             discipline: 'kata',     ageGroup: '7-9 Years',   gender: 'mixed'  },
  10: { name: 'Event 5: 7-9 Years Kumite',           discipline: 'kumite',   ageGroup: '7-9 Years',   gender: 'mixed'  },
  11: { name: 'Event 6: 7-9 Years Slam-Man',         discipline: 'slam_man', ageGroup: '7-9 Years',   gender: 'mixed'  },
  12: { name: 'Event 7: 10-13 Years Kata',           discipline: 'kata',     ageGroup: '10-13 Years', gender: 'mixed'  },
  13: { name: 'Event 8: 10-13 Years Kumite Boys',    discipline: 'kumite',   ageGroup: '10-13 Years', gender: 'male'   },
  14: { name: 'Event 8G: 10-13 Years Kumite Girls',  discipline: 'kumite',   ageGroup: '10-13 Years', gender: 'female' },
  15: { name: 'Event 9: 10-13 Years Slam-Man',       discipline: 'slam_man', ageGroup: '10-13 Years', gender: 'mixed'  },
  16: { name: 'Event 10: 14-19 Years Kata',          discipline: 'kata',     ageGroup: '14-19 Years', gender: 'mixed'  },
  17: { name: 'Event 11: 14-18 Years Kumite Boys',   discipline: 'kumite',   ageGroup: '14-18 Years', gender: 'male'   },
  18: { name: 'Event 11G: 14-18 Years Kumite Girls', discipline: 'kumite',   ageGroup: '14-18 Years', gender: 'female' },
  19: { name: 'Event 12: Senior Open Weight Kumite', discipline: 'kumite',   ageGroup: 'Senior',      gender: 'mixed'  },
};

function isEntryMarked(val: unknown): boolean {
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return ['y', 'yes', 'x', '1', 'true', '✓', '✔', 'entered', 'yes please'].includes(s);
}

function parseFullName(name: string): { firstName: string; surname: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], surname: '' };
  return { firstName: parts.slice(0, -1).join(' '), surname: parts[parts.length - 1] };
}

// Process in chunks to avoid DB connection timeouts on large imports
async function processBatch<T>(items: T[], batchSize: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += batchSize) {
    await Promise.all(items.slice(i, i + batchSize).map(fn));
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const eventId = formData.get('eventId') as string | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // Parse workbook
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];

    // Skip header, filter empty rows, cap at 1000
    const dataRows = rows.slice(1)
      .filter(row => row[0] && String(row[0]).trim())
      .slice(0, 1000);

    const db = getDb();
    const results = { created: 0, updated: 0, registered: 0, skipped: 0, errors: [] as string[] };

    // Pre-build category cache for the event
    const categoryCache: Record<number, number> = {}; // colIdx → categoryId

    if (eventId) {
      const evtId = parseInt(eventId);
      const existingCats = await db.select().from(categories).where(eq(categories.eventId, evtId));
      const existingMap = new Map(existingCats.map(c => [c.name, c.id]));

      // Ensure all 14 event categories exist for this event
      for (const [colIdxStr, evtDef] of Object.entries(EVENT_COLUMNS)) {
        const colIdx = parseInt(colIdxStr);
        if (existingMap.has(evtDef.name)) {
          categoryCache[colIdx] = existingMap.get(evtDef.name)!;
        } else {
          const [created] = await db.insert(categories).values({
            eventId: evtId, name: evtDef.name, discipline: evtDef.discipline,
            gender: evtDef.gender, ageGroup: evtDef.ageGroup,
          }).returning();
          categoryCache[colIdx] = created.id;
        }
      }
    }

    // Process athletes in parallel batches of 20
    await processBatch(dataRows, 20, async (row) => {
      try {
        const fullName = String(row[0] || '').trim();
        if (!fullName) return;

        const { firstName, surname } = parseFullName(fullName);
        const dob = row[2] ? String(row[2]).trim() : null;
        const heightCm = row[3] ? parseFloat(String(row[3])) : null;
        const ekfLicence = row[4] ? String(row[4]).trim() : null;
        const licenceExpiry = row[5] ? String(row[5]).trim() : null;
        const emergencyContact = row[20] ? String(row[20]).trim() : null;
        const email = row[21] ? String(row[21]).trim() : null;

        // Upsert athlete
        let athleteId: number;
        const existing = ekfLicence
          ? await db.select({ id: athletes.id }).from(athletes).where(eq(athletes.ekfLicence, ekfLicence)).limit(1)
          : await db.select({ id: athletes.id }).from(athletes)
              .where(and(eq(athletes.firstName, firstName), eq(athletes.surname, surname))).limit(1);

        if (existing.length > 0) {
          await db.update(athletes).set({
            firstName, surname,
            ...(dob && { dateOfBirth: dob }),
            ...(heightCm && { heightCm }),
            ...(ekfLicence && { ekfLicence }),
            ...(licenceExpiry && { licenceExpiry }),
            ...(emergencyContact && { emergencyContact }),
            ...(email && { email }),
            importedFrom: 'csv',
          }).where(eq(athletes.id, existing[0].id));
          athleteId = existing[0].id;
          results.updated++;
        } else {
          const [newAthlete] = await db.insert(athletes).values({
            firstName, surname, club: 'Imported', importedFrom: 'csv',
            ...(dob && { dateOfBirth: dob }),
            ...(heightCm && { heightCm }),
            ...(ekfLicence && { ekfLicence }),
            ...(licenceExpiry && { licenceExpiry }),
            ...(emergencyContact && { emergencyContact }),
            ...(email && { email }),
          }).returning();
          athleteId = newAthlete.id;
          results.created++;
        }

        // Register for ticked events
        if (eventId) {
          const evtId = parseInt(eventId);
          const enteredCatIds = Object.entries(EVENT_COLUMNS)
            .filter(([colIdxStr]) => isEntryMarked(row[parseInt(colIdxStr)]))
            .map(([colIdxStr]) => categoryCache[parseInt(colIdxStr)])
            .filter(Boolean);

          if (enteredCatIds.length > 0) {
            // Check existing registrations in one query
            const alreadyRegistered = await db.select({ categoryId: registrations.categoryId })
              .from(registrations)
              .where(and(eq(registrations.athleteId, athleteId), inArray(registrations.categoryId, enteredCatIds)));
            const alreadySet = new Set(alreadyRegistered.map(r => r.categoryId));

            const newRegs = enteredCatIds
              .filter(catId => !alreadySet.has(catId))
              .map(catId => ({ athleteId, eventId: evtId, categoryId: catId, status: 'confirmed' as const }));

            if (newRegs.length > 0) {
              await db.insert(registrations).values(newRegs);
              results.registered += newRegs.length;
            }
          }
        }
      } catch (rowErr) {
        results.errors.push(`"${row[0]}": ${rowErr instanceof Error ? rowErr.message : 'error'}`);
      }
    });

    return NextResponse.json({
      success: true,
      summary: `${results.created} athletes created, ${results.updated} updated, ${results.registered} event entries added${results.errors.length ? `, ${results.errors.length} errors` : ''}.`,
      total: dataRows.length,
      ...results,
    });
  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Import failed' }, { status: 500 });
  }
}
