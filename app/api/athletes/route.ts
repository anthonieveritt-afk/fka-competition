import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { athletes } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const db = getDb();
    const athleteList = await db.select().from(athletes).orderBy(desc(athletes.createdAt));
    return NextResponse.json({ athletes: athleteList });
  } catch (e: unknown) {
    return NextResponse.json({ athletes: [], error: String(e) });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();
    const [athlete] = await db.insert(athletes).values({
      firstName: body.firstName,
      surname: body.surname,
      dateOfBirth: body.dateOfBirth,
      club: body.club,
      grade: body.grade,
      weight: body.weight ? parseFloat(body.weight) : null,
      gender: body.gender,
      email: body.email || null,
      phone: body.phone || null,
      importedFrom: 'manual',
    }).returning();
    return NextResponse.json({ athlete });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
