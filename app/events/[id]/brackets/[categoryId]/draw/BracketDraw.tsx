'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Athlete { id: number; first_name: string; surname: string; club: string; }
interface MatchSlot { athleteId: number | null; name: string; club: string; }
interface BracketMatch { id: string; round: number; matchIndex: number; top: MatchSlot; bottom: MatchSlot; winnerId: number | null; bye: boolean; }
interface BracketState { size: number; rounds: number; matches: BracketMatch[]; }
interface Props { event: any; category: any; initialAthletes: Athlete[]; eventId: number; categoryId: number; }

function bracketSize(n: number) { let s = 4; while (s < n) s *= 2; return s; }
function shuffle<T>(arr: T[]): T[] { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function buildBracket(athletes: Athlete[], size: number): BracketState {
  const rounds = Math.log2(size);
  const slots: (Athlete | null)[] = new Array(size).fill(null);
  athletes.forEach((a, i) => { slots[i] = a; });
  const matches: BracketMatch[] = [];

  for (let m = 0; m < size / 2; m++) {
    const top = slots[m * 2]; const bot = slots[m * 2 + 1];
    const isBye = (!top && !!bot) || (!!top && !bot);
    const wid = isBye ? (top?.id ?? bot?.id ?? null) : null;
    matches.push({ id: `R0-M${m}`, round: 0, matchIndex: m,
      top: { athleteId: top?.id ?? null, name: top ? `${top.first_name} ${top.surname}` : 'BYE', club: top?.club ?? '' },
      bottom: { athleteId: bot?.id ?? null, name: bot ? `${bot.first_name} ${bot.surname}` : 'BYE', club: bot?.club ?? '' },
      winnerId: wid, bye: isBye });
  }
  for (let r = 1; r < rounds; r++) {
    const mc = size / Math.pow(2, r + 1);
    for (let m = 0; m < mc; m++) {
      matches.push({ id: `R${r}-M${m}`, round: r, matchIndex: m,
        top: { athleteId: null, name: '—', club: '' }, bottom: { athleteId: null, name: '—', club: '' },
        winnerId: null, bye: false });
    }
  }
  // Propagate byes
  for (const m of matches.filter(m => m.round === 0 && m.bye && m.winnerId)) {
    const next = matches.find(x => x.id === `R1-M${Math.floor(m.matchIndex / 2)}`);
    if (next) {
      if (m.matchIndex % 2 === 0) next.top = { athleteId: m.winnerId!, name: '', club: '' };
      else next.bottom = { athleteId: m.winnerId!, name: '', club: '' };
      if (next.top.athleteId && !next.bottom.athleteId) { next.winnerId = next.top.athleteId; next.bye = true; }
      if (!next.top.athleteId && next.bottom.athleteId) { next.winnerId = next.bottom.athleteId; next.bye = true; }
    }
  }
  return { size, rounds, matches };
}

function resolveNames(state: BracketState, map: Record<number, Athlete>): BracketState {
  return { ...state, matches: state.matches.map(m => ({
    ...m,
    top: m.top.athleteId && map[m.top.athleteId] ? { ...m.top, name: `${map[m.top.athleteId].first_name} ${map[m.top.athleteId].surname}`, club: map[m.top.athleteId].club } : m.top,
    bottom: m.bottom.athleteId && map[m.bottom.athleteId] ? { ...m.bottom, name: `${map[m.bottom.athleteId].first_name} ${map[m.bottom.athleteId].surname}`, club: map[m.bottom.athleteId].club } : m.bottom,
  })) };
}

function advanceWinner(matches: BracketMatch[], matchId: string, winnerId: number) {
  const m = matches.find(x => x.id === matchId)!;
  const nextId = `R${m.round + 1}-M${Math.floor(m.matchIndex / 2)}`;
  const next = matches.find(x => x.id === nextId);
  if (!next) return;
  if (m.matchIndex % 2 === 0) next.top = { athleteId: winnerId, name: '', club: '' };
  else next.bottom = { athleteId: winnerId, name: '', club: '' };
  if (next.top.athleteId && !next.bottom.athleteId) { next.winnerId = next.top.athleteId; next.bye = true; }
  if (!next.top.athleteId && next.bottom.athleteId) { next.winnerId = next.bottom.athleteId; next.bye = true; }
}

// ─── Pure CSS Bracket Renderer ────────────────────────────────────────────
const SH = 32;   // slot height px
const COL_W = 175; // column width px
const COL_GAP = 20; // connector gap px

function MatchSlotEl({ slot, isWinner, isLoser, seqNum, canClick, onClick }: {
  slot: MatchSlot; isWinner: boolean; isLoser: boolean; seqNum?: number;
  canClick: boolean; onClick: () => void;
}) {
  const hasAthlete = !!slot.athleteId;
  const isBye = slot.name === 'BYE';
  const bg = isWinner ? '#e8f5e9' : isLoser ? '#f5f5f5' : hasAthlete ? (isBye ? '#fafafa' : '#ffe8e8') : '#fafafa';
  const borderLeft = isWinner ? '3px solid #2e7d32' : isLoser ? '3px solid #bbb' : hasAthlete && !isBye ? '3px solid #cc0000' : '3px solid #ddd';

  return (
    <div onClick={canClick ? onClick : undefined} style={{
      height: SH, display: 'flex', alignItems: 'center', background: bg,
      border: '1px solid #ccc', borderLeft,
      cursor: canClick ? 'pointer' : 'default',
      overflow: 'hidden', gap: 4, paddingRight: 4,
      boxSizing: 'border-box',
      transition: 'background 0.15s',
    }} title={canClick ? `Click to advance: ${slot.name}` : ''}>
      {seqNum !== undefined && (
        <span style={{ fontSize: 8, color: '#aaa', minWidth: 16, textAlign: 'right', flexShrink: 0, fontWeight: 700 }}>{seqNum}</span>
      )}
      <span style={{ width: 1, background: '#ddd', height: '100%', flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: hasAthlete && !isBye ? 700 : 400, color: isLoser ? '#aaa' : hasAthlete && !isBye ? '#000' : '#bbb', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>
        {slot.name || '—'}
      </span>
      {isWinner && <span style={{ color: '#2e7d32', fontSize: 12, flexShrink: 0, fontWeight: 900 }}>✓</span>}
    </div>
  );
}

export default function BracketDraw({ event, category, initialAthletes, eventId, categoryId }: Props) {
  const size = bracketSize(initialAthletes.length);
  const athleteMap: Record<number, Athlete> = {};
  initialAthletes.forEach(a => { athleteMap[a.id] = a; });

  const [seeds, setSeeds] = useState<(Athlete | null)[]>(() => { const s = new Array(size).fill(null); initialAthletes.forEach((a, i) => { s[i] = a; }); return s; });
  const [bracket, setBracket] = useState<BracketState | null>(null);
  const [phase, setPhase] = useState<'seed' | 'play'>('seed');
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/bracket-state/${categoryId}?eventId=${eventId}`)
      .then(r => r.json()).then(d => {
        if (d.state?.matches?.length > 0) {
          const resolved = resolveNames(d.state, athleteMap);
          setBracket(resolved); setLocked(d.locked ?? false); setPhase('play');
        }
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
    const b = resolveNames(buildBracket(seeds.filter(Boolean) as Athlete[], size), athleteMap);
    // Re-build with full slots
    const b2 = resolveNames(buildBracket(seeds as (Athlete | null)[], size), athleteMap);
    setBracket(b2); setPhase('play'); setLocked(true);
    save(b2, true);
  };

  const doShuffle = () => { const s = new Array(size).fill(null); shuffle(initialAthletes).forEach((a, i) => { s[i] = a; }); setSeeds(s); };

  const handleWinner = useCallback((matchId: string, winnerId: number) => {
    setBracket(prev => {
      if (!prev) return prev;
      const matches = prev.matches.map(m => ({ ...m }));
      matches.find(m => m.id === matchId)!.winnerId = winnerId;
      advanceWinner(matches, matchId, winnerId);
      const next = resolveNames({ ...prev, matches }, athleteMap);
      save(next, locked);
      return next;
    });
  }, [athleteMap, locked, save]);

  const getRoundLabel = (r: number, rounds: number) => {
    if (r === rounds - 1) return 'Final';
    if (r === rounds - 2) return 'Semi-Final';
    if (r === rounds - 3) return 'Quarter-Final';
    return `Round ${r + 1}`;
  };

  const finalMatch = bracket?.matches.find(m => m.round === (bracket.rounds - 1));
  const winner = finalMatch?.winnerId ? athleteMap[finalMatch.winnerId] : null;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'Arial, sans-serif' }}>
      {/* Toolbar */}
      <div style={{ background: '#111', borderBottom: '1px solid #222', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link href={`/admin/events/${eventId}`} style={{ color: '#0066cc', fontSize: 13, textDecoration: 'none' }}>← Event</Link>
        <span style={{ color: '#f5f5f5', fontSize: 13, fontWeight: 700, flex: 1 }}>{category.name}</span>
        <span style={{ color: '#555', fontSize: 12 }}>{initialAthletes.length} athletes · {size}-bracket</span>
        {saving && <span style={{ color: '#888', fontSize: 12 }}>Saving…</span>}
        {saved && <span style={{ color: '#22c55e', fontSize: 12 }}>✓ Saved</span>}
        <div style={{ display: 'flex', gap: 8 }}>
          {phase === 'seed' && (<>
            <button onClick={doShuffle} style={{ background: '#f59e0b', color: '#000', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🔀 Shuffle</button>
            <button onClick={startBracket} style={{ background: '#22c55e', color: '#000', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>▶ Start Bracket</button>
          </>)}
          {phase === 'play' && (<>
            {winner && <button onClick={() => save(bracket!, locked, true)} style={{ background: '#22c55e', color: '#000', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>💾 Log Results</button>}
            <button onClick={() => { setPhase('seed'); setBracket(null); }} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>↺ Reset</button>
          </>)}
          <a href={`/events/${eventId}/brackets/${categoryId}/print`} target="_blank" style={{ background: '#0066cc', color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>🖨 Print</a>
        </div>
      </div>

      {/* SEED PHASE */}
      {phase === 'seed' && (
        <div style={{ display: 'flex', height: 'calc(100vh - 52px)' }}>
          <div style={{ width: 260, background: '#141414', borderRight: '1px solid #222', padding: '12px 10px', overflowY: 'auto' }}>
            <div style={{ color: '#555', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>↕ Drag to reorder</div>
            {seeds.map((a, i) => (
              <div key={i} draggable={!!a}
                onDragStart={() => a && setDragFrom(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => { if (dragFrom !== null && dragFrom !== i) { const s = [...seeds]; [s[dragFrom], s[i]] = [s[i], s[dragFrom]]; setSeeds(s); } setDragFrom(null); }}
                style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 4, padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 6, cursor: a ? 'grab' : 'default', marginBottom: 2, opacity: a ? 1 : 0.3 }}
              >
                <span style={{ color: '#444', fontSize: 10, fontWeight: 700, minWidth: 20 }}>{i + 1}</span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ color: a ? '#f5f5f5' : '#333', fontSize: 11, fontWeight: a ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a ? `${a.first_name} ${a.surname}` : 'BYE'}</div>
                  {a && <div style={{ color: '#555', fontSize: 9 }}>{a.club}</div>}
                </div>
              </div>
            ))}
            <button onClick={startBracket} style={{ marginTop: 10, width: '100%', background: '#22c55e', color: '#000', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>▶ Confirm & Start</button>
          </div>
          <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
            <p style={{ color: '#555', fontSize: 13, marginBottom: 16 }}>Drag names on the left to adjust seeding, then click <strong style={{ color: '#f5f5f5' }}>Start Bracket</strong>.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 4 }}>
              {seeds.map((a, i) => (
                <div key={i} style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 4, padding: '5px 10px', display: 'flex', gap: 8, opacity: a ? 1 : 0.3 }}>
                  <span style={{ color: '#444', fontSize: 10, fontWeight: 700, minWidth: 22 }}>#{i + 1}</span>
                  <span style={{ color: a ? '#f5f5f5' : '#333', fontSize: 11, fontWeight: a ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a ? `${a.first_name} ${a.surname}` : 'BYE'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PLAY PHASE — pure CSS bracket */}
      {phase === 'play' && bracket && (
        <div style={{ padding: 16, overflowX: 'auto', overflowY: 'auto', height: 'calc(100vh - 52px)' }}>
          {/* Header */}
          <div style={{ background: '#1A1A8C', color: '#fff', padding: '8px 16px', borderRadius: 4, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900 }}>{category.name}</div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>{event.name} · {initialAthletes.length} athletes · {size}-draw · Click name to advance winner</div>
            </div>
            {winner && <div style={{ background: '#FFD700', color: '#000', padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 900 }}>🥇 {winner.first_name} {winner.surname}</div>}
          </div>

          {/* Bracket columns */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
            {Array.from({ length: bracket.rounds }, (_, r) => {
              const rMatches = bracket.matches.filter(m => m.round === r).sort((a, b) => a.matchIndex - b.matchIndex);
              const matchCount = rMatches.length;
              const totalH = bracket.size * SH;
              const matchH = totalH / matchCount;
              const slotPad = (matchH - SH * 2 - 10) / 2;
              const isLast = r === bracket.rounds - 1;

              return (
                <div key={r} style={{ display: 'flex', gap: 0 }}>
                  <div style={{ width: COL_W, flexShrink: 0 }}>
                    {/* Round label */}
                    <div style={{ background: '#1A1A8C', color: '#fff', fontSize: 9, fontWeight: 700, textAlign: 'center', padding: '3px 0', marginBottom: 0, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      {getRoundLabel(r, bracket.rounds)}
                    </div>
                    {/* Matches */}
                    <div style={{ position: 'relative', height: bracket.size * SH }}>
                      {rMatches.map(m => {
                        const mt = m.matchIndex * matchH;
                        const topY = mt + slotPad;
                        const botY = topY + SH + 10;
                        const vTop = topY + SH / 2;
                        const vBot = botY + SH / 2;
                        const midY = (vTop + vBot) / 2;
                        const canPlay = !m.winnerId && !m.bye && !!m.top.athleteId && !!m.bottom.athleteId;
                        const topIsW = !!m.winnerId && m.top.athleteId === m.winnerId;
                        const botIsW = !!m.winnerId && m.bottom.athleteId === m.winnerId;
                        const topIsL = !!m.winnerId && !!m.top.athleteId && !topIsW;
                        const botIsL = !!m.winnerId && !!m.bottom.athleteId && !botIsW;
                        const seqTop = r === 0 ? m.matchIndex * 2 + 1 : undefined;
                        const seqBot = r === 0 ? m.matchIndex * 2 + 2 : undefined;

                        return (
                          <div key={m.id} style={{ position: 'absolute', top: mt, left: 0, right: 0, height: matchH }}>
                            {/* Top slot (AKA - red) */}
                            <div style={{ position: 'absolute', top: topY - mt, left: 0, right: 0 }}>
                              <MatchSlotEl slot={m.top} isWinner={topIsW} isLoser={topIsL} seqNum={seqTop}
                                canClick={canPlay && !!m.top.athleteId}
                                onClick={() => m.top.athleteId && handleWinner(m.id, m.top.athleteId)} />
                            </div>
                            {/* Score boxes */}
                            <div style={{ position: 'absolute', top: topY - mt + SH, left: 0, right: 0, height: 5, background: '#fff5f5', borderLeft: '3px solid #cc0000' }} />
                            <div style={{ position: 'absolute', top: botY - mt - 5, left: 0, right: 0, height: 5, background: '#f5f5ff', borderLeft: '3px solid #0000cc' }} />
                            {/* Bottom slot (AO - blue) */}
                            <div style={{ position: 'absolute', top: botY - mt, left: 0, right: 0 }}>
                              <div onClick={canPlay && m.bottom.athleteId ? () => handleWinner(m.id, m.bottom.athleteId!) : undefined}
                                style={{ height: SH, display: 'flex', alignItems: 'center', background: botIsW ? '#e8f5e9' : botIsL ? '#f5f5f5' : m.bottom.athleteId && m.bottom.name !== 'BYE' ? '#e8eeff' : '#fafafa', border: '1px solid #ccc', borderLeft: `3px solid ${botIsW ? '#2e7d32' : botIsL ? '#bbb' : m.bottom.athleteId && m.bottom.name !== 'BYE' ? '#0000cc' : '#ddd'}`, cursor: canPlay && m.bottom.athleteId ? 'pointer' : 'default', overflow: 'hidden', gap: 4, paddingRight: 4, boxSizing: 'border-box' }}
                                title={canPlay && m.bottom.athleteId ? `Click to advance: ${m.bottom.name}` : ''}>
                                {seqBot !== undefined && <span style={{ fontSize: 8, color: '#aaa', minWidth: 16, textAlign: 'right', flexShrink: 0, fontWeight: 700 }}>{seqBot}</span>}
                                <span style={{ width: 1, background: '#ddd', height: '100%', flexShrink: 0 }} />
                                <span style={{ fontSize: 10, fontWeight: m.bottom.athleteId && m.bottom.name !== 'BYE' ? 700 : 400, color: botIsL ? '#aaa' : m.bottom.athleteId && m.bottom.name !== 'BYE' ? '#000' : '#bbb', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>{m.bottom.name || '—'}</span>
                                {botIsW && <span style={{ color: '#2e7d32', fontSize: 12, flexShrink: 0, fontWeight: 900 }}>✓</span>}
                              </div>
                            </div>
                            {/* Connector lines */}
                            {!isLast && <>
                              <div style={{ position: 'absolute', right: 0, top: vTop - mt, height: vBot - vTop, width: 1, background: '#444' }} />
                              <div style={{ position: 'absolute', right: -(COL_GAP), top: midY - mt, height: 1, width: COL_GAP, background: '#444' }} />
                            </>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {!isLast && <div style={{ width: COL_GAP, flexShrink: 0 }} />}
                </div>
              );
            })}

            {/* Medal column */}
            <div style={{ marginLeft: 24, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', width: 140, alignSelf: 'center' }}>
              {[
                { pos: '🥇 1st', bg: '#FFFDE7', border: '#FFD700', name: winner ? `${winner.first_name} ${winner.surname}` : '—' },
                { pos: '🥈 2nd', bg: '#FAFAFA', border: '#BDBDBD', name: '—' },
                { pos: '🥉 3rd', bg: '#FFF3E0', border: '#FF8F00', name: '—' },
                { pos: '🥉 3rd', bg: '#FFF3E0', border: '#FF8F00', name: '—' },
              ].map((b, i) => (
                <div key={i} style={{ border: `2px solid ${b.border}`, background: b.bg, borderRadius: 6, padding: '6px 10px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#666' }}>{b.pos} Place</div>
                  <div style={{ fontSize: 11, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{b.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
