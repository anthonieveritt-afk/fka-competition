'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Athlete { id: number; first_name: string; surname: string; club: string; grade: string | null; ekf_licence: string | null; }

interface MatchSlot {
  athleteId: number | null; // null = BYE
  name: string; // display name
  club: string;
}

interface BracketMatch {
  id: string; // "R0-M0", "R1-M0" etc
  round: number; matchIndex: number;
  top: MatchSlot; bottom: MatchSlot;
  winnerId: number | null; // null = not played
  bye: boolean; // auto-advance if one side is BYE
}

interface BracketState {
  size: number; rounds: number;
  matches: BracketMatch[];
}

interface Props {
  event: any; category: any; initialAthletes: Athlete[];
  eventId: number; categoryId: number;
}

function bracketSize(n: number) { let s = 4; while (s < n) s *= 2; return s; }

// Spread athletes evenly across bracket with BYEs distributed throughout
function spreadAthletes(athletes: Athlete[], size: number): (Athlete | null)[] {
  const slots: (Athlete | null)[] = new Array(size).fill(null);
  // Use Bresenham-style distribution so BYEs are evenly spread
  athletes.forEach((a, i) => {
    const pos = Math.floor((i * size) / athletes.length);
    // Find nearest empty slot
    let p = pos;
    while (p < size && slots[p] !== null) p++;
    if (p < size) slots[p] = a;
    else {
      p = pos;
      while (p >= 0 && slots[p] !== null) p--;
      if (p >= 0) slots[p] = a;
    }
  });
  return slots;
}

function buildBracket(slots: (Athlete | null)[]): BracketState {
  const size = slots.length;
  const rounds = Math.log2(size);
  const matches: BracketMatch[] = [];

  // Round 0 (R1): pair up all slots
  for (let m = 0; m < size / 2; m++) {
    const top = slots[m * 2];
    const bot = slots[m * 2 + 1];
    const isBye = (!top && !!bot) || (!!top && !bot);
    const winnerId = isBye ? (top ? top.id : bot ? bot.id : null) : null;
    matches.push({
      id: `R0-M${m}`, round: 0, matchIndex: m,
      top: { athleteId: top?.id ?? null, name: top ? `${top.first_name} ${top.surname}` : 'BYE', club: top?.club ?? '' },
      bottom: { athleteId: bot?.id ?? null, name: bot ? `${bot.first_name} ${bot.surname}` : 'BYE', club: bot?.club ?? '' },
      winnerId, bye: isBye,
    });
  }

  // Subsequent rounds — empty initially, filled by winners
  for (let r = 1; r < rounds; r++) {
    const matchCount = size / Math.pow(2, r + 1);
    for (let m = 0; m < matchCount; m++) {
      // Check if we can fill from previous round
      const prevTopId = `R${r - 1}-M${m * 2}`;
      const prevBotId = `R${r - 1}-M${m * 2 + 1}`;
      const prevTop = matches.find(x => x.id === prevTopId);
      const prevBot = matches.find(x => x.id === prevBotId);
      const topWinnerId = prevTop?.winnerId ?? null;
      const botWinnerId = prevBot?.winnerId ?? null;
      matches.push({
        id: `R${r}-M${m}`, round: r, matchIndex: m,
        top: { athleteId: topWinnerId, name: '—', club: '' },
        bottom: { athleteId: botWinnerId, name: '—', club: '' },
        winnerId: null, bye: false,
      });
    }
  }

  return { size, rounds, matches };
}

// Resolve names in later rounds from athlete list
function resolveNames(state: BracketState, athleteMap: Record<number, Athlete>): BracketState {
  return {
    ...state,
    matches: state.matches.map(m => ({
      ...m,
      top: m.top.athleteId
        ? { ...m.top, name: athleteMap[m.top.athleteId] ? `${athleteMap[m.top.athleteId].first_name} ${athleteMap[m.top.athleteId].surname}` : m.top.name, club: athleteMap[m.top.athleteId]?.club ?? '' }
        : m.top,
      bottom: m.bottom.athleteId
        ? { ...m.bottom, name: athleteMap[m.bottom.athleteId] ? `${athleteMap[m.bottom.athleteId].first_name} ${athleteMap[m.bottom.athleteId].surname}` : m.bottom.name, club: athleteMap[m.bottom.athleteId]?.club ?? '' }
        : m.bottom,
    })),
  };
}

