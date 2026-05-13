import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { matches } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const { id } = await params;
    const matchId = parseInt(id);
    const body = await req.json();

    const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    let winnerId: number | null = null;
    if (body.winnerId === 'red') winnerId = match.redAthleteId;
    else if (body.winnerId === 'blue') winnerId = match.blueAthleteId;
    else if (typeof body.winnerId === 'number') winnerId = body.winnerId;

    await db.update(matches).set({
      status: 'complete',
      winnerId,
      method: body.method || 'score',
    }).where(eq(matches.id, matchId));

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
