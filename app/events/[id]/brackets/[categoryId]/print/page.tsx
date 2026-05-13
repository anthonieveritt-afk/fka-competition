import { Pool } from 'pg';
import { notFound } from 'next/navigation';

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
    const stateRes = await client.query(
      'SELECT bracket_json FROM comp_bracket_state WHERE category_id=$1 AND event_id=$2',
      [categoryId, eventId]
    );
    return { event: evRes.rows[0], category: catRes.rows[0], athletes: athRes.rows, bracketState: stateRes.rows[0]?.bracket_json ?? null };
  } finally { client.release(); await pool.end(); }
}

function bracketSize(n: number) { let s = 4; while (s < n) s *= 2; return s; }

export default async function PrintPage({ params }: { params: Promise<{ id: string; categoryId: string }> }) {
  const { id, categoryId: catId } = await params;
  const data = await getData(parseInt(id), parseInt(catId));
  if (!data) return notFound();

  const { event, category, athletes, bracketState } = data;
  const size = bracketSize(athletes.length);
  const rounds = Math.log2(size);

  const athleteMap: Record<number, any> = {};
  athletes.forEach((a: any) => { athleteMap[a.id] = a; });

  // Build slots
  const matches: any[] = bracketState?.matches ?? [];
  let slots: (any | null)[];
  if (matches.length > 0) {
    const r1 = matches.filter((m: any) => m.round === 0).sort((a: any, b: any) => a.matchIndex - b.matchIndex);
    slots = [];
    r1.forEach((m: any) => {
      const topA = m.top.athleteId ? (athleteMap[m.top.athleteId] ?? null) : null;
      const botA = m.bottom.athleteId ? (athleteMap[m.bottom.athleteId] ?? null) : null;
      slots.push(topA, botA);
    });
    while (slots.length < size) slots.push(null);
  } else {
    slots = new Array(size).fill(null);
    athletes.forEach((a: any, i: number) => { slots[i] = a; });
  }

  // Dimensions
  const ATHLETE_H = 22;   // px per athlete row
  const SCORE_H = 10;     // px per score box (red/blue)
  const MATCH_UNIT = ATHLETE_H * 2 + SCORE_H * 2; // base match height in R1
  const COL_W = 155;      // width of each athlete column
  const COL_GAP = 16;     // gap between columns (connector line space)
  const TOTAL_H = size * ATHLETE_H; // total bracket height

  const disciplineLabel: Record<string, string> = { kumite: 'Kumite', kata: 'Kata', slam_man: 'Slam-Man' };

  const formatName = (a: any) => a ? `${a.surname.toUpperCase()} ${a.first_name[0]}.` : '';

  // Get winner from saved bracket state for a given round/match
  const getMatchState = (r: number, mi: number) => {
    return matches.find((m: any) => m.round === r && m.matchIndex === mi) ?? null;
  };

  // Get athlete name for a slot in later rounds
  const getLaterRoundName = (r: number, mi: number, isTop: boolean) => {
    const m = getMatchState(r, mi);
    if (!m) return '';
    const slot = isTop ? m.top : m.bottom;
    if (!slot.athleteId) return '';
    const a = athleteMap[slot.athleteId];
    return a ? formatName(a) : '';
  };

  const getWinnerId = (r: number, mi: number) => getMatchState(r, mi)?.winnerId ?? null;

  // Build rounds
  const roundCols = [];
  for (let r = 0; r < rounds; r++) {
    const matchCount = size / Math.pow(2, r + 1);
    const matchH = TOTAL_H / matchCount;
    const topOffset = (matchH - ATHLETE_H * 2 - SCORE_H * 2) / 2;
    const isLast = r === rounds - 1;
    const getRoundLabel = () => {
      if (r === rounds - 1) return 'Final';
      if (r === rounds - 2) return 'Semi-Final';
      if (r === rounds - 3) return 'Quarter-Final';
      return `Round ${r + 1}`;
    };

    const matchEls = [];
    for (let mi = 0; mi < matchCount; mi++) {
      const matchTop = mi * matchH;
      const topSlotY = matchTop + topOffset;
      const topScoreY = topSlotY + ATHLETE_H;
      const botScoreY = topScoreY + SCORE_H;
      const botSlotY = botScoreY + SCORE_H;
      const vLineTop = topSlotY + ATHLETE_H / 2;
      const vLineBot = botSlotY + ATHLETE_H / 2;
      const midY = (vLineTop + vLineBot) / 2;

      let topName = '', botName = '', winnerId = null;
      let topIsWinner = false, botIsWinner = false;
      let topIsLoser = false, botIsLoser = false;

      if (r === 0) {
        const topA = slots[mi * 2];
        const botA = slots[mi * 2 + 1];
        topName = topA ? formatName(topA) : '';
        botName = botA ? formatName(botA) : '';
        const m = getMatchState(0, mi);
        winnerId = m?.winnerId ?? null;
        if (winnerId) {
          topIsWinner = topA?.id === winnerId;
          botIsWinner = botA?.id === winnerId;
          topIsLoser = topA && topA.id !== winnerId;
          botIsLoser = botA && botA.id !== winnerId;
        }
      } else {
        topName = getLaterRoundName(r, mi, true);
        botName = getLaterRoundName(r, mi, false);
        winnerId = getWinnerId(r, mi);
        const m = getMatchState(r, mi);
        if (winnerId && m) {
          topIsWinner = m.top.athleteId === winnerId;
          botIsWinner = m.bottom.athleteId === winnerId;
          topIsLoser = m.top.athleteId && m.top.athleteId !== winnerId;
          botIsLoser = m.bottom.athleteId && m.bottom.athleteId !== winnerId;
        }
      }

      const seqTop = r === 0 ? mi * 2 + 1 : null;
      const seqBot = r === 0 ? mi * 2 + 2 : null;

      matchEls.push(
        <div key={mi} style={{ position: 'absolute', top: matchTop, left: 0, right: 0, height: matchH }}>

          {/* Top athlete row */}
          <div style={{
            position: 'absolute', top: topSlotY - matchTop, left: 0, right: 0, height: ATHLETE_H,
            borderBottom: `1px solid ${topIsWinner ? '#2e7d32' : topIsLoser ? '#c62828' : '#999'}`,
            display: 'flex', alignItems: 'center', gap: 4,
            background: topIsWinner ? '#e8f5e9' : topIsLoser ? '#fce4e4' : r === 0 && !slots[mi * 2] ? '#fafafa' : '#fff',
            paddingLeft: 3, overflow: 'hidden',
          }}>
            {seqTop && <span style={{ fontSize: 8, color: '#aaa', flexShrink: 0, minWidth: 14, fontWeight: 700 }}>{seqTop}</span>}
            {/* Flag placeholder — coloured dot */}
            {(r === 0 ? slots[mi * 2] : topName) && (
              <span style={{ width: 14, height: 10, background: '#e0e0e0', border: '1px solid #ccc', flexShrink: 0, fontSize: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>🏴</span>
            )}
            <span style={{ fontSize: 9, fontWeight: topName ? 700 : 400, color: topName ? '#000' : '#bbb', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>
              {topName || (r === 0 ? 'BYE' : '')}
            </span>
          </div>

          {/* Red score box (AKA) */}
          <div style={{ position: 'absolute', top: topScoreY - matchTop, left: 0, right: 0, height: SCORE_H, background: '#ffe0e0', border: '1px solid #ffb3b3', borderTop: 'none' }} />

          {/* Blue score box (AO) */}
          <div style={{ position: 'absolute', top: botScoreY - matchTop, left: 0, right: 0, height: SCORE_H, background: '#e0e8ff', border: '1px solid #b3c6ff' }} />

          {/* Bottom athlete row */}
          <div style={{
            position: 'absolute', top: botSlotY - matchTop, left: 0, right: 0, height: ATHLETE_H,
            borderBottom: `1px solid ${botIsWinner ? '#2e7d32' : botIsLoser ? '#c62828' : '#999'}`,
            display: 'flex', alignItems: 'center', gap: 4,
            background: botIsWinner ? '#e8f5e9' : botIsLoser ? '#fce4e4' : r === 0 && !slots[mi * 2 + 1] ? '#fafafa' : '#fff',
            paddingLeft: 3, overflow: 'hidden',
          }}>
            {seqBot && <span style={{ fontSize: 8, color: '#aaa', flexShrink: 0, minWidth: 14, fontWeight: 700 }}>{seqBot}</span>}
            {(r === 0 ? slots[mi * 2 + 1] : botName) && (
              <span style={{ width: 14, height: 10, background: '#e0e0e0', border: '1px solid #ccc', flexShrink: 0, fontSize: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>🏴</span>
            )}
            <span style={{ fontSize: 9, fontWeight: botName ? 700 : 400, color: botName ? '#000' : '#bbb', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>
              {botName || (r === 0 ? 'BYE' : '')}
            </span>
          </div>

          {/* Vertical connector line (right edge, from top slot mid to bottom slot mid) */}
          {!isLast && (
            <div style={{ position: 'absolute', right: 0, top: vLineTop - matchTop, height: vLineBot - vLineTop, width: 1, background: '#666' }} />
          )}

          {/* Horizontal connector to next column (at midpoint) */}
          {!isLast && (
            <div style={{ position: 'absolute', right: -(COL_GAP), top: midY - matchTop, height: 1, width: COL_GAP, background: '#666' }} />
          )}
        </div>
      );
    }

    roundCols.push(
      <div key={r} style={{ display: 'flex', gap: 0 }}>
        <div style={{ width: COL_W, flexShrink: 0 }}>
          {/* Round label */}
          <div style={{ height: 16, background: '#1A1A8C', color: '#fff', fontSize: 8, fontWeight: 700, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: 0.5 }}>
            {getRoundLabel()}
          </div>
          {/* Matches */}
          <div style={{ position: 'relative', height: TOTAL_H }}>
            {matchEls}
          </div>
        </div>
        {!isLast && <div style={{ width: COL_GAP, flexShrink: 0 }} />}
      </div>
    );
  }

  // Final winner
  const finalM = getMatchState(rounds - 1, 0);
  const winner = finalM?.winnerId ? athleteMap[finalM.winnerId] : null;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{category.name} — {event.name}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; }
          body { background: #fff; color: #000; }
          @page { size: A4 landscape; margin: 6mm; }
          @media screen { body { padding: 12px; max-width: 297mm; } }
          @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}</style>
      </head>
      <body>
        {/* Print button */}
        <div className="no-print" style={{ marginBottom: 10, display: 'flex', gap: 8 }}>
          <button onClick={() => window.print()} style={{ background: '#1A1A8C', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🖨 Print / Save PDF</button>
          <button onClick={() => window.close()} style={{ background: '#666', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, fontSize: 13, cursor: 'pointer' }}>✕ Close</button>
        </div>

        {/* Header — Sportdata style */}
        <div style={{ background: '#1A1A8C', color: '#fff', padding: '5px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 0.3 }}>{category.name}</div>
            <div style={{ fontSize: 9, opacity: 0.8, marginTop: 1 }}>{event.name} · {event.location} · {event.date}</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 9 }}>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <div><span style={{ opacity: 0.7 }}>Tatami </span><strong style={{ fontSize: 11 }}>1</strong></div>
              <div><span style={{ opacity: 0.7 }}>Pool </span><strong style={{ fontSize: 11 }}>1/1</strong></div>
            </div>
            <div style={{ opacity: 0.6, marginTop: 2 }}>{athletes.length} Athletes · {size}-Draw</div>
          </div>
        </div>

        {/* Main bracket + sidebar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          {/* Bracket columns */}
          <div style={{ display: 'flex', gap: 0, flex: 1, overflowX: 'auto' }}>
            {roundCols}
          </div>

          {/* Right sidebar — Seeded + Results */}
          <div style={{ width: 120, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 16 }}>
            {/* Winner/results boxes */}
            {[
              { label: '1st', bg: '#FFF9C4', border: '#FFD600', name: winner ? formatName(winner) : '' },
              { label: '2nd', bg: '#F5F5F5', border: '#BDBDBD', name: '' },
              { label: '3rd', bg: '#FFF3E0', border: '#FF8F00', name: '' },
              { label: '3rd', bg: '#FFF3E0', border: '#FF8F00', name: '' },
            ].map((box, i) => (
              <div key={i} style={{ border: `1.5px solid ${box.border}`, background: box.bg, borderRadius: 3, padding: '4px 6px', minHeight: 28 }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: '#666', marginBottom: 1 }}>{box.label} Place</div>
                <div style={{ fontSize: 9, fontWeight: 900, color: '#000', minHeight: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{box.name || '—'}</div>
              </div>
            ))}

            {/* Seeded label */}
            <div style={{ fontSize: 8, color: '#666', fontStyle: 'italic', textAlign: 'center', marginTop: 4 }}>*Seeded</div>

            {/* Referees */}
            <div style={{ marginTop: 8, border: '1px solid #ccc', borderRadius: 3, padding: '4px 6px' }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: '#666', marginBottom: 4 }}>Referees:</div>
              {[1, 2, 3].map(n => (
                <div key={n} style={{ height: 14, borderBottom: '1px solid #eee', marginBottom: 2 }} />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 6, borderTop: '1px solid #ddd', paddingTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#888' }}>
          <span>{event.name} · {category.name}</span>
          <span>{athletes.length} athletes · {size}-draw · {disciplineLabel[category.discipline] ?? category.discipline}</span>
          <span>FKA Competition System · Printed {new Date().toLocaleDateString('en-GB')}</span>
        </div>

        <script dangerouslySetInnerHTML={{ __html: `window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 900); });` }} />
      </body>
    </html>
  );
}
