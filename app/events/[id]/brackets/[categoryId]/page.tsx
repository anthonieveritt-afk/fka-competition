import { Pool } from 'pg';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import PrintBracketButton from './PrintBracketButton';

export const dynamic = 'force-dynamic';

async function getData(eventId: number, categoryId: number) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const evRes = await client.query('SELECT * FROM comp_events WHERE id=$1', [eventId]);
    const catRes = await client.query('SELECT * FROM comp_categories WHERE id=$1', [categoryId]);
    if (!evRes.rows[0] || !catRes.rows[0]) return null;

    const athleteRes = await client.query(`
      SELECT a.id, a.first_name, a.surname, a.club, a.grade, a.ekf_licence, a.date_of_birth
      FROM comp_athletes a
      JOIN comp_registrations r ON r.athlete_id = a.id
      WHERE r.category_id = $1 AND r.event_id = $2
      ORDER BY a.surname, a.first_name
    `, [categoryId, eventId]);

    return {
      event: evRes.rows[0],
      category: catRes.rows[0],
      athletes: athleteRes.rows,
    };
  } finally {
    client.release();
    await pool.end();
  }
}

export default async function BracketPage({
  params, searchParams
}: {
  params: Promise<{ id: string; categoryId: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id, categoryId: catIdStr } = await params;
  const sp = await searchParams;
  const isPrint = sp.print === '1';

  const eventId = parseInt(id);
  const categoryId = parseInt(catIdStr);
  const data = await getData(eventId, categoryId);
  if (!data) return notFound();

  const { event, category, athletes } = data;

  const disciplineLabel: Record<string, string> = { kumite: 'Kumite', kata: 'Kata', slam_man: 'Slam-Man' };

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .bracket-card { border: 1px solid #ccc !important; background: white !important; }
          .athlete-row { border-bottom: 1px solid #eee !important; color: black !important; }
          .header-section { color: black !important; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 6px 10px; border-bottom: 1px solid #eee; font-size: 12px; }
          .score-box { border: 1px solid #ccc; min-width: 40px; height: 24px; display: inline-block; }
        }
      `}</style>

      {isPrint && <PrintBracketButton />}

      <div style={{ padding: isPrint ? '20px' : '32px 24px', minHeight: '100vh', background: isPrint ? 'white' : '#0a0a0a' }}>

        {/* Nav (hidden on print) */}
        <div className="no-print" style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href={`/admin/events/${eventId}`} style={{ color: '#0066cc', fontSize: 13, textDecoration: 'none' }}>← Back to Event</Link>
          <Link href={`/events/${eventId}/brackets/${categoryId}?print=1`} target="_blank" style={{
            background: '#141414', color: '#f5f5f5', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none', marginLeft: 'auto',
          }}>🖨 Print this bracket</Link>
        </div>

        {/* Header */}
        <div className="header-section" style={{ marginBottom: 24, borderBottom: isPrint ? '2px solid #000' : '1px solid rgba(255,255,255,0.08)', paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: isPrint ? 11 : 12, fontWeight: 700, color: isPrint ? '#333' : '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
              {event.name} · {event.date}
            </span>
          </div>
          <h1 style={{ fontSize: isPrint ? 22 : 26, fontWeight: 900, color: isPrint ? '#000' : '#f5f5f5', margin: '4px 0' }}>
            {category.name}
          </h1>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
              background: isPrint ? '#eee' : 'rgba(255,255,255,0.08)',
              color: isPrint ? '#333' : '#f5f5f5',
            }}>
              {disciplineLabel[category.discipline] ?? category.discipline}
            </span>
            <span style={{ fontSize: 13, color: isPrint ? '#555' : '#888' }}>
              {category.age_group} · {category.gender}
              {category.belt_range ? ` · ${category.belt_range}` : ''}
              {category.weight_class ? ` · ${category.weight_class}` : ''}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: isPrint ? '#000' : '#f5f5f5' }}>
              {athletes.length} athlete{athletes.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {athletes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#555' }}>
            No athletes registered in this category.
          </div>
        ) : (
          <>
            {/* Entry list / draw */}
            <div className="bracket-card" style={{
              background: isPrint ? 'white' : '#141414',
              borderRadius: isPrint ? 0 : 12,
              border: isPrint ? 'none' : '1px solid rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: isPrint ? '#f5f5f5' : '#1a1a1a' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: isPrint ? 11 : 12, fontWeight: 700, color: isPrint ? '#333' : '#888', textTransform: 'uppercase', letterSpacing: 1 }}>#</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: isPrint ? 11 : 12, fontWeight: 700, color: isPrint ? '#333' : '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Athlete</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: isPrint ? 11 : 12, fontWeight: 700, color: isPrint ? '#333' : '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Club</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: isPrint ? 11 : 12, fontWeight: 700, color: isPrint ? '#333' : '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Grade</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: isPrint ? 11 : 12, fontWeight: 700, color: isPrint ? '#333' : '#888', textTransform: 'uppercase', letterSpacing: 1 }}>EKF Licence</th>
                    {isPrint && (
                      <>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#333', textTransform: 'uppercase' }}>Round 1</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#333', textTransform: 'uppercase' }}>Round 2</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#333', textTransform: 'uppercase' }}>Final</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#333', textTransform: 'uppercase' }}>Place</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {athletes.map((a: any, idx: number) => (
                    <tr key={a.id} className="athlete-row" style={{
                      borderBottom: `1px solid ${isPrint ? '#eee' : 'rgba(255,255,255,0.04)'}`,
                      background: isPrint ? (idx % 2 === 0 ? 'white' : '#fafafa') : 'transparent',
                    }}>
                      <td style={{ padding: '10px 14px', color: isPrint ? '#333' : '#888', fontSize: 14, fontWeight: 700 }}>{idx + 1}</td>
                      <td style={{ padding: '10px 14px', color: isPrint ? '#000' : '#f5f5f5', fontWeight: 700, fontSize: 14 }}>
                        {a.first_name} {a.surname}
                      </td>
                      <td style={{ padding: '10px 14px', color: isPrint ? '#333' : '#aaa', fontSize: 14 }}>{a.club}</td>
                      <td style={{ padding: '10px 14px', color: isPrint ? '#333' : '#aaa', fontSize: 14 }}>{a.grade ?? '—'}</td>
                      <td style={{ padding: '10px 14px', color: isPrint ? '#333' : '#aaa', fontSize: 13 }}>{a.ekf_licence ?? '—'}</td>
                      {isPrint && (
                        <>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}><span className="score-box" style={{ border: '1px solid #ccc', minWidth: 40, height: 24, display: 'inline-block' }}></span></td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}><span className="score-box" style={{ border: '1px solid #ccc', minWidth: 40, height: 24, display: 'inline-block' }}></span></td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}><span className="score-box" style={{ border: '1px solid #ccc', minWidth: 40, height: 24, display: 'inline-block' }}></span></td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}><span className="score-box" style={{ border: '1px solid #ccc', minWidth: 40, height: 24, display: 'inline-block' }}></span></td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isPrint && (
              <div style={{ marginTop: 24, fontSize: 11, color: '#999', borderTop: '1px solid #eee', paddingTop: 12 }}>
                {event.name} · Printed {new Date().toLocaleDateString('en-GB')} · {athletes.length} athletes
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
