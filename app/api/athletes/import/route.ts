import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { athletes, registrations, categories, events } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import * as XLSX from 'xlsx';

// FKA Template column mapping (0-indexed)
// A=0 Full Name, B=1 Age, C=2 DOB, D=3 Height, E=4 EKF Licence, F=5 Licence Expiry
// G-T = Events 1-12, U=20 Emergency Contact, V=21 Email
const EVENT_COLUMNS: Record<number, { name: string; discipline: string; ageGroup: string; gender: string }> = {
  6:  { name: 'Event 1: 4-6 Years Kata',          discipline: 'kata',     ageGroup: '4-6 Years',   gender: 'mixed' },
  7:  { name: 'Event 2: 4-6 Years Kumite',         discipline: 'kumite',   ageGroup: '4-6 Years',   gender: 'mixed' },
  8:  { name: 'Event 3: 4-6 Years Slam-Man',       discipline: 'slam_man', ageGroup: '4-6 Years',   gender: 'mixed' },
  9:  { name: 'Event 4: 7-9 Years Kata',           discipline: 'kata',     ageGroup: '7-9 Years',   gender: 'mixed' },
  10: { name: 'Event 5: 7-9 Years Kumite',         discipline: 'kumite',   ageGroup: '7-9 Years',   gender: 'mixed' },
  11: { name: 'Event 6: 7-9 Years Slam-Man',       discipline: 'slam_man', ageGroup: '7-9 Years',   gender: 'mixed' },
  12: { name: 'Event 7: 10-13 Years Kata',         discipline: 'kata',     ageGroup: '10-13 Years', gender: 'mixed' },
  13: { name: 'Event 8: 10-13 Years Kumite Boys',  discipline: 'kumite',   ageGroup: '10-13 Years', gender: 'male'  },
  14: { name: 'Event 8G: 10-13 Years Kumite Girls',discipline: 'kumite',   ageGroup: '10-13 Years', gender: 'female'},
  15: { name: 'Event 9: 10-13 Years Slam-Man',     discipline: 'slam_man', ageGroup: '10-13 Years', gender: 'mixed' },
  16: { name: 'Event 10: 14-19 Years Kata',        discipline: 'kata',     ageGroup: '14-19 Years', gender: 'mixed' },
  17: { name: 'Event 11: 14-18 Years Kumite Boys', discipline: 'kumite',   ageGroup: '14-18 Years', gender: 'male'  },
  18: { name: 'Event 11G: 14-18 Years Kumite Girls',discipline:'kumite',   ageGroup: '14-18 Years', gender: 'female'},
  19: { name: 'Event 12: Senior Open Weight Kumite',discipline:'kumite',   ageGroup: 'Senior',      gender: 'mixed' },
};

function isEntryMarked(val: unknown): boolean {
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return ['y', 'yes', 'x', '1', 'true', '✓', '✔', 'entered', 'yes please'].includes(s);
}

function parseFullName(name: string): { firstName: string; surname: string } {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return { firstName: parts[0], surname: '' };
  const surname = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(' ');
  return { firstName, surname };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const eventId = formData.get('eventId') as string | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];

    // Skip header row
    const dataRows = rows.slice(1).filter(row => row[0] && String(row[0]).trim());

    const db = getDb();
    const results = { created: 0, updated: 0, registered: 0, errors: [] as string[] };

    // Get or create categories for the event if eventId provided
    const categoryCache: Record<string, number> = {};
    
    const ensureCategory = async (evtId: number, colIdx: number): Promise<number | null> => {
      const evtDef = EVENT_COLUMNS[colIdx];
      if (!evtDef) return null;
      const key = `${evtId}-${colIdx}`;
      if (categoryCache[key]) return categoryCache[key];

      const existing = await db.select().from(categories)
        .where(and(eq(categories.eventId, evtId), eq(categories.name, evtDef.name)))
        .limit(1);
      
      if (existing.length > 0) {
        categoryCache[key] = existing[0].id;
        return existing[0].id;
      }

      const [created] = await db.insert(categories).values({
        eventId: evtId,
        name: evtDef.name,
        discipline: evtDef.discipline,
        gender: evtDef.gender,
        ageGroup: evtDef.ageGroup,
      }).returning();
      categoryCache[key] = created.id;
      return created.id;
    };

    for (const row of dataRows) {
      try {
        const fullName = String(row[0] || '').trim();
        if (!fullName) continue;

        const { firstName, surname } = parseFullName(fullName);
        const dob = row[2] ? String(row[2]).trim() : null;
        const heightCm = row[3] ? parseFloat(String(row[3])) : null;
        const ekfLicence = row[4] ? String(row[4]).trim() : null;
        const licenceExpiry = row[5] ? String(row[5]).trim() : null;
        const emergencyContact = row[20] ? String(row[20]).trim() : null;
        const email = row[21] ? String(row[21]).trim() : null;

        // Upsert athlete by EKF licence or name
        let athleteId: number;
        
        const existingQuery = ekfLicence
          ? await db.select().from(athletes).where(eq(athletes.ekfLicence, ekfLicence)).limit(1)
          : await db.select().from(athletes)
              .where(and(eq(athletes.firstName, firstName), eq(athletes.surname, surname)))
              .limit(1);

        if (existingQuery.length > 0) {
          await db.update(athletes).set({
            firstName, surname, dateOfBirth: dob ?? undefined,
            heightCm: heightCm ?? undefined, ekfLicence: ekfLicence ?? undefined,
            licenceExpiry: licenceExpiry ?? undefined, emergencyContact: emergencyContact ?? undefined,
            email: email ?? undefined, importedFrom: 'csv',
          }).where(eq(athletes.id, existingQuery[0].id));
          athleteId = existingQuery[0].id;
          results.updated++;
        } else {
          const [newAthlete] = await db.insert(athletes).values({
            firstName, surname, dateOfBirth: dob ?? undefined,
            club: 'Imported', heightCm: heightCm ?? undefined,
            ekfLicence: ekfLicence ?? undefined, licenceExpiry: licenceExpiry ?? undefined,
            emergencyContact: emergencyContact ?? undefined, email: email ?? undefined,
            importedFrom: 'csv',
          }).returning();
          athleteId = newAthlete.id;
          results.created++;
        }

        // Register for events if eventId provided
        if (eventId) {
          const evtId = parseInt(eventId);
          for (const [colIdxStr, evtDef] of Object.entries(EVENT_COLUMNS)) {
            const colIdx = parseInt(colIdxStr);
            if (isEntryMarked(row[colIdx])) {
              const catId = await ensureCategory(evtId, colIdx);
              if (catId) {
                // Check if already registered
                const existing = await db.select().from(registrations)
                  .where(and(
                    eq(registrations.athleteId, athleteId),
                    eq(registrations.categoryId, catId)
                  )).limit(1);
                
                if (existing.length === 0) {
                  await db.insert(registrations).values({
                    athleteId, eventId: evtId, categoryId: catId, status: 'confirmed',
                  });
                  results.registered++;
                }
              }
            }
          }
        }
      } catch (rowErr) {
        results.errors.push(`Row "${row[0]}": ${rowErr instanceof Error ? rowErr.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      summary: `${results.created} athletes created, ${results.updated} updated, ${results.registered} event entries added.`,
      ...results,
    });
  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Import failed' }, { status: 500 });
  }
}
