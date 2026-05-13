'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';

interface MatchState {
  matchId: number;
  categoryName: string;
  aka: { name: string; score: number; yuko: number; wazaari: number; ippon: number; penalties: string[] };
  ao:  { name: string; score: number; yuko: number; wazaari: number; ippon: number; penalties: string[] };
  timer: number;
  timerRunning: boolean;
  senshu: 'red' | 'blue' | null;
  status: string;
}

const PENALTY_LABELS = ['1C', '2C', '3C', 'HC', 'H'];

const BTN = (style: React.CSSProperties) => ({
  border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 900,
  fontFamily: "'Arial Black', Arial, sans-serif",
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  WebkitTapHighlightColor: 'transparent',
  transition: 'opacity 0.1s, transform 0.1s',
  active: { opacity: 0.7, transform: 'scale(0.97)' },
  ...style,
});

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function TouchBtn({ onClick, style, children, disabled }: {
  onClick: () => void; style?: React.CSSProperties; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: 'none', borderRadius: 14, cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: 900, fontFamily: "'Arial Black', Arial, sans-serif",
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        WebkitTapHighlightColor: 'transparent',
        opacity: disabled ? 0.4 : 1,
        fontSize: 18, padding: '14px 10px',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export default function TatamiPage() {
  const params = useParams();
  const tatamiId = params.id as string;

  const [matchId, setMatchId] = useState<number | null>(null);
  const [state, setState] = useState<MatchState | null>(null);
  const [localTimer, setLocalTimer] = useState(180);
  const [timerRunning, setTimerRunning] = useState(false);
  const [senshu, setSenshu] = useState<'red' | 'blue' | null>(null);
  const lastFetch = useRef(0);

  const send = useCallback(async (body: object) => {
    if (!matchId) return;
    await fetch(`/api/tatami/${matchId}/control`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }, [matchId]);

  const fetchState = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetch.current < 400) return;
    lastFetch.current = now;
    try {
      const mid = matchId ?? 1;
      const res = await fetch(`/api/scoreboard/${mid}`, { cache: 'no-store' });
      if (!res.ok) return;
      const d = await res.json();
      setState(d);
      setLocalTimer(d.timer);
      setTimerRunning(d.timerRunning);
      setSenshu(d.senshu ?? null);
      if (!matchId) setMatchId(mid);
    } catch {}
  }, [matchId]);

  useEffect(() => {
    fetchState();
    const iv = setInterval(fetchState, 600);
    return () => clearInterval(iv);
  }, [fetchState]);

  useEffect(() => {
    if (!timerRunning) return;
    const tick = setInterval(() => setLocalTimer(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(tick);
  }, [timerRunning]);

  const aka = state?.aka ?? { name: 'AKA', score: 0, yuko: 0, wazaari: 0, ippon: 0, penalties: [] };
  const ao  = state?.ao  ?? { name: 'AO',  score: 0, yuko: 0, wazaari: 0, ippon: 0, penalties: [] };

  const awardPoints = (side: 'red'|'blue', points: 1|2|3, undo = false) =>
    send({ type: 'points', side, points, undo });

  const addPenalty = (side: 'red'|'blue', penalty: string, remove = false) =>
    send({ type: 'penalty', side, penalty, remove });

  const timerAction = (action: 'start'|'stop'|'reset') => {
    if (action === 'start') setTimerRunning(true);
    if (action === 'stop') setTimerRunning(false);
    if (action === 'reset') { setLocalTimer(180); setTimerRunning(false); }
    send({ type: 'timer', action });
  };

  const toggleSenshu = (side: 'red'|'blue') => {
    const newVal = senshu === side ? null : side;
    setSenshu(newVal);
    send({ type: 'senshu', side: newVal });
  };

  const timerColor = localTimer <= 30 ? '#C8161A' : timerRunning ? '#22c55e' : '#fff';

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a', padding: 0, margin: 0, overflow: 'hidden',
      fontFamily: "'Arial Black', Arial, sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        background: '#1A1A8C', padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ color: '#FFF8C8', fontSize: 13, fontWeight: 700 }}>
          ⚡ Tatami {tatamiId}
        </span>
        <span style={{ color: '#FFF8C8', fontSize: 13, fontWeight: 700 }}>
          {state?.categoryName ?? 'No match loaded'}
        </span>
        <span style={{ color: '#FFF8C8', fontSize: 13, fontWeight: 700 }}>
          Match #{matchId ?? '—'}
        </span>
      </div>

      {/* Timer section */}
      <div style={{
        background: '#141414', borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '16px 12px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          fontSize: 72, fontWeight: 900, color: timerColor,
          letterSpacing: 4, lineHeight: 1,
          transition: 'color 0.3s',
        }}>
          {formatTime(localTimer)}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <TouchBtn
            onClick={() => timerAction('start')}
            disabled={timerRunning}
            style={{ background: '#22c55e', color: '#fff', fontSize: 16, padding: '14px 28px', minWidth: 100 }}
          >▶ START</TouchBtn>
          <TouchBtn
            onClick={() => timerAction('stop')}
            disabled={!timerRunning}
            style={{ background: '#f59e0b', color: '#000', fontSize: 16, padding: '14px 28px', minWidth: 100 }}
          >⏸ STOP</TouchBtn>
          <TouchBtn
            onClick={() => timerAction('reset')}
            style={{ background: '#444', color: '#fff', fontSize: 16, padding: '14px 28px', minWidth: 100 }}
          >↺ RESET</TouchBtn>
        </div>
      </div>

      {/* Score display */}
      <div style={{ display: 'flex', gap: 0, flexShrink: 0 }}>
        {/* AKA score */}
        <div style={{
          flex: 1, background: '#C8161A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '8px 0', gap: 12, position: 'relative',
        }}>
          {senshu === 'red' && (
            <span style={{
              fontSize: 36, fontWeight: 900, color: '#22c55e',
              textShadow: '0 0 12px #22c55e', position: 'absolute', left: 12,
            }}>S</span>
          )}
          <span style={{ fontSize: 64, fontWeight: 900, color: '#fff' }}>{aka.score}</span>
          <span style={{ color: '#FFF8C8', fontSize: 13, fontWeight: 700 }}>
            {aka.yuko}Y / {aka.wazaari}W / {aka.ippon}I
          </span>
        </div>
        <div style={{ width: 2, background: '#222' }} />
        {/* AO score */}
        <div style={{
          flex: 1, background: '#1A2EC8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '8px 0', gap: 12, position: 'relative',
        }}>
          <span style={{ color: '#FFF8C8', fontSize: 13, fontWeight: 700 }}>
            {ao.yuko}Y / {ao.wazaari}W / {ao.ippon}I
          </span>
          <span style={{ fontSize: 64, fontWeight: 900, color: '#fff' }}>{ao.score}</span>
          {senshu === 'blue' && (
            <span style={{
              fontSize: 36, fontWeight: 900, color: '#22c55e',
              textShadow: '0 0 12px #22c55e', position: 'absolute', right: 12,
            }}>S</span>
          )}
        </div>
      </div>

      {/* Main controls */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#222' }}>

        {/* AKA CONTROLS */}
        <div style={{ background: '#0a0a0a', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            color: '#C8161A', fontSize: 13, fontWeight: 900, textAlign: 'center',
            letterSpacing: 2, marginBottom: 4,
          }}>🔴 AKA — {aka.name}</div>

          {/* Points */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {([1, 2, 3] as const).map(pts => (
              <TouchBtn key={pts}
                onClick={() => awardPoints('red', pts)}
                style={{ background: '#C8161A', color: '#fff', fontSize: 20, padding: 16, flexDirection: 'column' }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>
                  {pts === 1 ? 'YUKO' : pts === 2 ? 'WAZA-ARI' : 'IPPON'}
                </span>
                <span style={{ fontSize: 28 }}>+{pts}</span>
              </TouchBtn>
            ))}
          </div>

          {/* Undo points */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {([1, 2, 3] as const).map(pts => (
              <TouchBtn key={pts}
                onClick={() => awardPoints('red', pts, true)}
                style={{ background: '#3d0000', color: '#ff8888', fontSize: 13, padding: '8px 4px', flexDirection: 'column' }}
              >
                <span style={{ fontSize: 9, marginBottom: 1 }}>UNDO</span>
                <span>{pts === 1 ? 'YUKO' : pts === 2 ? 'W-ARI' : 'IPPON'}</span>
              </TouchBtn>
            ))}
          </div>

          {/* Penalties */}
          <div style={{ color: '#888', fontSize: 11, fontWeight: 700, textAlign: 'center', letterSpacing: 2 }}>WARNINGS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {['Chukoku', 'Keikoku', 'Hansoku'].map((p, i) => {
              const code = ['1C', '2C', '3C'][i];
              const active = aka.penalties.includes(code);
              return (
                <div key={p} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <TouchBtn
                    onClick={() => addPenalty('red', code)}
                    style={{
                      background: active ? '#ff4444' : '#2a0000',
                      color: active ? '#fff' : '#ff8888',
                      fontSize: 11, padding: '10px 4px', flexDirection: 'column',
                    }}
                  >
                    <span style={{ fontSize: 9 }}>{p}</span>
                    <span style={{ fontSize: 16, fontWeight: 900 }}>{code}</span>
                  </TouchBtn>
                  <TouchBtn
                    onClick={() => addPenalty('red', code, true)}
                    style={{ background: '#111', color: '#666', fontSize: 9, padding: '4px' }}
                  >undo</TouchBtn>
                </div>
              );
            })}
          </div>

          {/* Senshu */}
          <TouchBtn
            onClick={() => toggleSenshu('red')}
            style={{
              background: senshu === 'red' ? '#22c55e' : '#1a2a1a',
              color: senshu === 'red' ? '#000' : '#22c55e',
              fontSize: 14, padding: '12px', border: '2px solid #22c55e',
              flexDirection: 'column', gap: 2,
            }}
          >
            <span style={{ fontSize: 28, fontWeight: 900 }}>S</span>
            <span>{senshu === 'red' ? '✓ SENSHU (tap to remove)' : 'AWARD SENSHU'}</span>
          </TouchBtn>
        </div>

        {/* AO CONTROLS */}
        <div style={{ background: '#0a0a0a', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            color: '#4488ff', fontSize: 13, fontWeight: 900, textAlign: 'center',
            letterSpacing: 2, marginBottom: 4,
          }}>🔵 AO — {ao.name}</div>

          {/* Points */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {([1, 2, 3] as const).map(pts => (
              <TouchBtn key={pts}
                onClick={() => awardPoints('blue', pts)}
                style={{ background: '#1A2EC8', color: '#fff', fontSize: 20, padding: 16, flexDirection: 'column' }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>
                  {pts === 1 ? 'YUKO' : pts === 2 ? 'WAZA-ARI' : 'IPPON'}
                </span>
                <span style={{ fontSize: 28 }}>+{pts}</span>
              </TouchBtn>
            ))}
          </div>

          {/* Undo points */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {([1, 2, 3] as const).map(pts => (
              <TouchBtn key={pts}
                onClick={() => awardPoints('blue', pts, true)}
                style={{ background: '#00003d', color: '#8888ff', fontSize: 13, padding: '8px 4px', flexDirection: 'column' }}
              >
                <span style={{ fontSize: 9, marginBottom: 1 }}>UNDO</span>
                <span>{pts === 1 ? 'YUKO' : pts === 2 ? 'W-ARI' : 'IPPON'}</span>
              </TouchBtn>
            ))}
          </div>

          {/* Penalties */}
          <div style={{ color: '#888', fontSize: 11, fontWeight: 700, textAlign: 'center', letterSpacing: 2 }}>WARNINGS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {['Chukoku', 'Keikoku', 'Hansoku'].map((p, i) => {
              const code = ['1C', '2C', '3C'][i];
              const active = ao.penalties.includes(code);
              return (
                <div key={p} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <TouchBtn
                    onClick={() => addPenalty('blue', code)}
                    style={{
                      background: active ? '#4444ff' : '#00002a',
                      color: active ? '#fff' : '#8888ff',
                      fontSize: 11, padding: '10px 4px', flexDirection: 'column',
                    }}
                  >
                    <span style={{ fontSize: 9 }}>{p}</span>
                    <span style={{ fontSize: 16, fontWeight: 900 }}>{code}</span>
                  </TouchBtn>
                  <TouchBtn
                    onClick={() => addPenalty('blue', code, true)}
                    style={{ background: '#111', color: '#666', fontSize: 9, padding: '4px' }}
                  >undo</TouchBtn>
                </div>
              );
            })}
          </div>

          {/* Senshu */}
          <TouchBtn
            onClick={() => toggleSenshu('blue')}
            style={{
              background: senshu === 'blue' ? '#22c55e' : '#1a2a1a',
              color: senshu === 'blue' ? '#000' : '#22c55e',
              fontSize: 14, padding: '12px', border: '2px solid #22c55e',
              flexDirection: 'column', gap: 2,
            }}
          >
            <span style={{ fontSize: 28, fontWeight: 900 }}>S</span>
            <span>{senshu === 'blue' ? '✓ SENSHU (tap to remove)' : 'AWARD SENSHU'}</span>
          </TouchBtn>
        </div>
      </div>
    </div>
  );
}
