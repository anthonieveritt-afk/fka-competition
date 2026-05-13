import { Pool } from 'pg';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const MATCH_MINS: Record<string, number> = { kata: 2.5, kumite: 2.5, slam_man: 1.5 };
const BREAK_MINS = 5;
const START_HOUR = 14;
const START_MIN = 30;

function fmtTime(totalMins: number) {
  const h = Math.floor(totalMins / 60);
  const m = Math.round(totalMins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const DISC_LABEL: Record<string, string> = { kata: 'Kata', kumite: 'Kumite', slam_man: 'Slam-Man' };
const DISC_COLOUR: Record<string, string> = { kata: '#0066cc', kumite: '#C8161A', slam_man: '#f59e0b' };

export default async function TimetablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const evRes = await client.query('SELECT * FROM comp_events WHERE id=$1', [id]);
    if (!evRes.rows[0]) return notFound();
    const event = evRes.rows[0];

    const catRes = await client.query(`
      SELECT c.id, c.name, c.discipline, c.age_group, c.gender,
             COUNT(r.id)::int AS athlete_count
      FROM comp_categories c
      LEFT JOIN comp_registrations r ON r.category_id = c.id
      WHERE c.event_id = $1
      GROUP BY c.id ORDER BY c.id
    `, [id]);

    const categories = catRes.rows;

    // Build timetable
    let current = START_HOUR * 60 + START_MIN;
    const rows: any[] = [];
    let totalMatches = 0;

    categories.forEach((c: any) => {
      const matches = Math.max(0, c.athlete_count - 1);
      const dur = Math.ceil(matches * (MATCH_MINS[c.discipline] ?? 2.5));
      const start = current;
      const end = current + dur;
      rows.push({ ...c, matches, dur, start: fmtTime(start), end: fmtTime(end), startMins: start });
      totalMatches += matches;
      current = end + (dur > 0 ? BREAK_MINS : 2);
    });

    const finish = fmtTime(current - (rows[rows.length - 1]?.dur > 0 ? BREAK_MINS : 2));
    const totalDurH = Math.floor((current - START_HOUR * 60 - START_MIN) / 60);
    const totalDurM = Math.round((current - START_HOUR * 60 - START_MIN) % 60);

    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', padding: '32px 24px', fontFamily: 'system-ui, sans-serif' }}>
        <style>{`
          @media print {
            body { background: white !important; color: black !important; }
            .no-print { display: none !important; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { size: A4 portrait; margin: 10mm; }
          }
        `}</style>

        {/* Header */}
        <div className="no-print" style={{ marginBottom: 24 }}>
          <Link href={`/admin/events/${id}`} style={{ color: '#0066cc', fontSize: 13, textDecoration: 'none' }}>← Event</Link>
        </div>

        {/* Print header */}
        <div style={{ background: '#1A1A8C', color: '#fff', padding: '12px 20px', borderRadius: 4, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{event.name}</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{event.location} · {event.date}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Event Timetable</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Start: {fmtTime(START_HOUR * 60 + START_MIN)} · Est. finish: {finish}</div>
          </div>
        </div>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Events', val: categories.length },
            { label: 'Total athletes', val: categories.reduce((s: number, c: any) => s + c.athlete_count, 0) },
            { label: 'Total matches', val: totalMatches },
            { label: 'Est. duration', val: `${totalDurH}h ${totalDurM}m` },
          ].map(({ label, val }) => (
            <div key={label} style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 16, textAlign: 'center' }}>
              <div style={{ color: '#f5f5f5', fontSize: 22, fontWeight: 900 }}>{val}</div>
              <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Warning if long day */}
        {totalDurH >= 6 && (
          <div style={{ background: '#1a1200', border: '1px solid #f59e0b44', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div>
              <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 14 }}>Long event day — {totalDurH}h {totalDurM}m on one tatami</div>
              <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>Consider running 2 tatamis simultaneously for larger events (7, 9) to reduce total time by ~40%.</div>
            </div>
          </div>
        )}

        {/* Timetable */}
        <div style={{ background: '#141414', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1a1a1a', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {['Start', 'End', 'Duration', 'Event', 'Discipline', 'Athletes', 'Matches'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? '#141414' : '#111' }}>
                  <td style={{ padding: '11px 14px', color: '#22c55e', fontWeight: 900, fontSize: 15, fontFamily: 'monospace' }}>{row.start}</td>
                  <td style={{ padding: '11px 14px', color: '#888', fontSize: 14, fontFamily: 'monospace' }}>{row.end}</td>
                  <td style={{ padding: '11px 14px', color: '#aaa', fontSize: 13 }}>
                    {row.dur > 0 ? `${row.dur} min` : <span style={{ color: '#555' }}>Walkover</span>}
                  </td>
                  <td style={{ padding: '11px 14px', color: '#f5f5f5', fontWeight: 600, fontSize: 13 }}>{row.name}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: (DISC_COLOUR[row.discipline] ?? '#888') + '22', color: DISC_COLOUR[row.discipline] ?? '#888', border: `1px solid ${(DISC_COLOUR[row.discipline] ?? '#888')}44` }}>
                      {DISC_LABEL[row.discipline] ?? row.discipline}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', color: '#f5f5f5', fontWeight: 700, fontSize: 14 }}>{row.athlete_count}</td>
                  <td style={{ padding: '11px 14px', color: '#aaa', fontSize: 13 }}>{row.matches}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ color: '#555', fontSize: 12 }}>
            Kata & Kumite: 2 min/match · Slam-Man: 1 min/match · 5 min break between events
          </div>
          <div className="no-print" style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => window.print()} style={{ background: '#0066cc', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' } as any}>
              🖨 Print Timetable
            </button>
          </div>
        </div>
      </div>
    );
  } finally {
    client.release();
    await pool.end();
  }
}
