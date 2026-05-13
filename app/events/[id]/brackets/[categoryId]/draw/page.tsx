import { Pool } from 'pg';
import { notFound } from 'next/navigation';
import BracketDraw from './BracketDraw';

export const dynamic = 'force-dynamic';

async function getData(eventId: number, categoryId: number) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const evRes = await client.query('SELECT * FROM comp_events WHERE id=$1', [eventId]);
    const catRes = await client.query('SELECT * FROM comp_categories WHERE id=$1', [categoryId]);
    if (!evRes.rows[0] || !catRes.rows[0]) return null;
    const athRes = await client.query(`
      SELECT a.id, a.first_name, a.surname, a.club, a.grade, a.ekf_licence
      FROM comp_athletes a JOIN comp_registrations r ON r.athlete_id = a.id
      WHERE r.category_id=$1 AND r.event_id=$2 ORDER BY a.surname, a.first_name
    `, [categoryId, eventId]);
    return { event: evRes.rows[0], category: catRes.rows[0], athletes: athRes.rows };
  } finally { client.release(); await pool.end(); }
}

export default async function DrawPage({ params }: { params: Promise<{ id: string; categoryId: string }> }) {
  const { id, categoryId: catId } = await params;
  const data = await getData(parseInt(id), parseInt(catId));
  if (!data) return notFound();
  return (
    <BracketDraw
      event={data.event}
      category={data.category}
      initialAthletes={data.athletes}
      eventId={parseInt(id)}
      categoryId={parseInt(catId)}
    />
  );
}
