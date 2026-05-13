import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { athletes } from '@/lib/db/schema';

export async function POST(req: Request) {
  try {
    const db = getDb();
    const { headers, rows, mapping } = await req.json();

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Map row to athlete fields
        const mapped: Record<string, string> = {};
        headers.forEach((header: string) => {
          const field = mapping[header];
          if (field && field !== 'skip') {
            mapped[field] = row[header] || '';
          }
        });

        // Validate required fields
        if (!mapped.firstName || !mapped.surname) {
          errors.push(`Row ${i + 2}: Missing first name or surname`);
          continue;
        }

        if (!mapped.dateOfBirth) {
          mapped.dateOfBirth = '1990-01-01'; // default
        }

        if (!mapped.club) {
          mapped.club = 'Unknown';
        }

        if (!mapped.grade) {
          mapped.grade = 'Unknown';
        }

        if (!mapped.gender) {
          mapped.gender = 'unknown';
        }

        await db.insert(athletes).values({
          firstName: mapped.firstName,
          surname: mapped.surname,
          dateOfBirth: mapped.dateOfBirth,
          club: mapped.club,
          grade: mapped.grade,
          weight: mapped.weight ? parseFloat(mapped.weight) : null,
          gender: mapped.gender.toLowerCase(),
          email: mapped.email || null,
          phone: mapped.phone || null,
          importedFrom: 'csv',
        });
        created++;
      } catch (e: unknown) {
        errors.push(`Row ${i + 2}: ${String(e).split('\n')[0]}`);
      }
    }

    return NextResponse.json({ created, updated, errors });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e), created: 0, updated: 0, errors: [String(e)] }, { status: 500 });
  }
}
