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
    return {
      event: evRes.rows[0], category: catRes.rows[0],
      athletes: athRes.rows,
      bracketState: stateRes.rows[0]?.bracket_json ?? null,
    };
  } finally { client.release(); await pool.end(); }
}

function bracketSize(n: number) { let s = 4; while (s < n) s *= 2; return s; }

function buildSlots(athletes: any[], size: number): (any | null)[] {
  const slots: (any | null)[] = new Array(size).fill(null);
  athletes.forEach((a, i) => { slots[i] = a; });
  return slots;
}

// The Sportdata-style CSS bracket — pure HTML, prints cleanly
export default async function PrintPage({ params }: { params: Promise<{ id: string; categoryId: string }> }) {
  const { id, categoryId: catId } = await params;
  const data = await getData(parseInt(id), parseInt(catId));
  if (!data) return notFound();

  const { event, category, athletes, bracketState } = data;
  const size = bracketSize(athletes.length);
  const rounds = Math.log2(size);

  // Build athlete map
  const athleteMap: Record<number, any> = {};
  athletes.forEach((a: any) => { athleteMap[a.id] = a; });

  // Get bracket matches if state saved
  const matches: any[] = bracketState?.matches ?? [];

  // Build slots from state or fresh
  let slots: (any | null)[];
  if (matches.length > 0) {
    // Reconstruct R1 slots from saved bracket
    const r1 = matches.filter((m: any) => m.round === 0).sort((a: any, b: any) => a.matchIndex - b.matchIndex);
    slots = [];
    r1.forEach((m: any) => {
      const topA = m.top.athleteId ? athleteMap[m.top.athleteId] ?? { first_name: m.top.name, surname: '', club: m.top.club, id: m.top.athleteId } : null;
      const botA = m.bottom.athleteId ? athleteMap[m.bottom.athleteId] ?? { first_name: m.bottom.name, surname: '', club: m.bottom.club, id: m.bottom.athleteId } : null;
      slots.push(topA, botA);
    });
    // Pad to size
    while (slots.length < size) slots.push(null);
  } else {
    slots = buildSlots(athletes, size);
  }

  // Build round data: array of rounds, each round is array of matches [{top, bottom, winnerId}]
  const roundData: { top: string; bottom: string; topId: number | null; bottomId: number | null; winnerId: number | null }[][] = [];

  for (let r = 0; r < rounds; r++) {
    const matchCount = size / Math.pow(2, r + 1);
    const roundMatches = [];
    for (let m = 0; m < matchCount; m++) {
      if (r === 0) {
        const topA = slots[m * 2];
        const botA = slots[m * 2 + 1];
        const savedM = matches.find((x: any) => x.round === 0 && x.matchIndex === m);
        roundMatches.push({
          top: topA ? `${topA.first_name} ${topA.surname}` : 'BYE',
          bottom: botA ? `${botA.first_name} ${botA.surname}` : 'BYE',
          topId: topA?.id ?? null, bottomId: botA?.id ?? null,
          winnerId: savedM?.winnerId ?? null,
        });
      } else {
        const savedM = matches.find((x: any) => x.round === r && x.matchIndex === m);
        const topId = savedM?.top?.athleteId ?? null;
        const botId = savedM?.bottom?.athleteId ?? null;
        roundMatches.push({
          top: topId && athleteMap[topId] ? `${athleteMap[topId].first_name} ${athleteMap[topId].surname}` : '—',
          bottom: botId && athleteMap[botId] ? `${athleteMap[botId].first_name} ${athleteMap[botId].surname}` : '—',
          topId, bottomId: botId,
          winnerId: savedM?.winnerId ?? null,
        });
      }
    }
    roundData.push(roundMatches);
  }

  const finalMatch = roundData[rounds - 1]?.[0];
  const winner = finalMatch?.winnerId ? athleteMap[finalMatch.winnerId] : null;

  const roundLabels = ['Round 1', 'Round 2', 'Quarter-Final', 'Semi-Final', 'Final'];
  const getRoundLabel = (r: number) => {
    if (r === rounds - 1) return 'Final';
    if (r === rounds - 2) return 'Semi-Final';
    if (r === rounds - 3) return 'Quarter-Final';
    return `Round ${r + 1}`;
  };

  const SLOT_H = 24; // px per slot
  const COL_W = 160; // px per round column
  const COL_GAP = 20; // px between columns (for connector line)
  const totalH = size * SLOT_H;

  const disciplineLabel: Record<string, string> = { kumite: 'Kumite', kata: 'Kata', slam_man: 'Slam-Man' };

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>{category.name} — {event.name}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, Helvetica, sans-serif; background: white; color: #000; font-size: 11px; }
          
          @page { size: A4 landscape; margin: 8mm; }
          @media screen { body { padding: 16px; } }
          @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
          }

          .print-btn {
            position: fixed; top: 12px; right: 12px;
            background: #0066cc; color: #fff; border: none;
            padding: 8px 18px; border-radius: 6px; font-size: 13px;
            font-weight: 700; cursor: pointer;
          }

          /* ── Header ── */
          .bracket-header {
            background: #1A1A8C; color: #fff;
            display: flex; justify-content: space-between; align-items: center;
            padding: 8px 14px; margin-bottom: 10px;
            border-radius: 3px;
          }
          .bracket-header h1 { font-size: 14px; font-weight: 900; margin-bottom: 2px; }
          .bracket-header p { font-size: 10px; opacity: 0.75; }
          .bracket-header .right { text-align: right; font-size: 10px; font-weight: 700; }

          /* ── Bracket columns wrapper ── */
          .bracket-body { display: flex; align-items: flex-start; gap: 0; overflow-x: auto; }

          /* ── Each round column ── */
          .round-col { display: flex; flex-direction: column; width: ${COL_W}px; flex-shrink: 0; }
          .round-label {
            font-size: 9px; font-weight: 700; text-align: center; text-transform: uppercase;
            letter-spacing: 0.5px; color: #1A1A8C; border-bottom: 1.5px solid #1A1A8C;
            padding-bottom: 3px; margin-bottom: 0; height: 16px;
          }

          /* ── Match container: grows proportionally ── */
          .match-wrap {
            display: flex; flex-direction: column; justify-content: center;
            position: relative;
          }

          /* ── Athlete slot ── */
          .slot {
            height: ${SLOT_H}px;
            border: 1px solid #bbb;
            display: flex; align-items: center;
            padding: 0 5px;
            font-size: 10px; font-weight: 600;
            background: #fff;
            overflow: hidden;
            white-space: nowrap; text-overflow: ellipsis;
            position: relative;
          }
          .slot.bye { color: #bbb; font-weight: 400; background: #fafafa; }
          .slot.winner { background: #e8f5e9; border-color: #4caf50; }
          .slot.loser { background: #fce4e4; color: #999; font-weight: 400; }
          .slot.empty { color: #ccc; font-weight: 400; border-style: dashed; }

          /* Slot number */
          .slot-num { color: #aaa; font-size: 9px; margin-right: 4px; flex-shrink: 0; }

          /* Right connector: vertical bar on right edge spanning from top slot center to bottom slot center */
          .match-wrap .connector-v {
            position: absolute; right: 0; background: #bbb; width: 1px;
          }
          /* Horizontal line from midpoint to next column */
          .match-wrap .connector-h {
            position: absolute; right: -${COL_GAP}px; height: 1px; background: #bbb; width: ${COL_GAP}px;
          }

          /* ── Connector column (the gap) ── */
          .gap-col { width: ${COL_GAP}px; flex-shrink: 0; }

          /* ── Medal boxes ── */
          .medals { display: flex; flex-direction: column; gap: 6px; justify-content: center; padding: 0 0 0 10px; width: 130px; flex-shrink: 0; align-self: center; }
          .medal-box { border-radius: 5px; padding: 5px 8px; font-size: 10px; border: 1.5px solid; }
          .medal-box .pos { font-weight: 700; font-size: 9px; margin-bottom: 1px; }
          .medal-box .name { font-weight: 900; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .gold { background: #FFFDE7; border-color: #FFD700; }
          .silver { background: #FAFAFA; border-color: #BDBDBD; }
          .bronze { background: #FFF8F0; border-color: #CD7F32; }

          /* Footer */
          .bracket-footer { border-top: 1px solid #ddd; margin-top: 10px; padding-top: 6px; display: flex; justify-content: space-between; font-size: 9px; color: #999; }
        `}</style>
      </head>
      <body>
        <button className="no-print print-btn" onClick={() => window.print()}>🖨 Print / Save PDF</button>

        <div className="bracket-header">
          <div>
            <h1>{category.name}</h1>
            <p>{event.name} · {event.location} · {event.date} · {disciplineLabel[category.discipline] ?? category.discipline}</p>
          </div>
          <div className="right">
            <div>Tatami 1 &nbsp;|&nbsp; Pool 1/1</div>
            <div style={{ marginTop: 2, fontWeight: 400 }}>{athletes.length} Athletes · {size}-Draw</div>
          </div>
        </div>

        <div className="bracket-body">
          {roundData.map((rMatches, r) => {
            const matchH = totalH / rMatches.length;
            const slotPad = (matchH - SLOT_H * 2) / 2; // space above top slot within match
            const midFrac = 0.5; // midpoint fraction within match height
            const midY = slotPad + SLOT_H / 2 + (slotPad + SLOT_H + (matchH - slotPad * 2 - SLOT_H * 2) / 2); // centre between slots

            return (
              <>
                <div key={r} className="round-col">
                  <div className="round-label">{getRoundLabel(r)}</div>
                  <div style={{ position: 'relative', height: totalH }}>
                    {rMatches.map((m, mi) => {
                      const matchTop = mi * matchH;
                      const topY = matchTop + slotPad;
                      const botY = matchTop + matchH - slotPad - SLOT_H;
                      const vLineTop = topY + SLOT_H / 2;
                      const vLineBot = botY + SLOT_H / 2;
                      const hLineY = (vLineTop + vLineBot) / 2;
                      const isLast = r === rounds - 1;

                      const topClass = `slot${!m.topId ? (r === 0 ? ' bye' : ' empty') : m.winnerId === m.topId ? ' winner' : m.winnerId && m.topId ? ' loser' : ''}`;
                      const botClass = `slot${!m.bottomId ? (r === 0 ? ' bye' : ' empty') : m.winnerId === m.bottomId ? ' winner' : m.winnerId && m.bottomId ? ' loser' : ''}`;

                      return (
                        <div key={mi} style={{ position: 'absolute', top: matchTop, height: matchH, left: 0, right: 0 }}>
                          {/* Top slot */}
                          <div className={topClass} style={{ position: 'absolute', top: topY - matchTop, left: 0, right: 0 }}>
                            {r === 0 && <span className="slot-num">{mi * 2 + 1}</span>}
                            {m.top}
                          </div>
                          {/* Bottom slot */}
                          <div className={botClass} style={{ position: 'absolute', top: botY - matchTop, left: 0, right: 0 }}>
                            {r === 0 && <span className="slot-num">{mi * 2 + 2}</span>}
                            {m.bottom}
                          </div>
                          {/* Vertical connector */}
                          {!isLast && (
                            <div style={{ position: 'absolute', left: COL_W - 1, top: vLineTop - matchTop, height: vLineBot - vLineTop, width: 1, background: '#bbb' }} />
                          )}
                          {/* Horizontal connector to next column */}
                          {!isLast && (
                            <div style={{ position: 'absolute', left: COL_W - 1, top: hLineY - matchTop, height: 1, width: COL_GAP + 1, background: '#bbb' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {r < rounds - 1 && <div key={`gap-${r}`} style={{ width: COL_GAP, flexShrink: 0 }} />}
              </>
            );
          })}

          {/* Medal column */}
          <div className="medals">
            <div className="medal-box gold">
              <div className="pos">🥇 1st Place</div>
              <div className="name">{winner ? `${winner.first_name} ${winner.surname}` : '—'}</div>
            </div>
            <div className="medal-box silver">
              <div className="pos">🥈 2nd Place</div>
              <div className="name">—</div>
            </div>
            <div className="medal-box bronze">
              <div className="pos">🥉 3rd Place</div>
              <div className="name">—</div>
            </div>
            <div className="medal-box bronze">
              <div className="pos">🥉 3rd Place</div>
              <div className="name">—</div>
            </div>
          </div>
        </div>

        <div className="bracket-footer">
          <span>{event.name}</span>
          <span>{category.name} · {athletes.length} athletes</span>
          <span>Printed: {new Date().toLocaleDateString('en-GB')}</span>
        </div>

        <script dangerouslySetInnerHTML={{ __html: `window.addEventListener('load', () => setTimeout(() => window.print(), 800));` }} />
      </body>
    </html>
  );
}
