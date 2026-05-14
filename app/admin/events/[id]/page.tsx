import { notFound } from 'next/navigation';
import { Pool } from 'pg';
import EventAdminClient from './EventAdminClient';

export const dynamic = 'force-dynamic';

async function getData(eventId: number) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    // Ensure format column exists
    await client.query(`ALTER TABLE comp_categories ADD COLUMN IF NOT EXISTS format TEXT DEFAULT 'bracket'`);

    const evRes = await client.query('SELECT * FROM comp_events WHERE id=$1', [eventId]);
    if (evRes.rows.length === 0) return null;
    const event = evRes.rows[0];

    const catRes = await client.query(`
      SELECT c.*, COUNT(r.id)::int AS reg_count
      FROM comp_categories c
      LEFT JOIN comp_registrations r ON r.category_id = c.id
      WHERE c.event_id = $1
      GROUP BY c.id ORDER BY c.id
    `, [eventId]);

    const totalRegs = catRes.rows.reduce((s: number, c: any) => s + (c.reg_count || 0), 0);
    return { event, categories: catRes.rows, totalRegs };
  } finally {
    client.release();
    await pool.end();
  }
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = parseInt(id);
  const data = await getData(eventId);
  if (!data) return notFound();

  return (
    <EventAdminClient
      eventId={eventId}
      event={data.event}
      initialCategories={data.categories}
      totalRegs={data.totalRegs}
    />
  );
}
