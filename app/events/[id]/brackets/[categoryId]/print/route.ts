import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

function bracketSize(n: number) { let s = 4; while (s < n) s *= 2; return s; }
const fmt = (a: any) => a ? `${a.surname.toUpperCase()} ${a.first_name[0]}.` : '';
const disciplineLabel: Record<string, string> = { kumite: 'Kumite', kata: 'Kata', slam_man: 'Slam-Man' };

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
    const rounds = Math.log2(size);

    const athleteMap: Record<number, any> = {};
    athletes.forEach(a => { athleteMap[a.id] = a; });

    const matches: any[] = bracketState?.matches ?? [];

    // Build R1 slots
    let slots: (any | null)[];
    if (matches.length > 0) {
      const r1 = matches.filter((m: any) => m.round === 0).sort((a: any, b: any) => a.matchIndex - b.matchIndex);
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

    const getMatch = (r: number, mi: number) => matches.find((m: any) => m.round === r && m.matchIndex === mi) ?? null;
    const getSlotName = (r: number, mi: number, top: boolean) => {
      const m = getMatch(r, mi);
      if (!m) return '';
      const slot = top ? m.top : m.bottom;
      if (!slot.athleteId) return '';
      const a = athleteMap[slot.athleteId];
      return a ? fmt(a) : '';
    };

    // Layout constants
    // Scale slot height to fill the printable area (A4 landscape ≈ 680px usable after header/footer)
    const TARGET_H = 680;
    const AH = Math.max(22, Math.floor((TARGET_H / size) * 0.6)); // athlete row height
    const SH = Math.max(8, Math.floor(AH * 0.35));                // score box height
    const CW = Math.min(200, Math.max(148, Math.floor(650 / rounds))); // column width
    const CG = Math.max(12, Math.floor(CW * 0.1));                 // gap between columns
    const TH = size * AH; // total bracket height

    // Build HTML for each round column
    let bracketHTML = '';
    for (let r = 0; r < rounds; r++) {
      const mc = size / Math.pow(2, r + 1);
      const mh = TH / mc;
      const pad = (mh - AH * 2 - SH * 2) / 2;
      const isLast = r === rounds - 1;
      const label = r === rounds - 1 ? 'Final' : r === rounds - 2 ? 'Semi-Final' : r === rounds - 3 ? 'Quarter-Final' : `Round ${r + 1}`;

      let matchesHTML = '';
      for (let mi = 0; mi < mc; mi++) {
        const mt = mi * mh;
        const topY = mt + pad;
        const topScY = topY + AH;
        const botScY = topScY + SH;
        const botY = botScY + SH;
        const vTop = topY + AH / 2;
        const vBot = botY + AH / 2;
        const midY = (vTop + vBot) / 2;

        let topName = '', botName = '', wid = null;
        let topW = false, botW = false, topL = false, botL = false;
        if (r === 0) {
          topName = fmt(slots[mi * 2]);
          botName = fmt(slots[mi * 2 + 1]);
        } else {
          topName = getSlotName(r, mi, true);
          botName = getSlotName(r, mi, false);
        }
        const m = getMatch(r, mi);
        if (m?.winnerId) {
          wid = m.winnerId;
          if (r === 0) {
            topW = slots[mi * 2]?.id === wid; botW = slots[mi * 2 + 1]?.id === wid;
            topL = slots[mi * 2] && !topW; botL = slots[mi * 2 + 1] && !botW;
          } else {
            topW = m.top.athleteId === wid; botW = m.bottom.athleteId === wid;
            topL = m.top.athleteId && !topW; botL = m.bottom.athleteId && !botW;
          }
        }

        const seqTop = r === 0 ? mi * 2 + 1 : 0;
        const seqBot = r === 0 ? mi * 2 + 2 : 0;
        const isBye = (topName === '' && botName !== '') || (topName !== '' && botName === '');

        matchesHTML += `
          <div style="position:absolute;top:${mt}px;left:0;right:0;height:${mh}px">
            <!-- TOP ATHLETE — RED (AKA) -->
            <div style="position:absolute;top:${topY - mt}px;left:0;right:0;height:${AH}px;display:flex;align-items:center;padding-left:3px;gap:3px;background:${topW ? '#b71c1c' : topL ? '#e0e0e0' : topName ? '#C8161A' : '#f5c6c6'};border:1px solid ${topW ? '#4caf50' : '#a00'};overflow:hidden">
              ${seqTop ? `<span style="font-size:8px;color:rgba(255,255,255,0.7);flex-shrink:0;min-width:14px;font-weight:700">${seqTop}</span>` : ''}
              ${topName ? `<span style="width:14px;height:9px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);flex-shrink:0;font-size:6px;display:inline-flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.6)">🏴</span>` : ''}
              <span style="font-size:9px;font-weight:700;color:${topName ? '#fff' : 'rgba(255,255,255,0.5)'};overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex:1">${topName || (r === 0 ? 'BYE' : '')}</span>
              ${topW ? `<span style="font-size:10px;color:#fff;flex-shrink:0;padding-right:4px">✓</span>` : ''}
            </div>
            <!-- SCORE ENTRY BOX (between red and blue) -->
            <div style="position:absolute;top:${topScY - mt}px;left:0;right:0;height:${SH}px;background:#fff8f8;border-left:1px solid #a00;border-right:1px solid #a00"></div>
            <div style="position:absolute;top:${botScY - mt}px;left:0;right:0;height:${SH}px;background:#f8f8ff;border-left:1px solid #00a;border-right:1px solid #00a"></div>
            <!-- BOTTOM ATHLETE — BLUE (AO) -->
            <div style="position:absolute;top:${botY - mt}px;left:0;right:0;height:${AH}px;display:flex;align-items:center;padding-left:3px;gap:3px;background:${botW ? '#0d47a1' : botL ? '#e0e0e0' : botName ? '#1A2EC8' : '#c6d0f5'};border:1px solid ${botW ? '#4caf50' : '#009'};overflow:hidden">
              ${seqBot ? `<span style="font-size:8px;color:rgba(255,255,255,0.7);flex-shrink:0;min-width:14px;font-weight:700">${seqBot}</span>` : ''}
              ${botName ? `<span style="width:14px;height:9px;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);flex-shrink:0;font-size:6px;display:inline-flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.6)">🏴</span>` : ''}
              <span style="font-size:9px;font-weight:700;color:${botName ? '#fff' : 'rgba(255,255,255,0.5)'};overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex:1">${botName || (r === 0 ? 'BYE' : '')}</span>
              ${botW ? `<span style="font-size:10px;color:#fff;flex-shrink:0;padding-right:4px">✓</span>` : ''}
            </div>
            ${!isLast ? `<div style="position:absolute;right:0;top:${vTop - mt}px;height:${vBot - vTop}px;width:1px;background:#777"></div>` : ''}
            ${!isLast ? `<div style="position:absolute;right:${-CG}px;top:${midY - mt}px;height:1px;width:${CG}px;background:#777"></div>` : ''}
          </div>`;
      }

      bracketHTML += `<div style="width:${CW}px;flex-shrink:0">
        <div style="height:16px;background:#1A1A8C;color:#fff;font-size:8px;font-weight:700;text-align:center;display:flex;align-items:center;justify-content:center;letter-spacing:0.5px">${label}</div>
        <div style="position:relative;height:${TH}px">${matchesHTML}</div>
      </div>`;
      if (!isLast) bracketHTML += `<div style="width:${CG}px;flex-shrink:0"></div>`;
    }

    // Winner
    const finalM = getMatch(rounds - 1, 0);
    const winner = finalM?.winnerId ? athleteMap[finalM.winnerId] : null;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${category.name} — ${event.name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif}
body{background:#fff;color:#000;padding:10px}
@page{size:A4 landscape;margin:6mm}
@media print{.np{display:none!important}body{padding:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
#bracket-wrap{transform-origin:top left}
@media screen{body{max-width:297mm}}
</style>
</head>
<body>
<div class="np" style="margin-bottom:8px;display:flex;gap:8px">
  <button onclick="window.print()" style="background:#1A1A8C;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-size:13px;font-weight:700;cursor:pointer">🖨 Print / Save PDF</button>
  <button onclick="window.close()" style="background:#666;color:#fff;border:none;padding:8px 14px;border-radius:4px;font-size:13px;cursor:pointer">✕</button>
</div>
<div style="background:#1A1A8C;color:#fff;padding:5px 10px;display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;border-radius:2px">
  <div>
    <div style="font-size:13px;font-weight:900;letter-spacing:0.3px">${category.name}</div>
    <div style="font-size:9px;opacity:0.8;margin-top:1px">${event.name} · ${event.location} · ${event.date} · ${disciplineLabel[category.discipline] ?? category.discipline}</div>
  </div>
  <div style="text-align:right;font-size:9px">
    <div style="font-size:11px;font-weight:700">Tatami 1 &nbsp;|&nbsp; Pool 1/1</div>
    <div style="opacity:0.7;margin-top:1px">${athletes.length} Athletes · ${size}-Draw</div>
  </div>
</div>
<div style="display:flex;gap:8px;align-items:flex-start">
  <div style="display:flex;gap:0;flex:1;overflow-x:auto">${bracketHTML}</div>
  <div style="width:110px;flex-shrink:0;display:flex;flex-direction:column;gap:5px;padding-top:16px">
    <div style="border:1.5px solid #FFD600;background:#FFFDE7;border-radius:3px;padding:4px 6px">
      <div style="font-size:8px;font-weight:700;color:#777;margin-bottom:1px">🥇 1st Place</div>
      <div style="font-size:9px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-height:12px">${winner ? fmt(winner) : '—'}</div>
    </div>
    <div style="border:1.5px solid #BDBDBD;background:#FAFAFA;border-radius:3px;padding:4px 6px">
      <div style="font-size:8px;font-weight:700;color:#777;margin-bottom:1px">🥈 2nd Place</div>
      <div style="font-size:9px;font-weight:700;min-height:12px">—</div>
    </div>
    <div style="border:1.5px solid #FF8F00;background:#FFF3E0;border-radius:3px;padding:4px 6px">
      <div style="font-size:8px;font-weight:700;color:#777;margin-bottom:1px">🥉 3rd Place</div>
      <div style="font-size:9px;font-weight:700;min-height:12px">—</div>
    </div>
    <div style="border:1.5px solid #FF8F00;background:#FFF3E0;border-radius:3px;padding:4px 6px">
      <div style="font-size:8px;font-weight:700;color:#777;margin-bottom:1px">🥉 3rd Place</div>
      <div style="font-size:9px;font-weight:700;min-height:12px">—</div>
    </div>
    <div style="font-size:8px;color:#888;font-style:italic;text-align:center;margin-top:2px">*Seeded</div>
    <div style="border:1px solid #ccc;border-radius:3px;padding:4px 6px;margin-top:6px">
      <div style="font-size:8px;font-weight:700;color:#666;margin-bottom:3px">Referees:</div>
      <div style="height:13px;border-bottom:1px solid #eee;margin-bottom:2px"></div>
      <div style="height:13px;border-bottom:1px solid #eee;margin-bottom:2px"></div>
      <div style="height:13px"></div>
    </div>
  </div>
</div>
<div style="margin-top:5px;border-top:1px solid #ddd;padding-top:3px;display:flex;justify-content:space-between;font-size:8px;color:#999">
  <span>${event.name}</span>
  <span>${category.name} · ${athletes.length} athletes · ${size}-draw</span>
  <span>FKA Competition System · ${new Date().toLocaleDateString('en-GB')}</span>
</div>
<script>
function scaleBracket(){
  var wrap=document.getElementById('bracket-wrap');
  if(!wrap)return;
  var avail=document.body.clientWidth-130-20; // subtract sidebar + padding
  var bw=wrap.scrollWidth;
  if(bw>avail){wrap.style.transform='scale('+(avail/bw)+')';wrap.style.transformOrigin='top left';wrap.parentElement.style.height=(wrap.scrollHeight*(avail/bw))+'px';}
}
window.addEventListener('load',function(){
  scaleBracket();
  setTimeout(function(){window.print();},1000);
});
</script>
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
