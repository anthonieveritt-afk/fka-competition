'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Athlete { id: number; first_name: string; surname: string; club: string; grade: string | null; ekf_licence: string | null; }
interface MatchSlot { athleteId: number | null; name: string; club: string; }
interface BracketMatch {
  id: string; round: number; matchIndex: number;
  top: MatchSlot; bottom: MatchSlot;
  winnerId: number | null; bye: boolean;
}
interface BracketState { size: number; rounds: number; matches: BracketMatch[]; }
interface Props { event: any; category: any; initialAthletes: Athlete[]; eventId: number; categoryId: number; }

function bracketSize(n: number) { let s = 4; while (s < n) s *= 2; return s; }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Place athletes sequentially, BYEs fill remaining slots — guaranteed one per slot
function buildSlots(athletes: Athlete[], size: number): (Athlete | null)[] {
  const slots: (Athlete | null)[] = new Array(size).fill(null);
  athletes.forEach((a, i) => { slots[i] = a; });
  return slots;
}

function makeSlot(a: Athlete | null): MatchSlot {
  return a ? { athleteId: a.id, name: `${a.first_name} ${a.surname}`, club: a.club } : { athleteId: null, name: 'BYE', club: '' };
}

function buildBracket(slots: (Athlete | null)[]): BracketState {
  const size = slots.length;
  const rounds = Math.log2(size);
  const matches: BracketMatch[] = [];

  // R1: pair consecutive slots
  for (let m = 0; m < size / 2; m++) {
    const top = slots[m * 2]; const bot = slots[m * 2 + 1];
    const isBye = (top === null) !== (bot === null);
    const winnerId = isBye ? (top?.id ?? bot?.id ?? null) : null;
    matches.push({ id: `R0-M${m}`, round: 0, matchIndex: m, top: makeSlot(top), bottom: makeSlot(bot), winnerId, bye: isBye });
  }

  // Later rounds — empty initially
  for (let r = 1; r < rounds; r++) {
    const mc = size / Math.pow(2, r + 1);
    for (let m = 0; m < mc; m++) {
      matches.push({ id: `R${r}-M${m}`, round: r, matchIndex: m, top: { athleteId: null, name: '—', club: '' }, bottom: { athleteId: null, name: '—', club: '' }, winnerId: null, bye: false });
    }
  }

  // Propagate R1 byes into R2
  return propagateByes({ size, rounds, matches });
}

function propagateByes(state: BracketState): BracketState {
  const matches = state.matches.map(m => ({ ...m }));
  for (const m of matches.filter(m => m.round === 0 && m.bye && m.winnerId)) {
    advanceWinner(matches, m.id, m.winnerId!);
  }
  return { ...state, matches };
}

function advanceWinner(matches: BracketMatch[], matchId: string, winnerId: number) {
  const m = matches.find(x => x.id === matchId)!;
  const nextId = `R${m.round + 1}-M${Math.floor(m.matchIndex / 2)}`;
  const next = matches.find(x => x.id === nextId);
  if (!next) return;
  if (m.matchIndex % 2 === 0) next.top = { athleteId: winnerId, name: '', club: '' };
  else next.bottom = { athleteId: winnerId, name: '', club: '' };
  // Auto-bye in next round
  if (next.top.athleteId && !next.bottom.athleteId) { next.winnerId = next.top.athleteId; next.bye = true; }
  if (!next.top.athleteId && next.bottom.athleteId) { next.winnerId = next.bottom.athleteId; next.bye = true; }
}

function resolveNames(state: BracketState, map: Record<number, Athlete>): BracketState {
  return {
    ...state,
    matches: state.matches.map(m => ({
      ...m,
      top: m.top.athleteId && map[m.top.athleteId] ? { ...m.top, name: `${map[m.top.athleteId].first_name} ${map[m.top.athleteId].surname}`, club: map[m.top.athleteId].club } : m.top,
      bottom: m.bottom.athleteId && map[m.bottom.athleteId] ? { ...m.bottom, name: `${map[m.bottom.athleteId].first_name} ${map[m.bottom.athleteId].surname}`, club: map[m.bottom.athleteId].club } : m.bottom,
    }))
  };
}

