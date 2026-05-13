import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { matches, athletes, categories } from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const { id } = await params;
    const tatamiId = parseInt(id);

    const matchList = await db.select({
      id: matches.id,
      matchNumber: matches.matchNumber,
      roundType: matches.roundType,
      status: matches.status,
      redAthleteId: matches.redAthleteId,
      blueAthleteId: matches.blueAthleteId,
      categoryId: matches.categoryId,
      tatami: matches.tatami,
    }).from(matches).where(
      and(
        eq(matches.tatami, tatamiId),
        or(eq(matches.status, 'scheduled'), eq(matches.status, 'live'))
      )
    );

    // Enrich with names
    const allAthletes = await db.select({ id: athletes.id, firstName: athletes.firstName, surname: athletes.surname }).from(athletes);
    const allCategories = await db.select({ id: categories.id, name: categories.name }).from(categories);
    const athleteMap = Object.fromEntries(allAthletes.map(a => [a.id, a]));
    const categoryMap = Object.fromEntries(allCategories.map(c => [c.id, c]));

    const enriched = matchList.map(m => ({
      id: m.id,
      matchNumber: m.matchNumber,
      roundType: m.roundType,
      status: m.status,
      redName: m.redAthleteId ? athleteMap[m.redAthleteId]?.surname?.toUpperCase() || 'RED' : 'BYE',
      blueName: m.blueAthleteId ? athleteMap[m.blueAthleteId]?.surname?.toUpperCase() || 'BLUE' : 'BYE',
      categoryName: m.categoryId ? categoryMap[m.categoryId]?.name || '—' : '—',
    }));

    return NextResponse.json({ matches: enriched });
  } catch (e: unknown) {
    return NextResponse.json({ matches: [], error: String(e) });
  }
}
