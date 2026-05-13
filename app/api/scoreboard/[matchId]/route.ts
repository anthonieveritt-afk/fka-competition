import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { matches, kumiteScores, athletes, categories } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, props: { params: Promise<{ matchId: string }> }) {
  try {
    const { matchId: matchIdStr } = await props.params; const matchId = parseInt(matchIdStr);
    if (isNaN(matchId)) return NextResponse.json({ error: 'Invalid match ID' }, { status: 400 });

    const db = getDb();

    const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    const [category] = await db.select().from(categories).where(eq(categories.id, match.categoryId)).limit(1);
    
    const redAthlete = match.redAthleteId
      ? (await db.select().from(athletes).where(eq(athletes.id, match.redAthleteId)).limit(1))[0]
      : null;
    const blueAthlete = match.blueAthleteId
      ? (await db.select().from(athletes).where(eq(athletes.id, match.blueAthleteId)).limit(1))[0]
      : null;

    const [scores] = await db.select().from(kumiteScores).where(eq(kumiteScores.matchId, matchId)).limit(1);

    const redPenalties = (scores?.redPenalties as string[]) ?? [];
    const bluePenalties = (scores?.bluePenalties as string[]) ?? [];

    // Calculate scores: Yuko=1, Waza-ari=2, Ippon=3
    const redScore = scores
      ? (scores.redYuko ?? 0) * 1 + (scores.redWazaari ?? 0) * 2 + (scores.redIppon ?? 0) * 3
      : 0;
    const blueScore = scores
      ? (scores.blueYuko ?? 0) * 1 + (scores.blueWazaari ?? 0) * 2 + (scores.blueIppon ?? 0) * 3
      : 0;

    // Duration stored in seconds, calculate remaining time
    // Default 3:00 for seniors, 2:00 for juniors (basic heuristic)
    const isJunior = category?.ageGroup?.includes('4-6') || category?.ageGroup?.includes('7-9') || category?.ageGroup?.includes('10-13');
    const totalTime = isJunior ? 120 : 180;
    const elapsed = scores?.duration ?? 0;
    const remaining = Math.max(0, totalTime - elapsed);

    return NextResponse.json({
      matchId,
      status: match.status,
      categoryName: category?.name ?? 'Unknown Category',
      tatami: match.tatami ?? 1,
      discipline: category?.discipline ?? 'kumite',
      aka: {
        name: redAthlete ? `${redAthlete.firstName} ${redAthlete.surname}` : 'TBD',
        club: redAthlete?.club ?? '',
        score: redScore,
        yuko: scores?.redYuko ?? 0,
        wazaari: scores?.redWazaari ?? 0,
        ippon: scores?.redIppon ?? 0,
        penalties: redPenalties,
      },
      ao: {
        name: blueAthlete ? `${blueAthlete.firstName} ${blueAthlete.surname}` : 'TBD',
        club: blueAthlete?.club ?? '',
        score: blueScore,
        yuko: scores?.blueYuko ?? 0,
        wazaari: scores?.blueWazaari ?? 0,
        ippon: scores?.blueIppon ?? 0,
        penalties: bluePenalties,
      },
      timer: remaining,
      senshu: (scores as any)?.senshu ?? null,
      timerRunning: match.status === 'live',
    });
  } catch (err) {
    console.error('Scoreboard API error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
