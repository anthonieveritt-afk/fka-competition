import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { kumiteScores, matches } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type Action =
  | { type: 'timer'; action: 'start' | 'stop' | 'reset'; totalSeconds?: number }
  | { type: 'points'; side: 'red' | 'blue'; points: 1 | 2 | 3; undo?: boolean }
  | { type: 'penalty'; side: 'red' | 'blue'; penalty: string; remove?: boolean }
  | { type: 'senshu'; side: 'red' | 'blue' | null }
  | { type: 'end_match'; winnerId?: number };

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const matchId = parseInt(id);
    if (isNaN(matchId)) return NextResponse.json({ error: 'Invalid match ID' }, { status: 400 });

    const body: Action = await req.json();
    const db = getDb();

    // Get or create score record
    let [score] = await db.select().from(kumiteScores).where(eq(kumiteScores.matchId, matchId)).limit(1);
    if (!score) {
      const [created] = await db.insert(kumiteScores).values({
        matchId, redYuko: 0, redWazaari: 0, redIppon: 0, blueYuko: 0, blueWazaari: 0, blueIppon: 0,
        redTotal: 0, blueTotal: 0, redPenalties: [], bluePenalties: [], timerElapsed: 0,
      } as any).returning();
      score = created;
    }

    const now = new Date();

    if (body.type === 'timer') {
      if (body.action === 'start' && !(score as any).timerRunning) {
        await db.execute(`
          UPDATE comp_kumite_scores
          SET timer_running = TRUE, timer_started_at = NOW(), updated_at = NOW()
          WHERE match_id = ${matchId}
        `);
        // Also set match to live
        await db.update(matches).set({ status: 'live' }).where(eq(matches.id, matchId));
      } else if (body.action === 'stop' && (score as any).timerRunning) {
        // Calculate elapsed so far
        await db.execute(`
          UPDATE comp_kumite_scores
          SET timer_running = FALSE,
              timer_elapsed = COALESCE(timer_elapsed, 0) + EXTRACT(EPOCH FROM (NOW() - timer_started_at))::INTEGER,
              timer_started_at = NULL,
              updated_at = NOW()
          WHERE match_id = ${matchId}
        `);
      } else if (body.action === 'reset') {
        await db.execute(`
          UPDATE comp_kumite_scores
          SET timer_running = FALSE, timer_started_at = NULL, timer_elapsed = 0, updated_at = NOW()
          WHERE match_id = ${matchId}
        `);
      }
    }

    else if (body.type === 'points') {
      const col = body.side === 'red'
        ? (body.points === 1 ? 'red_yuko' : body.points === 2 ? 'red_wazaari' : 'red_ippon')
        : (body.points === 1 ? 'blue_yuko' : body.points === 2 ? 'blue_wazaari' : 'blue_ippon');
      const delta = body.undo ? -1 : 1;
      await db.execute(`
        UPDATE comp_kumite_scores
        SET ${col} = GREATEST(0, COALESCE(${col}, 0) + ${delta}), updated_at = NOW()
        WHERE match_id = ${matchId}
      `);
    }

    else if (body.type === 'penalty') {
      const col = body.side === 'red' ? 'red_penalties' : 'blue_penalties';
      const currentPenalties = body.side === 'red'
        ? ((score as any).redPenalties ?? []) as string[]
        : ((score as any).bluePenalties ?? []) as string[];

      let newPenalties: string[];
      if (body.remove) {
        // Remove last occurrence of this penalty
        const idx = currentPenalties.lastIndexOf(body.penalty);
        newPenalties = idx >= 0 ? [...currentPenalties.slice(0, idx), ...currentPenalties.slice(idx + 1)] : currentPenalties;
      } else {
        newPenalties = [...currentPenalties, body.penalty];
      }
      await db.execute(`
        UPDATE comp_kumite_scores
        SET ${col} = '${JSON.stringify(newPenalties)}'::jsonb, updated_at = NOW()
        WHERE match_id = ${matchId}
      `);
    }

    else if (body.type === 'senshu') {
      const val = body.side === null ? 'NULL' : `'${body.side}'`;
      await db.execute(`
        UPDATE comp_kumite_scores SET senshu = ${val}, updated_at = NOW()
        WHERE match_id = ${matchId}
      `);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Control error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
