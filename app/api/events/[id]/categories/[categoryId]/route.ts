import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

// Ensure format column exists (idempotent migration)
async function ensureFormatColumn(client: any) {
  await client.query(`
    ALTER TABLE comp_categories
    ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'bracket'
  `);
}

// PATCH /api/events/[id]/categories/[categoryId]
// Body: { format: 'bracket' | 'wuko' }
export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string; categoryId: string }> }
) {
  const { id, categoryId } = await props.params;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await ensureFormatColumn(client);
    const body = await req.json();
    const format = body.format === 'wuko' ? 'wuko' : 'bracket';
    const result = await client.query(
      'UPDATE comp_categories SET format=$1 WHERE id=$2 AND event_id=$3 RETURNING *',
      [format, categoryId, id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ category: result.rows[0] });
  } finally {
    client.release();
    await pool.end();
  }
}
