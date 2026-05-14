import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

async function ensureTables(client: any) {
  await client.query(`
    ALTER TABLE comp_categories
    ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'bracket'
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS comp_wuko_scores (
      id SERIAL PRIMARY KEY,
      category_id INTEGER NOT NULL REFERENCES comp_categories(id),
      event_id INTEGER NOT NULL REFERENCES comp_events(id),
      athlete_id INTEGER NOT NULL REFERENCES comp_athletes(id),
      round TEXT NOT NULL DEFAULT 'prelim',
      j1 REAL,
      j2 REAL,
      j3 REAL,
      j4 REAL,
      total REAL,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(category_id, athlete_id, round)
    )
  `);
}

// GET /api/wuko-scores/[categoryId]?eventId=x
export async function GET(
  req: NextRequest,
  props: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await props.params;
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('eventId');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await ensureTables(client);

    // Fetch athletes registered in this category
    const athRes = await client.query(`
      SELECT a.id, a.first_name, a.surname, a.club
      FROM comp_athletes a
      JOIN comp_registrations r ON r.athlete_id = a.id
      WHERE r.category_id = $1 AND r.event_id = $2
      ORDER BY a.surname, a.first_name
    `, [categoryId, eventId]);

    // Fetch existing scores
    const scoreRes = await client.query(`
      SELECT * FROM comp_wuko_scores
      WHERE category_id = $1 AND event_id = $2
    `, [categoryId, eventId]);

    const scoreMap: Record<string, any> = {};
    scoreRes.rows.forEach((s: any) => {
      scoreMap[`${s.athlete_id}_${s.round}`] = s;
    });

    return NextResponse.json({
      athletes: athRes.rows,
      scores: scoreRes.rows,
      scoreMap,
    });
  } finally {
    client.release();
    await pool.end();
  }
}

// POST /api/wuko-scores/[categoryId]
// Body: { eventId, athleteId, round, j1, j2, j3, j4 }
export async function POST(
  req: NextRequest,
  props: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await props.params;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await ensureTables(client);
    const body = await req.json();
    const { eventId, athleteId, round, j1, j2, j3, j4 } = body;

    // Calculate total: sort 4 scores, drop min and max, sum middle 2
    const vals = [j1, j2, j3, j4].map(Number).filter(n => !isNaN(n) && n >= 5 && n <= 9.9);
    let total: number | null = null;
    if (vals.length === 4) {
      const sorted = [...vals].sort((a, b) => a - b);
      total = Math.round((sorted[1] + sorted[2]) * 100) / 100;
    }

    const result = await client.query(`
      INSERT INTO comp_wuko_scores (category_id, event_id, athlete_id, round, j1, j2, j3, j4, total, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (category_id, athlete_id, round)
      DO UPDATE SET j1=$5, j2=$6, j3=$7, j4=$8, total=$9, updated_at=NOW()
      RETURNING *
    `, [categoryId, eventId, athleteId, round, j1 ?? null, j2 ?? null, j3 ?? null, j4 ?? null, total]);

    return NextResponse.json({ score: result.rows[0] });
  } finally {
    client.release();
    await pool.end();
  }
}
