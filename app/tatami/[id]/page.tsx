'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';

interface ScoreState {
  akaName: string; aoName: string; categoryName: string;
  akaScore: number; aoScore: number;
  akaYuko: number; akaWazaari: number; akaIppon: number;
  aoYuko: number; aoWazaari: number; aoIppon: number;
  akaPenalties: string[]; aoPenalties: string[];
  timer: number; timerRunning: boolean; senshu: 'red' | 'blue' | null;
}

const DEFAULT_TIMER = 180; // 3 minutes

function formatTime(s: number) {
  const m = Math.floor(Math.abs(s) / 60);
  const sec = Math.abs(s) % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function parseTime(str: string): number | null {
  const clean = str.trim();
  if (/^\d+$/.test(clean)) return parseInt(clean); // raw seconds
  const parts = clean.split(':');
  if (parts.length === 2) {
    const m = parseInt(parts[0]); const s = parseInt(parts[1]);
    if (!isNaN(m) && !isNaN(s) && s < 60) return m * 60 + s;
  }
  return null;
}

function Btn({ onClick, style, children, disabled }: {
  onClick: () => void; style?: React.CSSProperties; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      border: 'none', borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer',
      fontWeight: 900, fontFamily: "'Arial Black', Arial, sans-serif",
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', WebkitTapHighlightColor: 'transparent',
      opacity: disabled ? 0.4 : 1, fontSize: 14, ...style,
    }}>{children}</button>
  );
}

