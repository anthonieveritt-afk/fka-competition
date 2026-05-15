import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';
const fmt = (a: any) => `${a.first_name} ${a.surname}`;

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string; categoryId: string }> }) {
  const { id, categoryId } = await props.params;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const [evRes, catRes, athRes, scoreRes] = await Promise.all([
      client.query('SELECT * FROM comp_events WHERE id=$1', [id]),
      client.query('SELECT * FROM comp_categories WHERE id=$1', [categoryId]),
      client.query(`
        SELECT a.id, a.first_name, a.surname, a.club
        FROM comp_athletes a
        JOIN comp_registrations r ON r.athlete_id = a.id
        WHERE r.category_id=$1 AND r.event_id=$2
        ORDER BY a.surname, a.first_name
      `, [categoryId, id]),
      client.query(`
        SELECT * FROM comp_wuko_scores
        WHERE category_id=$1 AND event_id=$2
      `, [categoryId, id]).catch(() => ({ rows: [] })),
    ]);

    if (!evRes.rows[0] || !catRes.rows[0]) {
      return new NextResponse('Not found', { status: 404 });
    }

    const event = evRes.rows[0];
    const category = catRes.rows[0];
    const athletes = athRes.rows;
    const scores = scoreRes.rows as any[];

    const scoreMap: Record<string, any> = {};
    scores.forEach(s => { scoreMap[`${s.athlete_id}_${s.round}`] = s; });

    const calcTotal = (j1: any, j2: any, j3: any, j4: any): string => {
      const vals = [j1, j2, j3, j4].map(Number).filter(n => !isNaN(n) && n >= 5 && n <= 9.9);
      if (vals.length < 4) return '';
      const sorted = [...vals].sort((a, b) => a - b);
      return (sorted[1] + sorted[2]).toFixed(2);
    };

    // Build prelim rows with totals + ranks
    const prelimRows = athletes.map(a => {
      const s = scoreMap[`${a.id}_prelim`];
      const j1 = s?.j1, j2 = s?.j2, j3 = s?.j3, j4 = s?.j4;
      const total = calcTotal(j1, j2, j3, j4);
      return { ...a, j1, j2, j3, j4, total: total ? parseFloat(total) : 0, totalFmt: total };
    }).sort((a, b) => b.total - a.total);

    const top4ids = new Set(prelimRows.slice(0, 4).filter(r => r.total > 0).map(r => r.id));

    const finalRows = athletes
      .filter(a => top4ids.has(a.id))
      .map(a => {
        const s = scoreMap[`${a.id}_final`];
        const j1 = s?.j1, j2 = s?.j2, j3 = s?.j3, j4 = s?.j4;
        const total = calcTotal(j1, j2, j3, j4);
        return { ...a, j1, j2, j3, j4, total: total ? parseFloat(total) : 0, totalFmt: total };
      }).sort((a, b) => b.total - a.total);

    const boxStyle = 'width:44px;height:22px;border:2px solid #000;border-radius:2px;display:inline-block;text-align:center;font-size:11px;font-weight:700;line-height:22px;color:#000';
    const emptyBox = (val: any) => val != null ? `<span style="${boxStyle}">${Number(val).toFixed(1)}</span>` : `<span style="${boxStyle}"></span>`;

    const buildTable = (rows: any[], round: 'prelim' | 'final') => {
      if (rows.length === 0) return '<p style="color:#aaa;font-size:11px;padding:8px">No athletes.</p>';
      return `
        <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif">
          <thead>
            <tr style="background:#1a1a1a;color:#fff">
              <th style="padding:5px 8px;font-size:8px;font-weight:700;text-align:left;width:22px">#</th>
              <th style="padding:5px 8px;font-size:8px;font-weight:700;text-align:left">Name</th>
              <th style="padding:5px 8px;font-size:8px;font-weight:700;text-align:left">Club</th>
              <th style="padding:5px 8px;font-size:8px;font-weight:700;text-align:center">Judge 1</th>
              <th style="padding:5px 8px;font-size:8px;font-weight:700;text-align:center">Judge 2</th>
              <th style="padding:5px 8px;font-size:8px;font-weight:700;text-align:center">Judge 3</th>
              <th style="padding:5px 8px;font-size:8px;font-weight:700;text-align:center">Judge 4</th>
              <th style="padding:5px 8px;font-size:8px;font-weight:700;text-align:center;background:#2a2a2a">Total</th>
              <th style="padding:5px 8px;font-size:8px;font-weight:700;text-align:center">Rank</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((a, i) => {
              const isTop4 = round === 'prelim' && top4ids.has(a.id) && a.total > 0;
              const rank = a.total > 0 ? i + 1 : '';
              const medal = round === 'final' && a.total > 0 ? ['🥇','🥈','🥉','🥉'][i] ?? '' : '';
              return `
                <tr style="border-bottom:1px solid #ddd;background:${isTop4 ? '#f0fff4' : '#fff'}">
                  <td style="padding:5px 8px;font-size:10px;color:#999;text-align:center">${i + 1}</td>
                  <td style="padding:5px 8px;font-size:12px;font-weight:700;color:#000">${fmt(a)}</td>
                  <td style="padding:5px 8px;font-size:10px;color:#555">${a.club}</td>
                  <td style="padding:5px 8px;text-align:center">${emptyBox(a.j1)}</td>
                  <td style="padding:5px 8px;text-align:center">${emptyBox(a.j2)}</td>
                  <td style="padding:5px 8px;text-align:center">${emptyBox(a.j3)}</td>
                  <td style="padding:5px 8px;text-align:center">${emptyBox(a.j4)}</td>
                  <td style="padding:5px 8px;text-align:center;background:#fafafa">
                    ${a.totalFmt ? `<span style="font-size:13px;font-weight:900;color:#000">${a.totalFmt}</span>` : `<span style="width:54px;height:22px;border:2px solid #000;border-radius:2px;display:inline-block"></span>`}
                  </td>
                  <td style="padding:5px 8px;text-align:center;font-size:14px">
                    ${medal || (rank ? `<span style="font-weight:700;color:${isTop4 ? '#16a34a' : '#333'}">${rank}</span>` : '')}
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>`;
    };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${category.name} — WUKO Scoring</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif}
body{background:#fff;color:#000;padding:8mm}
@page{size:A4 portrait;margin:6mm}
@media print{.np{display:none!important}body{padding:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>

<div class="np" style="margin-bottom:10px;display:flex;gap:8px">
  <button onclick="window.print()" style="background:#1a1a8c;color:#fff;border:none;padding:8px 20px;border-radius:4px;font-size:13px;font-weight:700;cursor:pointer">🖨 Print / Save PDF</button>
  <button onclick="window.close()" style="background:#666;color:#fff;border:none;padding:8px 14px;border-radius:4px;font-size:13px;cursor:pointer">✕</button>
</div>

<!-- Header -->
<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #1a1a1a;padding-bottom:6px;margin-bottom:10px">
  <div style="display:flex;align-items:center;gap:10px">
    <img src="/jhka-logo.jpg" alt="JHKA" style="height:44px;width:auto;border-radius:3px"/>
    <div>
      <div style="font-size:16px;font-weight:900;color:#1a1a1a">J Honeywood Karate Academy</div>
      <div style="font-size:9px;color:#555">www.jhka.co.uk</div>
    </div>
  </div>
  <div style="text-align:center">
    <div style="font-size:14px;font-weight:900;color:#1a1a1a">${category.name}</div>
    <div style="font-size:9px;color:#555;margin-top:2px">WUKO Kata Scoring · ${event.name} · ${event.date}</div>
    <div style="margin-top:4px;display:inline-block;background:#7c3aed;color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px">WUKO FORMAT</div>
  </div>
  <div style="text-align:right;font-size:9px;color:#555">
    <div>Scoring: 4 judges · 5.0–9.9</div>
    <div>Drop highest &amp; lowest</div>
    <div>Sum middle 2</div>
    <div style="margin-top:4px">Top 4 advance to Final</div>
  </div>
</div>

<!-- Preliminary Round -->
<div style="margin-bottom:14px">
  <div style="background:#1a1a1a;color:#fff;padding:5px 10px;font-size:11px;font-weight:900;letter-spacing:0.5px;border-radius:3px 3px 0 0;display:flex;justify-content:space-between;align-items:center">
    <span>PRELIMINARY ROUND</span>
    <span style="font-size:9px;font-weight:400;opacity:0.7">${athletes.length} competitors · Top 4 advance (highlighted)</span>
  </div>
  ${buildTable(prelimRows, 'prelim')}
</div>

<!-- Final Round -->
<div style="page-break-inside:avoid">
  <div style="background:#7c3aed;color:#fff;padding:5px 10px;font-size:11px;font-weight:900;letter-spacing:0.5px;border-radius:3px 3px 0 0;display:flex;justify-content:space-between;align-items:center">
    <span>FINAL ROUND — TOP 4</span>
    <span style="font-size:9px;font-weight:400;opacity:0.7">Same scoring rules · Highest total wins</span>
  </div>
  ${buildTable(finalRows.length > 0 ? finalRows : athletes.slice(0, 4).map(a => ({ ...a, j1: null, j2: null, j3: null, j4: null, total: 0, totalFmt: '' })), 'final')}
</div>

<!-- Results summary -->
<div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">
  ${[['🥇','1st','#FFD700'],['🥈','2nd','#C0C0C0'],['🥉','3rd (a)','#CD7F32'],['🥉','3rd (b)','#CD7F32']].map(([medal, pos, col]) => `
    <div style="flex:1;min-width:100px;border:2px solid ${col};border-radius:6px;padding:6px 10px">
      <div style="font-size:10px;font-weight:700;color:#555">${medal} ${pos}</div>
      <div style="font-size:12px;font-weight:900;min-height:16px;margin-top:2px;border-bottom:1px solid #eee;padding-bottom:3px">
        ${finalRows.length > 0 && finalRows[[1,2,3,4].indexOf(parseInt(pos)) === -1 ? 0 : [0,1,2,3][[1,2,3,4].indexOf(parseInt(pos))]]?.totalFmt ? finalRows[[0,1,2,3][[0,1,2,3].indexOf([0,1,2,3][[1,2,3,4].indexOf(parseInt(pos))])]]?.totalFmt ?? '' : ''}
      </div>
    </div>`).join('')}
</div>

<!-- Footer -->
<div style="margin-top:8px;border-top:1px solid #ddd;padding-top:4px;display:flex;justify-content:space-between;font-size:7px;color:#aaa">
  <span>${event.name} · ${event.date}</span>
  <span>${category.name} · WUKO Format · ${athletes.length} athletes</span>
  <span>FKA Competition System · ${new Date().toLocaleDateString('en-GB')}</span>
</div>

</body>
</html>`;

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } finally {
    client.release();
    await pool.end();
  }
}