// Propagate winner to next round
function propagateWinner(state: BracketState, matchId: string, winnerId: number): BracketState {
  const matches = state.matches.map(m => m.id === matchId ? { ...m, winnerId } : { ...m });
  const match = matches.find(m => m.id === matchId)!;
  const r = match.round; const mi = match.matchIndex;
  const nextRound = r + 1; const nextMatchIndex = Math.floor(mi / 2);
  const isTop = mi % 2 === 0;
  const nextId = `R${nextRound}-M${nextMatchIndex}`;
  const nextMatch = matches.find(m => m.id === nextId);
  if (nextMatch) {
    if (isTop) nextMatch.top = { athleteId: winnerId, name: '', club: '' };
    else nextMatch.bottom = { athleteId: winnerId, name: '', club: '' };
    // Check if nextMatch is a bye
    if (nextMatch.top.athleteId && !nextMatch.bottom.athleteId) { nextMatch.winnerId = nextMatch.top.athleteId; nextMatch.bye = true; }
    if (!nextMatch.top.athleteId && nextMatch.bottom.athleteId) { nextMatch.winnerId = nextMatch.bottom.athleteId; nextMatch.bye = true; }
  }
  return { ...state, matches };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export default function BracketDraw({ event, category, initialAthletes, eventId, categoryId }: Props) {
  const size = bracketSize(initialAthletes.length);
  const athleteMap: Record<number, Athlete> = {};
  initialAthletes.forEach(a => { athleteMap[a.id] = a; });

  const [seeds, setSeeds] = useState<(Athlete | null)[]>(() => spreadAthletes(initialAthletes, size));
  const [bracket, setBracket] = useState<BracketState | null>(null);
  const [locked, setLocked] = useState(false);
  const [phase, setPhase] = useState<'seed' | 'play'>('seed');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  // Load saved state
  useEffect(() => {
    fetch(`/api/bracket-state/${categoryId}?eventId=${eventId}`)
      .then(r => r.json()).then(d => {
        if (d.state) {
          setBracket(d.state);
          setLocked(d.locked ?? false);
          setPhase('play');
        }
      }).catch(() => {});
  }, [categoryId, eventId]);

  const save = useCallback(async (state: BracketState | null, lk: boolean, log = false) => {
    if (!state) return;
    setSaving(true);
    try {
      const resolved = resolveNames(state, athleteMap);
      const body: any = { eventId, state: resolved, locked: lk };
      if (log) {
        const finalMatch = resolved.matches.find(m => m.round === resolved.rounds - 1 && m.matchIndex === 0);
        const sfMatches = resolved.matches.filter(m => m.round === resolved.rounds - 2);
        const results = [];
        if (finalMatch?.winnerId) results.push({ athleteId: finalMatch.winnerId, position: 1, medal: 'gold', eventName: event.name, eventDate: event.date, categoryName: category.name });
        const finalLoserId = finalMatch?.top.athleteId === finalMatch?.winnerId ? finalMatch?.bottom.athleteId : finalMatch?.top.athleteId;
        if (finalLoserId) results.push({ athleteId: finalLoserId, position: 2, medal: 'silver', eventName: event.name, eventDate: event.date, categoryName: category.name });
        sfMatches.forEach(m => {
          const loserId = m.winnerId ? (m.top.athleteId === m.winnerId ? m.bottom.athleteId : m.top.athleteId) : null;
          if (loserId) results.push({ athleteId: loserId, position: 3, medal: 'bronze', eventName: event.name, eventDate: event.date, categoryName: category.name });
        });
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

  const doShuffle = () => {
    setSeeds(spreadAthletes(shuffle(initialAthletes), size));
  };

  const setWinner = (matchId: string, winnerId: number) => {
    if (locked && phase === 'seed') return;
    setBracket(prev => {
      if (!prev) return prev;
      const next = propagateWinner(prev, matchId, winnerId);
      const resolved = resolveNames(next, athleteMap);
      save(resolved, locked);
      return resolved;
    });
  };

  const SLOT_H = 34;
  const ROUND_W = 180;

  // Medal colour
  const getSlotBg = (m: BracketMatch, isTop: boolean) => {
    const slot = isTop ? m.top : m.bottom;
    if (m.winnerId && slot.athleteId === m.winnerId) return '#e8f5e9'; // winner = light green
    if (m.winnerId && slot.athleteId !== m.winnerId && slot.athleteId) return '#fce4e4'; // loser = light red
    if (!slot.athleteId) return '#f8f8f8'; // bye/empty
    return '#fff';
  };

  const renderRounds = () => {
    if (!bracket) return null;
    const cols: React.ReactNode[] = [];
    for (let r = 0; r < bracket.rounds; r++) {
      const rMatches = bracket.matches.filter(m => m.round === r).sort((a, b) => a.matchIndex - b.matchIndex);
      const slotsPerMatch = Math.pow(2, r + 1);
      const matchH = slotsPerMatch * (SLOT_H + 2);
      const innerPad = (matchH - SLOT_H * 2 - 4) / 2;
      const label = r === 0 ? `Round 1` : r === bracket.rounds - 1 ? 'Final' : r === bracket.rounds - 2 ? 'Semi-Final' : r === bracket.rounds - 3 ? 'Quarter-Final' : `Round ${r + 1}`;

      cols.push(
        <div key={r} style={{ display: 'flex', flexDirection: 'column', width: ROUND_W, flexShrink: 0, marginLeft: r === 0 ? 0 : 24 }}>
          <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#0066cc', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, paddingBottom: 4, borderBottom: '2px solid #0066cc' }}>{label}</div>
          {rMatches.map(m => {
            const canPlay = !m.winnerId && !m.bye && m.top.athleteId && m.bottom.athleteId;
            return (
              <div key={m.id} style={{ height: matchH, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', paddingTop: innerPad, paddingBottom: innerPad }}>
                {/* Top slot */}
                <div
                  onClick={() => canPlay && m.top.athleteId && setWinner(m.id, m.top.athleteId)}
                  style={{
                    height: SLOT_H, background: getSlotBg(m, true), border: `1px solid ${m.winnerId && m.top.athleteId === m.winnerId ? '#22c55e' : m.winnerId && m.top.athleteId ? '#ef4444' : '#ccc'}`,
                    display: 'flex', alignItems: 'center', padding: '0 6px', gap: 4,
                    cursor: canPlay && m.top.athleteId ? 'pointer' : 'default',
                    borderRadius: '3px 0 0 3px', boxSizing: 'border-box', overflow: 'hidden',
                  }}
                  title={canPlay ? `Click to make ${m.top.name} winner` : ''}
                >
                  {m.winnerId && m.top.athleteId === m.winnerId && <span style={{ color: '#22c55e', fontSize: 12 }}>✓</span>}
                  {m.winnerId && m.top.athleteId !== m.winnerId && m.top.athleteId && <span style={{ color: '#ef4444', fontSize: 12 }}>✗</span>}
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 11, fontWeight: m.top.athleteId ? 600 : 400, color: m.top.athleteId ? '#000' : '#bbb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.top.name || (m.top.athleteId ? '…' : r === 0 ? 'BYE' : '—')}
                    </div>
                    {m.top.club && <div style={{ fontSize: 9, color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.top.club}</div>}
                  </div>
                </div>

                {/* Vertical right connector */}
                {r < bracket.rounds - 1 && (
                  <>
                    <div style={{ position: 'absolute', right: -1, top: innerPad + SLOT_H / 2, bottom: innerPad + SLOT_H / 2, width: 1, background: '#ccc' }} />
                    <div style={{ position: 'absolute', right: -25, top: '50%', width: 25, height: 1, background: '#ccc', transform: 'translateY(-50%)' }} />
                  </>
                )}

                {/* Score box between slots */}
                <div style={{ height: 4, background: '#f0f0f0', border: '1px solid #e0e0e0', margin: '0 0' }} />

                {/* Bottom slot */}
                <div
                  onClick={() => canPlay && m.bottom.athleteId && setWinner(m.id, m.bottom.athleteId)}
                  style={{
                    height: SLOT_H, background: getSlotBg(m, false), border: `1px solid ${m.winnerId && m.bottom.athleteId === m.winnerId ? '#22c55e' : m.winnerId && m.bottom.athleteId ? '#ef4444' : '#ccc'}`,
                    display: 'flex', alignItems: 'center', padding: '0 6px', gap: 4,
                    cursor: canPlay && m.bottom.athleteId ? 'pointer' : 'default',
                    borderRadius: '3px 0 0 3px', boxSizing: 'border-box', overflow: 'hidden',
                  }}
                  title={canPlay ? `Click to make ${m.bottom.name} winner` : ''}
                >
                  {m.winnerId && m.bottom.athleteId === m.winnerId && <span style={{ color: '#22c55e', fontSize: 12 }}>✓</span>}
                  {m.winnerId && m.bottom.athleteId !== m.winnerId && m.bottom.athleteId && <span style={{ color: '#ef4444', fontSize: 12 }}>✗</span>}
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 11, fontWeight: m.bottom.athleteId ? 600 : 400, color: m.bottom.athleteId ? '#000' : '#bbb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.bottom.name || (m.bottom.athleteId ? '…' : r === 0 ? 'BYE' : '—')}
                    </div>
                    {m.bottom.club && <div style={{ fontSize: 9, color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.bottom.club}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Medal column
    const finalMatch = bracket.matches.find(m => m.round === bracket.rounds - 1 && m.matchIndex === 0);
    const winnerId = finalMatch?.winnerId;
    const winner = winnerId ? athleteMap[winnerId] : null;
    const sfMatches = bracket.matches.filter(m => m.round === bracket.rounds - 2);
    const bronzeAthletes = sfMatches.map(m => m.winnerId ? null : null).filter(Boolean); // losers

    cols.push(
      <div key="medals" style={{ marginLeft: 40, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, width: 150, alignSelf: 'center' }}>
        <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Results</div>
        <div style={{ background: '#FFF9C4', border: '2px solid #FFD700', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#997700' }}>🥇 1st Place</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#000', marginTop: 2 }}>{winner ? `${winner.first_name} ${winner.surname}` : '—'}</div>
        </div>
        <div style={{ background: '#f5f5f5', border: '2px solid #C0C0C0', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#666' }}>🥈 2nd Place</div>
          <div style={{ fontSize: 11, color: '#333', marginTop: 2 }}>—</div>
        </div>
        <div style={{ background: '#FFF0E0', border: '2px solid #CD7F32', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8B4513' }}>🥉 3rd Place</div>
          <div style={{ fontSize: 11, color: '#333', marginTop: 2 }}>—</div>
        </div>
        <div style={{ background: '#FFF0E0', border: '2px solid #CD7F32', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8B4513' }}>🥉 3rd Place</div>
          <div style={{ fontSize: 11, color: '#333', marginTop: 2 }}>—</div>
        </div>
        {winnerId && (
          <button onClick={() => save(bracket, locked, true)} style={{ background: '#22c55e', color: '#000', border: 'none', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
            💾 Log Results
          </button>
        )}
      </div>
    );

    return cols;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f0f0', fontFamily: 'Arial, sans-serif' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; }
          @page { size: A4 landscape; margin: 8mm; }
          .bracket-wrap { padding: 0 !important; }
        }
      `}</style>

      {/* Top bar */}
      <div className="no-print" style={{ background: '#0a0a0a', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Link href={`/admin/events/${eventId}`} style={{ color: '#0066cc', fontSize: 13, textDecoration: 'none' }}>← Event</Link>
        <span style={{ color: '#f5f5f5', fontSize: 13, fontWeight: 700 }}>{category.name}</span>
        <span style={{ color: '#666', fontSize: 12 }}>{initialAthletes.length} athletes → {size}-bracket</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {saving && <span style={{ color: '#888', fontSize: 12 }}>Saving…</span>}
          {saved && <span style={{ color: '#22c55e', fontSize: 12 }}>✓ Saved</span>}
          {phase === 'seed' && (
            <>
              <button onClick={doShuffle} style={{ background: '#f59e0b', color: '#000', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🔀 Shuffle</button>
              <button onClick={startBracket} style={{ background: '#22c55e', color: '#000', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>▶ Start Bracket</button>
            </>
          )}
          {phase === 'play' && (
            <button onClick={() => { setPhase('seed'); setBracket(null); setLocked(false); }} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>↺ Reset Draw</button>
          )}
          <button onClick={() => window.print()} style={{ background: '#0066cc', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🖨 Print</button>
        </div>
      </div>

      {/* SEED PHASE */}
      {phase === 'seed' && (
        <div style={{ display: 'flex', gap: 0 }}>
          {/* Seed list */}
          <div style={{ width: 280, background: '#1a1a1a', padding: '16px 12px', minHeight: 'calc(100vh - 52px)' }}>
            <div style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>↕ Drag to reorder seeds</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {seeds.map((a, i) => (
                <div key={i} draggable={true}
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => {
                    if (dragFrom === null || dragFrom === i) { setDragFrom(null); return; }
                    const s = [...seeds]; [s[dragFrom], s[i]] = [s[i], s[dragFrom]]; setSeeds(s); setDragFrom(null);
                  }}
                  style={{ background: a ? '#1e1e1e' : '#111', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'grab', opacity: a ? 1 : 0.35 }}
                >
                  <span style={{ color: '#444', fontSize: 11, fontWeight: 700, minWidth: 20 }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: a ? '#f5f5f5' : '#444', fontSize: 12, fontWeight: a ? 600 : 400 }}>{a ? `${a.first_name} ${a.surname}` : 'BYE'}</div>
                    {a && <div style={{ color: '#555', fontSize: 10 }}>{a.club}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, padding: 12, background: '#111', borderRadius: 8 }}>
              <p style={{ color: '#666', fontSize: 11 }}>BYEs are spread evenly across the draw. Athletes with BYEs advance automatically to R2.</p>
              <button onClick={startBracket} style={{ marginTop: 10, width: '100%', background: '#22c55e', color: '#000', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>▶ Confirm & Start Bracket</button>
            </div>
          </div>

          {/* Seed preview */}
          <div style={{ flex: 1, padding: 20, overflowX: 'auto' }}>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>Preview — adjust seeds on the left, then click <strong>Start Bracket</strong> to lock in the draw.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
              {seeds.map((a, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 4, padding: '6px 10px', display: 'flex', gap: 8, alignItems: 'center', opacity: a ? 1 : 0.4 }}>
                  <span style={{ color: '#aaa', fontSize: 11, fontWeight: 700, minWidth: 24 }}>#{i + 1}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: a ? '#000' : '#bbb' }}>{a ? `${a.first_name} ${a.surname}` : 'BYE'}</div>
                    {a && <div style={{ fontSize: 10, color: '#888' }}>{a.club}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PLAY PHASE — bracket */}
      {phase === 'play' && bracket && (
        <div className="bracket-wrap" style={{ padding: 20, overflowX: 'auto' }}>
          {/* Print header */}
          <div style={{ background: '#1A1A8C', color: '#fff', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderRadius: 4 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{category.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{event.name} · {event.location} · {event.date}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12 }}>
              <div style={{ fontWeight: 700 }}>{initialAthletes.length} Athletes · {size}-Draw</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', marginTop: 2, fontSize: 11 }} className="no-print">Click athlete name to advance winner</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: 20 }}>
            {renderRounds()}
          </div>

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