export default function TatamiPage() {
  const params = useParams();
  const tatamiId = params.id as string;
  // Use tatami ID as match ID for now (tatami 1 = match 1, etc.)
  const matchId = parseInt(tatamiId);

  const [state, setState] = useState<ScoreState>({
    akaName: 'AKA', aoName: 'AO', categoryName: 'Loading…',
    akaScore: 0, aoScore: 0, akaYuko: 0, akaWazaari: 0, akaIppon: 0,
    aoYuko: 0, aoWazaari: 0, aoIppon: 0,
    akaPenalties: [], aoPenalties: [],
    timer: DEFAULT_TIMER, timerRunning: false, senshu: null,
  });
  const [localTimer, setLocalTimer] = useState(DEFAULT_TIMER);
  const [timerRunning, setTimerRunning] = useState(false);
  const [editingTimer, setEditingTimer] = useState(false);
  const [timerInput, setTimerInput] = useState('');
  const [senshu, setSenshu] = useState<'red' | 'blue' | null>(null);
  const [lastError, setLastError] = useState('');
  const timerInputRef = useRef<HTMLInputElement>(null);

  // POST action to control API
  const send = useCallback(async (body: object) => {
    try {
      const res = await fetch(`/api/tatami/${matchId}/control`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setLastError(d.error ?? 'Error');
      } else {
        setLastError('');
      }
    } catch (e) {
      setLastError('Network error');
    }
  }, [matchId]);

  // Poll scoreboard state
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/scoreboard/${matchId}`, { cache: 'no-store' });
      if (!res.ok) return;
      const d = await res.json();
      setState({
        akaName: d.aka?.name ?? 'AKA', aoName: d.ao?.name ?? 'AO',
        categoryName: d.categoryName ?? '—',
        akaScore: d.aka?.score ?? 0, aoScore: d.ao?.score ?? 0,
        akaYuko: d.aka?.yuko ?? 0, akaWazaari: d.aka?.wazaari ?? 0, akaIppon: d.aka?.ippon ?? 0,
        aoYuko: d.ao?.yuko ?? 0, aoWazaari: d.ao?.wazaari ?? 0, aoIppon: d.ao?.ippon ?? 0,
        akaPenalties: d.aka?.penalties ?? [], aoPenalties: d.ao?.penalties ?? [],
        timer: d.timer ?? DEFAULT_TIMER, timerRunning: d.timerRunning ?? false,
        senshu: d.senshu ?? null,
      });
      if (!timerRunning) setLocalTimer(d.timer ?? DEFAULT_TIMER);
      setSenshu(d.senshu ?? null);
      setTimerRunning(d.timerRunning ?? false);
    } catch {}
  }, [matchId, timerRunning]);

  useEffect(() => {
    fetchState();
    const iv = setInterval(fetchState, 700);
    return () => clearInterval(iv);
  }, [fetchState]);

  // Local timer countdown
  useEffect(() => {
    if (!timerRunning) return;
    const tick = setInterval(() => setLocalTimer(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(tick);
  }, [timerRunning]);

  // Timer actions
  const timerStart = () => {
    setTimerRunning(true);
    send({ type: 'timer', action: 'start' });
  };
  const timerStop = () => {
    setTimerRunning(false);
    send({ type: 'timer', action: 'stop' });
  };
  const timerReset = () => {
    setTimerRunning(false);
    setLocalTimer(DEFAULT_TIMER);
    send({ type: 'timer', action: 'reset' });
  };

  // Edit timer directly
  const startEditTimer = () => {
    setTimerStop: timerRunning && timerStop();
    setEditingTimer(true);
    setTimerInput(formatTime(localTimer));
    setTimeout(() => timerInputRef.current?.select(), 50);
  };

  const confirmEditTimer = () => {
    const secs = parseTime(timerInput);
    if (secs !== null && secs >= 0 && secs <= 600) {
      setLocalTimer(secs);
      setTimerRunning(false);
      // Store elapsed as totalTime - secs (reset to this point)
      send({ type: 'timer', action: 'set', seconds: secs });
    }
    setEditingTimer(false);
  };

  // Points
  const pts = (side: 'red' | 'blue', p: 1 | 2 | 3, undo = false) => {
    // Optimistic update
    const key = side === 'red'
      ? (p === 1 ? 'akaYuko' : p === 2 ? 'akaWazaari' : 'akaIppon')
      : (p === 1 ? 'aoYuko' : p === 2 ? 'aoWazaari' : 'aoIppon');
    const scoreKey = side === 'red' ? 'akaScore' : 'aoScore';
    setState(prev => ({
      ...prev,
      [key]: Math.max(0, prev[key as keyof ScoreState] as number + (undo ? -1 : 1)),
      [scoreKey]: Math.max(0, prev[scoreKey as keyof ScoreState] as number + (undo ? -p : p)),
    }));
    send({ type: 'points', side, points: p, undo });
  };

  // Penalties
  const penalty = (side: 'red' | 'blue', code: string, remove = false) => {
    send({ type: 'penalty', side, penalty: code, remove });
  };

  // Senshu
  const toggleSenshu = (side: 'red' | 'blue') => {
    const newVal = senshu === side ? null : side;
    setSenshu(newVal);
    send({ type: 'senshu', side: newVal });
  };

  const timerColor = localTimer <= 30 ? '#ef4444' : timerRunning ? '#22c55e' : '#f5f5f5';

  const PENALTIES = [
    { code: '1C', label: 'Chukoku' },
    { code: '2C', label: 'Keikoku' },
    { code: '3C', label: 'Hansoku' },
  ];

  const SidePanel = ({ side }: { side: 'red' | 'blue' }) => {
    const isRed = side === 'red';
    const name = isRed ? state.akaName : state.aoName;
    const score = isRed ? state.akaScore : state.aoScore;
    const y = isRed ? state.akaYuko : state.aoYuko;
    const w = isRed ? state.akaWazaari : state.aoWazaari;
    const ip = isRed ? state.akaIppon : state.aoIppon;
    const pens = isRed ? state.akaPenalties : state.aoPenalties;
    const accent = isRed ? '#C8161A' : '#1A2EC8';
    const dim = isRed ? '#3d0000' : '#00003d';
    const label = isRed ? '🔴 AKA' : '🔵 AO';

    return (
      <div style={{ flex: 1, background: '#0d0d0d', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        {/* Name + score */}
        <div style={{ background: accent, borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#FFF8C8', fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>{label}</div>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 900, marginTop: 2 }}>{name}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#fff', fontSize: 40, fontWeight: 900, lineHeight: 1 }}>{score}</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>{y}Y {w}W {ip}I</div>
          </div>
        </div>

        {/* Point buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
          {([1, 2, 3] as const).map(p => (
            <Btn key={p} onClick={() => pts(side, p)}
              style={{ background: accent, color: '#fff', padding: '14px 4px', gap: 2 }}>
              <span style={{ fontSize: 9, letterSpacing: 1 }}>{p === 1 ? 'YUKO' : p === 2 ? 'WAZA-ARI' : 'IPPON'}</span>
              <span style={{ fontSize: 26 }}>+{p}</span>
            </Btn>
          ))}
        </div>

        {/* Undo row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
          {([1, 2, 3] as const).map(p => (
            <Btn key={p} onClick={() => pts(side, p, true)}
              style={{ background: dim, color: accent, padding: '7px 4px', gap: 1, fontSize: 10 }}>
              <span style={{ fontSize: 8 }}>UNDO</span>
              <span>{p === 1 ? 'YUKO' : p === 2 ? 'W-ARI' : 'IPPON'}</span>
            </Btn>
          ))}
        </div>

        {/* Penalties */}
        <div style={{ color: '#555', fontSize: 9, fontWeight: 700, letterSpacing: 2, textAlign: 'center' }}>── WARNINGS ──</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5 }}>
          {PENALTIES.map(({ code, label: pl }) => {
            const active = pens.filter(p => p === code).length > 0;
            return (
              <div key={code} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Btn onClick={() => penalty(side, code)}
                  style={{ background: active ? accent : dim, color: active ? '#fff' : accent, padding: '10px 4px', gap: 1 }}>
                  <span style={{ fontSize: 8 }}>{pl}</span>
                  <span style={{ fontSize: 15, fontWeight: 900 }}>{code}</span>
                </Btn>
                <Btn onClick={() => penalty(side, code, true)}
                  style={{ background: '#111', color: '#555', padding: '4px', fontSize: 9 }}>undo</Btn>
              </div>
            );
          })}
        </div>

        {/* Senshu */}
        <Btn onClick={() => toggleSenshu(side)}
          style={{
            background: senshu === side ? '#22c55e' : '#0d1a0d',
            color: senshu === side ? '#000' : '#22c55e',
            border: '2px solid #22c55e', padding: '12px', gap: 3,
          }}>
          <span style={{ fontSize: 24, fontWeight: 900 }}>S</span>
          <span style={{ fontSize: 9 }}>{senshu === side ? '✓ SENSHU — tap to remove' : 'AWARD SENSHU'}</span>
        </Btn>
      </div>
    );
  };

  return (
    <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', flexDirection: 'column', fontFamily: "'Arial Black', Arial, sans-serif", overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: '#1A1A8C', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ color: '#FFF8C8', fontSize: 12, fontWeight: 700 }}>⚡ Tatami {tatamiId}</span>
        <span style={{ color: '#FFF8C8', fontSize: 11, fontWeight: 700, textAlign: 'center', flex: 1 }}>{state.categoryName}</span>
        {lastError && <span style={{ color: '#ef4444', fontSize: 10 }}>{lastError}</span>}
      </div>

      {/* Timer section */}
      <div style={{ background: '#141414', borderBottom: '1px solid #222', padding: '10px 12px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        {/* Timer display — tap to edit */}
        {editingTimer ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              ref={timerInputRef}
              value={timerInput}
              onChange={e => setTimerInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmEditTimer(); if (e.key === 'Escape') setEditingTimer(false); }}
              style={{
                background: '#222', border: '2px solid #0066cc', borderRadius: 8, color: '#f5f5f5',
                fontSize: 48, fontWeight: 900, width: 160, textAlign: 'center', padding: '4px 8px',
                fontFamily: "'Arial Black', Arial, sans-serif",
              }}
              autoFocus
              placeholder="2:00"
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button onClick={confirmEditTimer} style={{ background: '#22c55e', color: '#000', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 900, cursor: 'pointer' }}>✓ Set</button>
              <button onClick={() => setEditingTimer(false)} style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div
            onClick={startEditTimer}
            title="Tap to edit time"
            style={{
              fontSize: 64, fontWeight: 900, color: timerColor, letterSpacing: 3, lineHeight: 1,
              cursor: 'pointer', borderBottom: '2px dashed rgba(255,255,255,0.15)', paddingBottom: 2,
              transition: 'color 0.3s',
            }}
          >
            {formatTime(localTimer)}
            <span style={{ fontSize: 10, color: '#555', marginLeft: 6, fontWeight: 400 }}>tap to edit</span>
          </div>
        )}

        {/* Timer controls */}
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={timerStart} disabled={timerRunning}
            style={{ background: '#22c55e', color: '#000', padding: '12px 24px', fontSize: 14, borderRadius: 10 }}>
            ▶ START
          </Btn>
          <Btn onClick={timerStop} disabled={!timerRunning}
            style={{ background: '#f59e0b', color: '#000', padding: '12px 24px', fontSize: 14, borderRadius: 10 }}>
            ⏸ STOP
          </Btn>
          <Btn onClick={timerReset}
            style={{ background: '#333', color: '#fff', padding: '12px 20px', fontSize: 14, borderRadius: 10 }}>
            ↺ RESET
          </Btn>
        </div>
      </div>

      {/* Score bar */}
      <div style={{ display: 'flex', flexShrink: 0 }}>
        <div style={{ flex: 1, background: '#C8161A', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {senshu === 'red' && <span style={{ color: '#22c55e', fontSize: 22, fontWeight: 900 }}>S</span>}
          <span style={{ color: '#fff', fontSize: 44, fontWeight: 900 }}>{state.akaScore}</span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{state.akaYuko}Y {state.akaWazaari}W {state.akaIppon}I</span>
        </div>
        <div style={{ width: 2, background: '#000' }} />
        <div style={{ flex: 1, background: '#1A2EC8', padding: '6px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row-reverse' }}>
          {senshu === 'blue' && <span style={{ color: '#22c55e', fontSize: 22, fontWeight: 900 }}>S</span>}
          <span style={{ color: '#fff', fontSize: 44, fontWeight: 900 }}>{state.aoScore}</span>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{state.aoYuko}Y {state.aoWazaari}W {state.aoIppon}I</span>
        </div>
      </div>

      {/* Side panels */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#111', overflow: 'hidden' }}>
        <SidePanel side="red" />
        <SidePanel side="blue" />
      </div>
    </div>
  );
}
