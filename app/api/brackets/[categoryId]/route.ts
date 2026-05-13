import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, props: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await props.params;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT a.id, a.first_name, a.surname, a.club, a.grade, a.ekf_licence
      FROM comp_athletes a
      JOIN comp_registrations r ON r.athlete_id = a.id
      WHERE r.category_id = $1
      ORDER BY a.surname, a.first_name
    `, [categoryId]);
    return NextResponse.json(res.rows);
  } finally {
    client.release();
    await pool.end();
  }
}
