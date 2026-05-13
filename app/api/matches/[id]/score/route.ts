import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { kumiteScores, matches, athletes, categories } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const { id } = await params;
    const matchId = parseInt(id);

    const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
    if (!match) return NextResponse.json({ score: null });

    const [scoreRow] = await db.select().from(kumiteScores).where(eq(kumiteScores.matchId, matchId));
    const [cat] = match.categoryId ? await db.select().from(categories).where(eq(categories.id, match.categoryId)) : [null];

    const redAthlete = match.redAthleteId ? (await db.select({ firstName: athletes.firstName, surname: athletes.surname }).from(athletes).where(eq(athletes.id, match.redAthleteId)))[0] : null;
    const blueAthlete = match.blueAthleteId ? (await db.select({ firstName: athletes.firstName, surname: athletes.surname }).from(athletes).where(eq(athletes.id, match.blueAthleteId)))[0] : null;

    const score = {
      matchId,
      redName: redAthlete ? redAthlete.surname.toUpperCase() : 'RED',
      blueName: blueAthlete ? blueAthlete.surname.toUpperCase() : 'BLUE',
      categoryName: cat?.name || '—',
      round: match.roundType,
      redYuko: scoreRow?.redYuko ?? 0,
      redWazaari: scoreRow?.redWazaari ?? 0,
      redIppon: scoreRow?.redIppon ?? 0,
      redPenalties: (scoreRow?.redPenalties as string[]) ?? [],
      blueYuko: scoreRow?.blueYuko ?? 0,
      blueWazaari: scoreRow?.blueWazaari ?? 0,
      blueIppon: scoreRow?.blueIppon ?? 0,
      bluePenalties: (scoreRow?.bluePenalties as string[]) ?? [],
      redTotal: scoreRow?.redTotal ?? 0,
      blueTotal: scoreRow?.blueTotal ?? 0,
      duration: 180,
      status: match.status,
    };

    return NextResponse.json({ score });
  } catch (e: unknown) {
    return NextResponse.json({ score: null, error: String(e) });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const { id } = await params;
    const matchId = parseInt(id);
    const body = await req.json();

    // Upsert score
    const [existing] = await db.select().from(kumiteScores).where(eq(kumiteScores.matchId, matchId));
    if (existing) {
      await db.update(kumiteScores).set({
        redYuko: body.redYuko ?? 0,
        redWazaari: body.redWazaari ?? 0,
        redIppon: body.redIppon ?? 0,
        redPenalties: body.redPenalties ?? [],
        blueYuko: body.blueYuko ?? 0,
        blueWazaari: body.blueWazaari ?? 0,
        blueIppon: body.blueIppon ?? 0,
        bluePenalties: body.bluePenalties ?? [],
        redTotal: body.redTotal ?? 0,
        blueTotal: body.blueTotal ?? 0,
        duration: body.duration ?? 0,
        updatedAt: new Date(),
      }).where(eq(kumiteScores.matchId, matchId));
    } else {
      await db.insert(kumiteScores).values({
        matchId,
        redYuko: body.redYuko ?? 0,
        redWazaari: body.redWazaari ?? 0,
        redIppon: body.redIppon ?? 0,
        redPenalties: body.redPenalties ?? [],
        blueYuko: body.blueYuko ?? 0,
        blueWazaari: body.blueWazaari ?? 0,
        blueIppon: body.blueIppon ?? 0,
        bluePenalties: body.bluePenalties ?? [],
        redTotal: body.redTotal ?? 0,
        blueTotal: body.blueTotal ?? 0,
        duration: body.duration ?? 0,
      });
    }

    // Update match to live
    await db.update(matches).set({ status: 'live' }).where(eq(matches.id, matchId));

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