// ─── BRACKET RENDERER ──────────────────────────────────────────────────
const SH = 30; // slot height px
const SW = 170; // slot width px
const COL_GAP = 28; // gap between columns for connector lines

function BracketRenderer({ bracket, athleteMap, onWinner }: {
  bracket: BracketState;
  athleteMap: Record<number, Athlete>;
  onWinner: (matchId: string, winnerId: number) => void;
}) {
  const totalH = bracket.size * SH; // total pixel height

  const columns: React.ReactNode[] = [];

  for (let r = 0; r < bracket.rounds; r++) {
    const rMatches = bracket.matches.filter(m => m.round === r).sort((a, b) => a.matchIndex - b.matchIndex);
    const matchH = totalH / rMatches.length; // height per match in this round
    const slotOffset = (matchH - SH * 2) / 2; // padding above top slot within match

    const roundLabel = r === 0 ? 'Round 1' : r === bracket.rounds - 1 ? 'Final' : r === bracket.rounds - 2 ? 'Semi-Final' : r === bracket.rounds - 3 ? 'Quarter-Final' : `Round ${r + 1}`;

    const matchEls = rMatches.map(m => {
      const topY = m.matchIndex * matchH + slotOffset;
      const botY = topY + SH;
      const midY = topY + SH + (botY - topY) / 2; // midpoint between slots
      const canPlay = !m.winnerId && !m.bye && m.top.athleteId && m.bottom.athleteId;
      const topName = m.top.athleteId ? (athleteMap[m.top.athleteId] ? `${athleteMap[m.top.athleteId].first_name} ${athleteMap[m.top.athleteId].surname}` : m.top.name) : (r === 0 ? 'BYE' : '—');
      const botName = m.bottom.athleteId ? (athleteMap[m.bottom.athleteId] ? `${athleteMap[m.bottom.athleteId].first_name} ${athleteMap[m.bottom.athleteId].surname}` : m.bottom.name) : (r === 0 ? 'BYE' : '—');

      const slotStyle = (isTop: boolean): React.CSSProperties => {
        const slot = isTop ? m.top : m.bottom;
        const isWinner = m.winnerId && slot.athleteId === m.winnerId;
        const isLoser = m.winnerId && slot.athleteId && slot.athleteId !== m.winnerId;
        return {
          position: 'absolute', left: 0, width: SW, height: SH,
          top: isTop ? topY : botY,
          background: isWinner ? '#d4edda' : isLoser ? '#f8d7da' : (!slot.athleteId ? '#f8f8f8' : '#fff'),
          border: `1px solid ${isWinner ? '#28a745' : isLoser ? '#dc3545' : '#bbb'}`,
          display: 'flex', alignItems: 'center', padding: '0 6px',
          cursor: canPlay && slot.athleteId ? 'pointer' : 'default',
          boxSizing: 'border-box', overflow: 'hidden',
          fontSize: 11, fontWeight: slot.athleteId && !m.bye ? 600 : 400,
          color: slot.athleteId ? '#000' : '#aaa',
          gap: 4,
        };
      };

      return (
        <g key={m.id}>
          {/* Top slot */}
          <foreignObject x={0} y={topY} width={SW} height={SH}>
            <div
              style={slotStyle(true)}
              onClick={() => canPlay && m.top.athleteId && onWinner(m.id, m.top.athleteId)}
              title={canPlay && m.top.athleteId ? `✓ ${topName} wins` : ''}
            >
              {m.winnerId === m.top.athleteId && m.top.athleteId && <span style={{ color: '#28a745', flexShrink: 0 }}>✓</span>}
              {m.winnerId && m.top.athleteId && m.winnerId !== m.top.athleteId && <span style={{ color: '#dc3545', flexShrink: 0 }}>✗</span>}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topName}</span>
            </div>
          </foreignObject>

          {/* Bottom slot */}
          <foreignObject x={0} y={botY} width={SW} height={SH}>
            <div
              style={slotStyle(false)}
              onClick={() => canPlay && m.bottom.athleteId && onWinner(m.id, m.bottom.athleteId)}
              title={canPlay && m.bottom.athleteId ? `✓ ${botName} wins` : ''}
            >
              {m.winnerId === m.bottom.athleteId && m.bottom.athleteId && <span style={{ color: '#28a745', flexShrink: 0 }}>✓</span>}
              {m.winnerId && m.bottom.athleteId && m.winnerId !== m.bottom.athleteId && <span style={{ color: '#dc3545', flexShrink: 0 }}>✗</span>}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{botName}</span>
            </div>
          </foreignObject>

          {/* Connecting lines (right side) */}
          {r < bracket.rounds - 1 && (
            <>
              {/* Vertical line connecting top and bottom slots */}
              <line x1={SW} y1={topY + SH / 2} x2={SW} y2={botY + SH / 2} stroke="#bbb" strokeWidth={1} />
              {/* Horizontal line to next column */}
              <line x1={SW} y1={topY + SH / 2 + (botY - topY) / 2} x2={SW + COL_GAP} y2={topY + SH / 2 + (botY - topY) / 2} stroke="#bbb" strokeWidth={1} />
            </>
          )}
        </g>
      );
    });

    columns.push(
      <g key={r} transform={`translate(${r * (SW + COL_GAP)}, 0)`}>
        {/* Column header */}
        <foreignObject x={0} y={-24} width={SW} height={22}>
          <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#0066cc', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '2px solid #0066cc', paddingBottom: 2 }}>
            {roundLabel}
          </div>
        </foreignObject>
        {matchEls}
      </g>
    );
  }

  // Medal boxes
  const totalCols = bracket.rounds;
  const medalX = totalCols * (SW + COL_GAP) + 20;
  const finalMatch = bracket.matches.find(m => m.round === bracket.rounds - 1);
  const winnerId = finalMatch?.winnerId;
  const winner = winnerId ? athleteMap[winnerId] : null;

  const medals = [
    { pos: 1, label: '🥇 1st Place', color: '#FFD700', bg: '#FFFDE7', name: winner ? `${winner.first_name} ${winner.surname}` : '—' },
    { pos: 2, label: '🥈 2nd Place', color: '#C0C0C0', bg: '#FAFAFA', name: '—' },
    { pos: 3, label: '🥉 3rd Place', color: '#CD7F32', bg: '#FFF8F0', name: '—' },
    { pos: 4, label: '🥉 3rd Place', color: '#CD7F32', bg: '#FFF8F0', name: '—' },
  ];

  columns.push(
    <g key="medals" transform={`translate(${medalX}, ${totalH / 2 - 100})`}>
      <foreignObject x={0} y={-24} width={140} height={22}>
        <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Results</div>
      </foreignObject>
      {medals.map((med, i) => (
        <foreignObject key={i} x={0} y={i * 52} width={140} height={48}>
          <div style={{ background: med.bg, border: `2px solid ${med.color}`, borderRadius: 6, padding: '6px 10px', boxSizing: 'border-box', height: '100%' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: med.color === '#FFD700' ? '#997700' : med.color === '#C0C0C0' ? '#666' : '#8B4513' }}>{med.label}</div>
            <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{med.name}</div>
          </div>
        </foreignObject>
      ))}
    </g>
  );

  const svgW = totalCols * (SW + COL_GAP) + 180;
  const svgH = totalH + 40;

  return (
    <svg width={svgW} height={svgH} style={{ display: 'block', minWidth: svgW }}>
      <g transform="translate(0, 30)">{columns}</g>
    </svg>
  );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────
