import { notFound } from 'next/navigation';
import { Pool } from 'pg';
import WukoScoring from './WukoScoring';

export const dynamic = 'force-dynamic';

export default async function WukoPage({ params }: { params: Promise<{ id: string; categoryId: string }> }) {
  const { id, categoryId } = await params;
  const eventId = parseInt(id);
  const catId = parseInt(categoryId);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const [evRes, catRes] = await Promise.all([
      client.query('SELECT * FROM comp_events WHERE id=$1', [eventId]),
      client.query('SELECT * FROM comp_categories WHERE id=$1 AND event_id=$2', [catId, eventId]),
    ]);
    if (!evRes.rows[0] || !catRes.rows[0]) return notFound();
    return (
      <WukoScoring
        event={evRes.rows[0]}
        category={catRes.rows[0]}
        eventId={eventId}
        categoryId={catId}
      />
    );
  } finally {
    client.release();
    await pool.end();
  }
}
