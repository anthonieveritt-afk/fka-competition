import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

async function getPool() { return new Pool({ connectionString: process.env.DATABASE_URL }); }

export async function GET(_req: NextRequest, props: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await props.params;
  const pool = await getPool(); const client = await pool.connect();
  try {
    const url = new URL(_req.url);
    const eventId = url.searchParams.get('eventId') ?? '1';
    const res = await client.query(
      'SELECT bracket_json, locked FROM comp_bracket_state WHERE category_id=$1 AND event_id=$2',
      [categoryId, eventId]
    );
    if (res.rows.length === 0) return NextResponse.json({ state: null });
    return NextResponse.json({ state: res.rows[0].bracket_json, locked: res.rows[0].locked });
  } finally { client.release(); await pool.end(); }
}

export async function POST(req: NextRequest, props: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await props.params;
  const body = await req.json();
  const { eventId, state, locked, logWinners } = body;
  const pool = await getPool(); const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO comp_bracket_state (event_id, category_id, bracket_json, locked, updated_at)
      VALUES ($1,$2,$3,$4,NOW())
      ON CONFLICT (event_id, category_id) DO UPDATE SET bracket_json=$3, locked=$4, updated_at=NOW()
    `, [eventId, categoryId, JSON.stringify(state), locked ?? false]);

    // Log final winners to competition_results and update seed scores
    if (logWinners && state?.results) {
      for (const r of state.results) {
        if (!r.athleteId) continue;
        await client.query(`
          INSERT INTO comp_competition_results (athlete_id, event_id, event_name, event_date, category_name, position, medal)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT DO NOTHING
        `, [r.athleteId, eventId, r.eventName, r.eventDate, r.categoryName, r.position, r.medal]);
        // Update seed score: 1st=100, 2nd=60, 3rd=40
        const boost = r.position === 1 ? 100 : r.position === 2 ? 60 : r.position <= 4 ? 40 : 10;
        await client.query('UPDATE comp_athletes SET seed_score = seed_score + $1 WHERE id=$2', [boost, r.athleteId]);
      }
    }
    return NextResponse.json({ ok: true });
  } finally { client.release(); await pool.end(); }
}
