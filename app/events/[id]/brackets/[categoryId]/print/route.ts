import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

function bracketSize(n: number) { let s = 4; while (s < n) s *= 2; return s; }
const fmt = (a: any) => a ? `${a.first_name} ${a.surname}` : '';
const disciplineLabel: Record<string, string> = { kumite: 'Kumite', kata: 'Kata', slam_man: 'Slam-Man' };

// Layout constants — fixed Apple-style, never scales
const AH = 26;        // slot height px (hard cap per design rules)
const OUTER_GAP = 18; // white space between match pairs
const R1_MH = AH * 2 + OUTER_GAP;
const CG = 20;        // connector gap between columns

// How many athlete slots fit per landscape A4 sheet
const CHUNK_SIZE = 16; // = one 16-draw bracket per sheet

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string; categoryId: string }> }) {
  const { id, categoryId: catId } = await props.params;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const [evRes, catRes, athRes, stateRes] = await Promise.all([
      client.query('SELECT * FROM comp_events WHERE id=$1', [id]),
      client.query('SELECT * FROM comp_categories WHERE id=$1', [catId]),
      client.query(`SELECT a.id,a.first_name,a.surname,a.club,a.grade,a.ekf_licence FROM comp_athletes a JOIN comp_registrations r ON r.athlete_id=a.id WHERE r.category_id=$1 AND r.event_id=$2 ORDER BY a.surname,a.first_name`, [catId, id]),
      client.query('SELECT bracket_json FROM comp_bracket_state WHERE category_id=$1 AND event_id=$2', [catId, id]),
    ]);

    if (!evRes.rows[0] || !catRes.rows[0]) {
      return new NextResponse('Not found', { status: 404 });
    }

    const event = evRes.rows[0];
    const category = catRes.rows[0];
    const athletes: any[] = athRes.rows;
    const bracketState = stateRes.rows[0]?.bracket_json ?? null;

    const size = bracketSize(athletes.length);

    const athleteMap: Record<number, any> = {};
    athletes.forEach(a => { athleteMap[a.id] = a; });

    const allMatches: any[] = bracketState?.matches ?? [];

    // Build the full R1 slot array (from stored state, or sequential if no state)
    let slots: (any | null)[];
    if (allMatches.length > 0) {
      const r1 = allMatches.filter((m: any) => m.round === 0).sort((a: any, b: any) => a.matchIndex - b.matchIndex);
      slots = [];
      r1.forEach((m: any) => {
        slots.push(m.top.athleteId ? (athleteMap[m.top.athleteId] ?? null) : null);
        slots.push(m.bottom.athleteId ? (athleteMap[m.bottom.athleteId] ?? null) : null);
      });
      while (slots.length < size) slots.push(null);
    } else {
      slots = new Array(size).fill(null);
      athletes.forEach((a, i) => { slots[i] = a; });
    }

    // ── Chunking: split the bracket into groups of 16 slots, one per A4 sheet ──
    const numChunks = size <= CHUNK_SIZE ? 1 : Math.ceil(size / CHUNK_SIZE);
    const multiPool = numChunks > 1;

    // For each chunk, generate a full bracket section (header + bracket + sidebar)
    const chunkSections: string[] = [];

    for (let c = 0; c < numChunks; c++) {
      const rawChunk = slots.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
      // Each chunk is always a 16-draw (or the full bracket size if ≤16)
      const localSize = multiPool ? CHUNK_SIZE : size;
      const localSlots: (any | null)[] = [...rawChunk];
      while (localSlots.length < localSize) localSlots.push(null);

      const localRounds = Math.log2(localSize);
      // Column width: fixed 210px — wide enough for long names on landscape A4
      const CW = 210;
      const TH = (localSize / 2) * R1_MH;

      // Look up a stored match for this chunk's local (r, lmi)
      const getChunkMatch = (r: number, lmi: number): any | null => {
        if (!allMatches.length) return null;
        // Map local matchIndex to global matchIndex within the full bracket
        const globalMi = multiPool
          ? Math.round(c * (CHUNK_SIZE / Math.pow(2, r + 1))) + lmi
          : lmi;
        return allMatches.find((m: any) => m.round === r && m.matchIndex === globalMi) ?? null;
      };

      const getChunkSlotName = (r: number, mi: number, top: boolean): string => {
        const m = getChunkMatch(r, mi);
        if (!m) return '';
        const slot = top ? m.top : m.bottom;
        if (!slot.athleteId) return '';
        const a = athleteMap[slot.athleteId];
        return a ? fmt(a) : '';
      };

      const poolLabel = multiPool ? ` — Pool ${String.fromCharCode(65 + c)}` : '';
      const localAthleteCount = localSlots.filter(Boolean).length;

      // Local winner (final match of this chunk's bracket)
      const localFinalMatch = getChunkMatch(localRounds - 1, 0);
      const localWinner = localFinalMatch?.winnerId ? athleteMap[localFinalMatch.winnerId] : null;

      // ── Build round columns for this chunk ──
      let bracketHTML = '';
      for (let r = 0; r < localRounds; r++) {
        const mc = localSize / Math.pow(2, r + 1);
        const mh = R1_MH * Math.pow(2, r);
        const pad = (mh - AH * 2) / 2;
        const isLast = r === localRounds - 1;
        const label =
          r === localRounds - 1 ? 'Final' :
          r === localRounds - 2 ? 'Semi-Final' :
          r === localRounds - 3 ? 'Quarter-Final' :
          `Round ${r + 1}`;

        let matchesHTML = '';
        let gapHTML = '';

        for (let mi = 0; mi < mc; mi++) {
          const mt = mi * mh;
          const topY = mt + pad;
          const botY = topY + AH;
          const vTop = topY + AH / 2;
          const vBot = botY + AH / 2;
          const midY = topY + AH; // midpoint between red and blue centres

          let topName = '', botName = '';
          if (r === 0) {
            topName = fmt(localSlots[mi * 2]);
            botName = fmt(localSlots[mi * 2 + 1]);
          } else {
            topName = getChunkSlotName(r, mi, true);
            botName = getChunkSlotName(r, mi, false);
          }

          const m = getChunkMatch(r, mi);
          let topW = false, botW = false;
          if (m?.winnerId) {
            if (r === 0) {
              topW = localSlots[mi * 2]?.id === m.winnerId;
              botW = localSlots[mi * 2 + 1]?.id === m.winnerId;
            } else {
              topW = m.top.athleteId === m.winnerId;
              botW = m.bottom.athleteId === m.winnerId;
            }
          }

          // BYE = slot with no athlete name in R1
          const topIsBye = r === 0 && !topName;
          const botIsBye = r === 0 && !botName;
          // Only show seq numbers for real athletes
          const seqTop = r === 0 && !topIsBye ? mi * 2 + 1 : 0;
          const seqBot = r === 0 && !botIsBye ? mi * 2 + 2 : 0;

          // Slot styling: athletes get red/blue; BYEs get a quiet gray
          const topBg     = topIsBye ? '#f3f3f3' : '#ffe8e8';
          const topBorder = topIsBye ? '1px solid #d8d8d8;border-left:3px solid #d8d8d8' : '1px solid #cc0000;border-left:3px solid #cc0000';
          const topTxt    = topIsBye ? '#bbb' : '#000';
          const topWt     = topIsBye ? '400' : '700';

          const botBg     = botIsBye ? '#f3f3f3' : '#e8eeff';
          const botBorder = botIsBye ? '1px solid #d8d8d8;border-left:3px solid #d8d8d8' : '1px solid #0000cc;border-left:3px solid #0000cc';
          const botTxt    = botIsBye ? '#bbb' : '#000';
          const botWt     = botIsBye ? '400' : '700';

          matchesHTML += `
            <div style="position:absolute;top:${mt}px;left:0;right:0;height:${mh}px;overflow:visible">
              <!-- AKA top slot -->
              <div style="position:absolute;top:${topY - mt}px;left:0;right:0;height:${AH}px;display:flex;align-items:center;background:${topBg};border:${topBorder};overflow:hidden">
                ${seqTop ? `<span style="font-size:8px;color:#555;flex-shrink:0;min-width:18px;text-align:right;padding-right:3px;font-weight:700">${seqTop}</span><span style="width:1px;height:100%;background:#ccc;flex-shrink:0"></span>` : '<span style="min-width:6px;flex-shrink:0"></span>'}
                <span style="font-size:10px;font-weight:${topWt};color:${topTxt};overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex:1;padding:0 5px">${topName || (r === 0 ? 'BYE' : '')}</span>
              </div>
              <!-- AO bottom slot -->
              <div style="position:absolute;top:${botY - mt}px;left:0;right:0;height:${AH}px;display:flex;align-items:center;background:${botBg};border:${botBorder};overflow:hidden">
                ${seqBot ? `<span style="font-size:8px;color:#555;flex-shrink:0;min-width:18px;text-align:right;padding-right:3px;font-weight:700">${seqBot}</span><span style="width:1px;height:100%;background:#ccc;flex-shrink:0"></span>` : '<span style="min-width:6px;flex-shrink:0"></span>'}
                <span style="font-size:10px;font-weight:${botWt};color:${botTxt};overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex:1;padding:0 5px">${botName || (r === 0 ? 'BYE' : '')}</span>
              </div>
            </div>`;

          // Connector lines into the gap column.
          // Gap div y=0 aligns with the column top (which includes the 16px round-label header).
          // vTop/vBot/midY are content-relative (below the header), so add HDR to convert.
          if (!isLast) {
            const HDR = 16; // round-label header height
            const barX = Math.floor(CG * 0.45);
            const gY1 = vTop + HDR - 1;  // H line from red-slot centre
            const gY2 = vBot + HDR - 1;  // H line from blue-slot centre
            const gYm = midY + HDR - 1;  // H line to next round (midpoint of V bar)
            gapHTML += `<div style="position:absolute;top:${gY1}px;left:0;width:${barX + 2}px;height:2px;background:#000"></div>`;
            gapHTML += `<div style="position:absolute;top:${gY2}px;left:0;width:${barX + 2}px;height:2px;background:#000"></div>`;
            gapHTML += `<div style="position:absolute;top:${gY1}px;left:${barX}px;width:2px;height:${gY2 - gY1 + 2}px;background:#000"></div>`;
            gapHTML += `<div style="position:absolute;top:${gYm}px;left:${barX}px;right:-1px;height:2px;background:#000"></div>`;
          }
        }

        bracketHTML += `<div style="width:${CW}px;flex-shrink:0">
          <div style="height:16px;background:#1A1A8C;color:#fff;font-size:8px;font-weight:700;text-align:center;display:flex;align-items:center;justify-content:center;letter-spacing:0.5px">${label}</div>
          <div style="position:relative;height:${TH}px;overflow:visible">${matchesHTML}</div>
        </div>`;
        if (!isLast) {
          bracketHTML += `<div style="width:${CG}px;flex-shrink:0;position:relative;height:${TH + 16}px;margin-top:0">${gapHTML}</div>`;
        }
      }

      // ── Compose the full sheet for this chunk ──
      const isLastChunk = c === numChunks - 1;
      chunkSections.push(`
        <div style="page-break-after:${isLastChunk ? 'avoid' : 'always'}">
          <!-- Sheet header -->
          <div style="background:#1A1A8C;color:#fff;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;border-radius:2px">
            <div>
              <div style="font-size:13px;font-weight:900;letter-spacing:0.3px">${category.name}${poolLabel}</div>
              <div style="font-size:9px;opacity:0.8;margin-top:1px">${event.name} · ${event.location} · ${event.date} · ${disciplineLabel[category.discipline] ?? category.discipline}</div>
            </div>
            <div style="text-align:right;font-size:9px">
              <div style="font-size:11px;font-weight:700">Tatami 1 &nbsp;|&nbsp; Pool ${multiPool ? String.fromCharCode(65 + c) : '1'}/1</div>
              <div style="opacity:0.7;margin-top:1px">${localAthleteCount} Athletes · ${localSize}-Draw${multiPool ? ` (Group ${c + 1} of ${numChunks})` : ''}</div>
            </div>
          </div>

          <!-- Bracket + sidebar -->
          <div style="display:flex;gap:8px;align-items:flex-start">
            <div style="display:flex;gap:0;flex:1;overflow:visible">${bracketHTML}</div>
            <div style="width:110px;flex-shrink:0;display:flex;flex-direction:column;gap:5px;padding-top:16px">
              <div style="border:1px solid #ccc;border-radius:3px;padding:4px 6px">
                <div style="font-size:8px;font-weight:700;color:#333;margin-bottom:3px">Referees:</div>
                <div style="height:13px;border-bottom:1px solid #eee;margin-bottom:2px"></div>
                <div style="height:13px;border-bottom:1px solid #eee;margin-bottom:2px"></div>
                <div style="height:13px"></div>
              </div>
              <div style="border:1px solid #000;border-radius:3px;padding:4px 6px">
                <div style="font-size:8px;font-weight:700;color:#000;margin-bottom:1px">🥇 1st Place</div>
                <div style="font-size:9px;font-weight:900;min-height:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${localWinner ? fmt(localWinner) : ''}</div>
              </div>
              <div style="border:1px solid #555;border-radius:3px;padding:4px 6px">
                <div style="font-size:8px;font-weight:700;color:#333;margin-bottom:1px">🥈 2nd Place</div>
                <div style="font-size:9px;min-height:12px">—</div>
              </div>
              <div style="border:1px solid #555;border-radius:3px;padding:4px 6px">
                <div style="font-size:8px;font-weight:700;color:#333;margin-bottom:1px">🥉 3rd Place</div>
                <div style="font-size:9px;min-height:12px">—</div>
              </div>
              <div style="border:1px solid #555;border-radius:3px;padding:4px 6px">
                <div style="font-size:8px;font-weight:700;color:#333;margin-bottom:1px">🥉 3rd Place</div>
                <div style="font-size:9px;min-height:12px">—</div>
              </div>
            </div>
          </div>

          <!-- Sheet footer -->
          <div style="margin-top:5px;border-top:1px solid #ddd;padding-top:3px;display:flex;justify-content:space-between;font-size:8px;color:#999">
            <span>${event.name}</span>
            <span>${category.name}${poolLabel} · ${localAthleteCount} athletes · ${localSize}-draw</span>
            <span>FKA Competition System · ${new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>
      `);
    }

    // ── Finals sheet (appended when there are multiple pool sheets) ──────────
    if (numChunks >= 2) {
      const LOCAL_ROUNDS = 4; // 16-draw = 4 rounds (r 0..3); pool final = r=3

      // Extract pool winner + runner-up from stored bracket state
      const poolResults = Array.from({ length: numChunks }, (_, c) => {
        const pLetter = String.fromCharCode(65 + c);
        // Pool final match: r=LOCAL_ROUNDS-1=3, globalMi=c (verified for 32- and 64-draw)
        const fm = allMatches.find((m: any) => m.round === LOCAL_ROUNDS - 1 && m.matchIndex === c) ?? null;
        const winner = fm?.winnerId ? athleteMap[fm.winnerId] : null;
        const runnerUpId = fm?.winnerId
          ? (fm.top.athleteId === fm.winnerId ? fm.bottom.athleteId : fm.top.athleteId)
          : null;
        const runnerUp = runnerUpId ? athleteMap[runnerUpId] : null;
        return {
          winner, runnerUp,
          winnerLabel:   winner   ? fmt(winner)   : `Pool ${pLetter} — 1st`,
          runnerUpLabel: runnerUp ? fmt(runnerUp) : `Pool ${pLetter} — 2nd`,
        };
      });

      // SF pairings:
      //  2 pools → crossover (A1 vs B2, B1 vs A2)
      //  4 pools → straight  (A1 vs B1, C1 vs D1)
      const sfPairs: Array<{ label: string; topLabel: string; botLabel: string; topAthlete: any; botAthlete: any }> =
        numChunks === 2
          ? [
              { label: 'Semi-Final 1', topLabel: poolResults[0].winnerLabel,   botLabel: poolResults[1].runnerUpLabel, topAthlete: poolResults[0].winner,   botAthlete: poolResults[1].runnerUp },
              { label: 'Semi-Final 2', topLabel: poolResults[1].winnerLabel,   botLabel: poolResults[0].runnerUpLabel, topAthlete: poolResults[1].winner,   botAthlete: poolResults[0].runnerUp },
            ]
          : [
              { label: 'Semi-Final 1', topLabel: poolResults[0].winnerLabel,   botLabel: poolResults[1].winnerLabel,   topAthlete: poolResults[0].winner,   botAthlete: poolResults[1].winner },
              { label: 'Semi-Final 2', topLabel: poolResults[2].winnerLabel,   botLabel: poolResults[3].winnerLabel,   topAthlete: poolResults[2].winner,   botAthlete: poolResults[3].winner },
            ];

      // Layout constants for the finals sheet
      const SF_HDR  = 14;                         // label header bar height (px)
      const SF_BLK  = SF_HDR + AH * 2;           // one SF block height = 66px
      const SF_GAP  = 32;                         // gap between SF1 and SF2
      const TOTAL_H = SF_BLK * 2 + SF_GAP;       // total column height = 164px
      const SF1_MID = SF_HDR + AH;               // Y midpoint of SF1 within column = 40
      const SF2_MID = SF_BLK + SF_GAP + SF_HDR + AH; // Y midpoint of SF2 = 138
      const CONN_Y  = Math.round((SF1_MID + SF2_MID) / 2); // connector horizontal to Final = 89

      const FINAL_BLK  = SF_HDR + AH * 2;        // Final block height = 66px
      const FINAL_TOP  = Math.round((TOTAL_H - FINAL_BLK) / 2); // centre Final = 49px

      const CWF = 250;   // SF / Final column width
      const CGF = 36;    // gap column width
      const BARX = Math.floor(CGF * 0.4); // vertical bar x in gap column

      const slotEl = (color: 'red' | 'blue', label: string, hasAthlete: boolean, topOffset: number) => {
        const bg     = hasAthlete ? (color === 'red' ? '#ffe8e8' : '#e8eeff') : '#fafafa';
        const border = color === 'red' ? '#cc0000' : '#0000cc';
        return `<div style="position:absolute;top:${topOffset}px;left:0;right:0;height:${AH}px;
          display:flex;align-items:center;background:${bg};
          border:1px solid ${border};border-left:3px solid ${border};overflow:hidden">
          <span style="font-size:10px;font-weight:${hasAthlete ? 700 : 400};color:${hasAthlete ? '#000' : '#aaa'};
            overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex:1;padding:0 8px">${label}</span>
        </div>`;
      };

      // SF column HTML (both SFs stacked)
      let sfColHTML = '';
      sfPairs.forEach((sf, i) => {
        const blockTop = i * (SF_BLK + SF_GAP);
        sfColHTML += `
          <div style="position:absolute;top:${blockTop}px;left:0;right:0">
            <div style="height:${SF_HDR}px;background:#1A1A8C;color:#fff;font-size:8px;font-weight:700;
              display:flex;align-items:center;justify-content:center;letter-spacing:0.5px">${sf.label}</div>
            <div style="position:relative;height:${AH * 2}px">
              ${slotEl('red',  sf.topLabel, !!sf.topAthlete, 0)}
              ${slotEl('blue', sf.botLabel, !!sf.botAthlete, AH)}
            </div>
          </div>`;
      });

      // Gap column connector lines (SF outputs → vertical bar → Final input)
      const gapHTML = [
        // H line from SF1 midpoint to vertical bar
        `<div style="position:absolute;top:${SF1_MID - 1}px;left:0;width:${BARX + 1}px;height:2px;background:#000"></div>`,
        // H line from SF2 midpoint to vertical bar
        `<div style="position:absolute;top:${SF2_MID - 1}px;left:0;width:${BARX + 1}px;height:2px;background:#000"></div>`,
        // Vertical bar joining SF1 mid → SF2 mid
        `<div style="position:absolute;top:${SF1_MID - 1}px;left:${BARX}px;width:2px;height:${SF2_MID - SF1_MID + 2}px;background:#000"></div>`,
        // H line from midpoint of V bar → right edge (into Final column)
        `<div style="position:absolute;top:${CONN_Y - 1}px;left:${BARX}px;right:0;height:2px;background:#000"></div>`,
      ].join('');

      // Final column HTML
      const finalColHTML = `
        <div style="position:absolute;top:${FINAL_TOP}px;left:0;right:0">
          <div style="height:${SF_HDR}px;background:#1A1A8C;color:#fff;font-size:8px;font-weight:700;
            display:flex;align-items:center;justify-content:center;letter-spacing:0.5px">Final</div>
          <div style="position:relative;height:${AH * 2}px">
            ${slotEl('red',  'Semi-Final 1 Winner', false, 0)}
            ${slotEl('blue', 'Semi-Final 2 Winner', false, AH)}
          </div>
        </div>`;

      // Sidebar: medal positions
      const sidebarHTML = `
        <div style="width:130px;flex-shrink:0;display:flex;flex-direction:column;gap:6px;padding-top:${FINAL_TOP}px">
          <div style="border:2px solid #FFD700;background:#FFFDE7;border-radius:4px;padding:5px 8px">
            <div style="font-size:8px;font-weight:700;color:#555">🥇 1st Place</div>
            <div style="font-size:9px;font-weight:900;min-height:14px"></div>
          </div>
          <div style="border:2px solid #BDBDBD;background:#FAFAFA;border-radius:4px;padding:5px 8px">
            <div style="font-size:8px;font-weight:700;color:#555">🥈 2nd Place</div>
            <div style="font-size:9px;min-height:14px"></div>
          </div>
          <div style="border:2px solid #FF8F00;background:#FFF3E0;border-radius:4px;padding:5px 8px">
            <div style="font-size:8px;font-weight:700;color:#555">🥉 3rd Place</div>
            <div style="font-size:9px;min-height:14px"></div>
          </div>
          <div style="border:2px solid #FF8F00;background:#FFF3E0;border-radius:4px;padding:5px 8px">
            <div style="font-size:8px;font-weight:700;color:#555">🥉 3rd Place</div>
            <div style="font-size:9px;min-height:14px"></div>
          </div>
        </div>`;

      const poolSummaryRows = poolResults.map((p, i) =>
        `<tr>
          <td style="padding:3px 8px;font-size:9px;font-weight:700">Pool ${String.fromCharCode(65+i)}</td>
          <td style="padding:3px 8px;font-size:9px">${p.winner ? fmt(p.winner) : '—'}</td>
          <td style="padding:3px 8px;font-size:9px">${p.runnerUp ? fmt(p.runnerUp) : '—'}</td>
        </tr>`
      ).join('');

      chunkSections.push(`
        <div style="page-break-after:avoid">
          <!-- Finals sheet header -->
          <div style="background:#1A1A8C;color:#fff;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;border-radius:2px">
            <div>
              <div style="font-size:13px;font-weight:900;letter-spacing:0.3px">${category.name} — Finals</div>
              <div style="font-size:9px;opacity:0.8;margin-top:1px">${event.name} · ${event.location} · ${event.date} · ${disciplineLabel[category.discipline] ?? category.discipline}</div>
            </div>
            <div style="text-align:right;font-size:9px">
              <div style="font-size:11px;font-weight:700">Semi-Finals &amp; Final</div>
              <div style="opacity:0.7;margin-top:1px">${athletes.length} athletes · ${numChunks} pools</div>
            </div>
          </div>

          <!-- Pool results summary -->
          <div style="margin-bottom:10px">
            <div style="font-size:8px;font-weight:700;color:#333;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">Pool Results</div>
            <table style="border-collapse:collapse;font-family:Arial,sans-serif">
              <thead>
                <tr style="background:#f0f0f0">
                  <th style="padding:3px 8px;font-size:8px;font-weight:700;text-align:left;border:1px solid #ddd">Pool</th>
                  <th style="padding:3px 8px;font-size:8px;font-weight:700;text-align:left;border:1px solid #ddd">1st</th>
                  <th style="padding:3px 8px;font-size:8px;font-weight:700;text-align:left;border:1px solid #ddd">2nd</th>
                </tr>
              </thead>
              <tbody style="border:1px solid #ddd">
                ${poolSummaryRows}
              </tbody>
            </table>
          </div>

          <!-- SF + Final bracket -->
          <div style="display:flex;gap:0;align-items:flex-start">
            <!-- SF column -->
            <div style="width:${CWF}px;flex-shrink:0;position:relative;height:${TOTAL_H}px">
              ${sfColHTML}
            </div>
            <!-- Gap / connectors -->
            <div style="width:${CGF}px;flex-shrink:0;position:relative;height:${TOTAL_H}px">
              ${gapHTML}
            </div>
            <!-- Final column -->
            <div style="width:${CWF}px;flex-shrink:0;position:relative;height:${TOTAL_H}px">
              ${finalColHTML}
            </div>
            <!-- Sidebar: medal boxes -->
            ${sidebarHTML}
          </div>

          <!-- Footer -->
          <div style="margin-top:10px;border-top:1px solid #ddd;padding-top:3px;display:flex;justify-content:space-between;font-size:8px;color:#999">
            <span>${event.name}</span>
            <span>${category.name} · Finals Sheet · ${athletes.length} athletes · ${numChunks} pools</span>
            <span>FKA Competition System · ${new Date().toLocaleDateString('en-GB')}</span>
          </div>
        </div>
      `);
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${category.name} — ${event.name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif}
body{background:#fff;color:#000;padding:10px}
@page{size:A4 landscape;margin:6mm}
@media print{
  .np{display:none!important}
  body{padding:0}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
@media screen{body{max-width:297mm}}
</style>
</head>
<body>
<div class="np" style="margin-bottom:8px;display:flex;gap:8px">
  <button onclick="window.print()" style="background:#1A1A8C;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-size:13px;font-weight:700;cursor:pointer">🖨 Print / Save PDF</button>
  <button onclick="window.close()" style="background:#666;color:#fff;border:none;padding:8px 14px;border-radius:4px;font-size:13px;cursor:pointer">✕</button>
  ${numChunks > 1 ? `<span style="font-size:12px;color:#555;line-height:34px">${numChunks} sheets (${athletes.length} athletes split into groups of ${CHUNK_SIZE})</span>` : ''}
</div>

${chunkSections.join('\n')}

</body>
</html>`;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

  } finally {
    client.release();
    await pool.end();
  }
}