export default function BracketDraw({ event, category, initialAthletes, eventId, categoryId }: Props) {
  const size = bracketSize(initialAthletes.length);
  const athleteMap: Record<number, Athlete> = {};
  initialAthletes.forEach(a => { athleteMap[a.id] = a; });

  const [seeds, setSeeds] = useState<(Athlete | null)[]>(() => buildSlots(initialAthletes, size));
  const [bracket, setBracket] = useState<BracketState | null>(null);
  const [locked, setLocked] = useState(false);
  const [phase, setPhase] = useState<'seed' | 'play'>('seed');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/bracket-state/${categoryId}?eventId=${eventId}`)
      .then(r => r.json()).then(d => {
        if (d.state) { setBracket(d.state); setLocked(d.locked ?? false); setPhase('play'); }
      }).catch(() => {});
  }, [categoryId, eventId]);

  const save = useCallback(async (state: BracketState, lk: boolean, logWinners = false) => {
    setSaving(true);
    try {
      const resolved = resolveNames(state, athleteMap);
      const body: any = { eventId, state: resolved, locked: lk };
      if (logWinners) {
        const finalM = resolved.matches.find(m => m.round === resolved.rounds - 1);
        const sfMs = resolved.matches.filter(m => m.round === resolved.rounds - 2);
        const results: any[] = [];
        if (finalM?.winnerId) results.push({ athleteId: finalM.winnerId, position: 1, medal: 'gold', eventName: event.name, eventDate: event.date, categoryName: category.name });
        const r2id = finalM ? (finalM.top.athleteId === finalM.winnerId ? finalM.bottom.athleteId : finalM.top.athleteId) : null;
        if (r2id) results.push({ athleteId: r2id, position: 2, medal: 'silver', eventName: event.name, eventDate: event.date, categoryName: category.name });
        sfMs.forEach(m => { const l = m.winnerId ? (m.top.athleteId === m.winnerId ? m.bottom.athleteId : m.top.athleteId) : null; if (l) results.push({ athleteId: l, position: 3, medal: 'bronze', eventName: event.name, eventDate: event.date, categoryName: category.name }); });
        body.logWinners = true; body.state = { ...body.state, results };
      }
      await fetch(`/api/bracket-state/${categoryId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }, [categoryId, eventId, athleteMap, event, category]);

  const startBracket = () => {
    const b = resolveNames(buildBracket(seeds), athleteMap);
    setBracket(b); setPhase('play'); setLocked(true);
    save(b, true);
  };

  const doShuffle = () => setSeeds(buildSlots(shuffle(initialAthletes), size));

  const handleWinner = useCallback((matchId: string, winnerId: number) => {
    setBracket(prev => {
      if (!prev) return prev;
      const matches = prev.matches.map(m => ({ ...m }));
      const m = matches.find(x => x.id === matchId)!;
      m.winnerId = winnerId;
      advanceWinner(matches, matchId, winnerId);
      const next = resolveNames({ ...prev, matches }, athleteMap);
      save(next, locked);
      return next;
    });
  }, [athleteMap, locked, save]);

  const finalMatch = bracket?.matches.find(m => m.round === (bracket.rounds - 1));
  const winner = finalMatch?.winnerId ? athleteMap[finalMatch.winnerId] : null;

  return (
    <div style={{ minHeight: '100vh', background: '#f0f0f0', fontFamily: 'Arial, sans-serif' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; }
          @page { size: A4 landscape; margin: 6mm; }
          svg foreignObject div { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{ background: '#0a0a0a', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link href={`/admin/events/${eventId}`} style={{ color: '#0066cc', fontSize: 13, textDecoration: 'none' }}>← Event</Link>
        <span style={{ color: '#f5f5f5', fontSize: 13, fontWeight: 700 }}>{category.name}</span>
        <span style={{ color: '#666', fontSize: 12 }}>{initialAthletes.length} athletes → {size}-bracket</span>
        {saving && <span style={{ color: '#888', fontSize: 12, marginLeft: 8 }}>Saving…</span>}
        {saved && <span style={{ color: '#22c55e', fontSize: 12 }}>✓ Saved</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {phase === 'seed' && (<>
            <button onClick={doShuffle} style={{ background: '#f59e0b', color: '#000', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🔀 Shuffle</button>
            <button onClick={startBracket} style={{ background: '#22c55e', color: '#000', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>▶ Start Bracket</button>
          </>)}
          {phase === 'play' && (<>
            {winner && <button onClick={() => save(bracket!, locked, true)} style={{ background: '#22c55e', color: '#000', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>💾 Log Results</button>}
            <button onClick={() => { setPhase('seed'); setBracket(null); setSeeds(buildSlots(initialAthletes, size)); }} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>↺ Reset</button>
          </>)}
          <button onClick={() => window.print()} style={{ background: '#0066cc', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🖨 Print</button>
        </div>
      </div>

      {/* Seed phase */}
      {phase === 'seed' && (
        <div style={{ display: 'flex' }}>
          <div style={{ width: 260, background: '#1a1a1a', padding: '14px 10px', minHeight: 'calc(100vh - 50px)', overflowY: 'auto' }}>
            <div style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>↕ Drag to reorder</div>
            {seeds.map((a, i) => (
              <div key={i} draggable={!!a}
                onDragStart={() => a && setDragFrom(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => { if (dragFrom !== null && dragFrom !== i) { const s = [...seeds]; [s[dragFrom], s[i]] = [s[i], s[dragFrom]]; setSeeds(s); } setDragFrom(null); }}
                style={{ background: a ? '#1e1e1e' : '#111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 5, padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 6, cursor: a ? 'grab' : 'default', marginBottom: 2, opacity: a ? 1 : 0.3 }}
              >
                <span style={{ color: '#444', fontSize: 10, fontWeight: 700, minWidth: 20 }}>{i + 1}</span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ color: a ? '#f5f5f5' : '#444', fontSize: 12, fontWeight: a ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a ? `${a.first_name} ${a.surname}` : 'BYE'}</div>
                  {a && <div style={{ color: '#555', fontSize: 10 }}>{a.club}</div>}
                </div>
              </div>
            ))}
            <button onClick={startBracket} style={{ marginTop: 14, width: '100%', background: '#22c55e', color: '#000', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>▶ Confirm & Start</button>
          </div>
          <div style={{ flex: 1, padding: 20 }}>
            <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>Drag names on the left to adjust seeding. Each position has exactly one athlete or BYE. Click <strong>Start Bracket</strong> when ready.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 5 }}>
              {seeds.map((a, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 4, padding: '5px 10px', display: 'flex', gap: 8, alignItems: 'center', opacity: a ? 1 : 0.4 }}>
                  <span style={{ color: '#aaa', fontSize: 11, fontWeight: 700, minWidth: 24 }}>#{i + 1}</span>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: a ? '#000' : '#bbb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a ? `${a.first_name} ${a.surname}` : 'BYE'}</div>
                    {a && <div style={{ fontSize: 10, color: '#888' }}>{a.club}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Play phase */}
      {phase === 'play' && bracket && (
        <div style={{ padding: '20px', overflowX: 'auto' }}>
          {/* Print header */}
          <div style={{ background: '#1A1A8C', color: '#fff', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderRadius: 4 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900 }}>{category.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{event.name} · {event.location} · {event.date}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11 }}>
              <div style={{ fontWeight: 700 }}>{initialAthletes.length} Athletes · {size}-Draw</div>
              <div className="no-print" style={{ color: 'rgba(255,255,255,0.6)', marginTop: 2, fontSize: 10 }}>Click an athlete name to advance them as winner</div>
            </div>
          </div>
          <BracketRenderer bracket={bracket} athleteMap={athleteMap} onWinner={handleWinner} />
          <div style={{ borderTop: '1px solid #ccc', marginTop: 16, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888' }}>
            <span>{event.name} · {category.name}</span>
            <span>Printed: {new Date().toLocaleDateString('en-GB')}</span>
            <span>FKA Competition System</span>
          </div>
        </div>
      )}
    </div>
  );
}
