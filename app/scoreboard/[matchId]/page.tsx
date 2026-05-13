'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface ScoreboardData {
  matchId: number;
  status: string;
  categoryName: string;
  tatami: number;
  discipline: string;
  aka: {
    name: string;
    club: string;
    score: number;
    yuko: number;
    wazaari: number;
    ippon: number;
    penalties: string[]; // e.g. ['1C', 'HC']
  };
  ao: {
    name: string;
    club: string;
    score: number;
    yuko: number;
    wazaari: number;
    ippon: number;
    penalties: string[];
  };
  timer: number; // seconds remaining
  timerRunning: boolean;
  nextAka?: string;
  nextAo?: string;
}

const PENALTY_LABELS = ['1C', '2C', '3C', 'HC', 'H'];

function PenaltyDots({ active, side }: { active: string[]; side: 'aka' | 'ao' }) {
  const bg = side === 'aka' ? '#6B0000' : '#000066';
  const activeDot = side === 'aka' ? '#ff6666' : '#6699ff';
  const inactiveDot = side === 'aka' ? '#3d0000' : '#000033';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '8px 16px' }}>
      {/* Labels */}
      <div style={{ display: 'flex', gap: 12 }}>
        {PENALTY_LABELS.map(label => (
          <span key={label} style={{
            color: '#FFF8C8', fontSize: 'clamp(10px, 1.2vw, 14px)',
            fontWeight: 700, width: 'clamp(24px, 2.5vw, 32px)', textAlign: 'center',
          }}>{label}</span>
        ))}
      </div>
      {/* Dots */}
      <div style={{
        background: bg, borderRadius: 10, padding: '6px 12px',
        display: 'flex', gap: 12,
      }}>
        {PENALTY_LABELS.map(label => (
          <div key={label} style={{
            width: 'clamp(20px, 2.2vw, 28px)', height: 'clamp(20px, 2.2vw, 28px)',
            borderRadius: '50%',
            background: active.includes(label) ? activeDot : inactiveDot,
            transition: 'background 0.2s',
          }} />
        ))}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;

  const [data, setData] = useState<ScoreboardData | null>(null);
  const [localTimer, setLocalTimer] = useState<number>(180);
  const [timerRunning, setTimerRunning] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/scoreboard/${matchId}`, { cache: 'no-store' });
      if (!res.ok) return;
      const d: ScoreboardData = await res.json();
      setData(d);
      setLocalTimer(d.timer);
      setTimerRunning(d.timerRunning);
    } catch {}
  }, [matchId]);

  // Poll every 500ms
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 500);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Local timer tick
  useEffect(() => {
    if (!timerRunning) return;
    const tick = setInterval(() => {
      setLocalTimer(t => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [timerRunning]);

  // Demo/placeholder when no match loaded
  const aka = data?.aka ?? { name: 'AKA COMPETITOR', club: '', score: 0, yuko: 0, wazaari: 0, ippon: 0, penalties: [] };
  const ao  = data?.ao  ?? { name: 'AO COMPETITOR',  club: '', score: 0, yuko: 0, wazaari: 0, ippon: 0, penalties: [] };
  const categoryName = data?.categoryName ?? 'Category';
  const tatami = data?.tatami ?? 1;
  const timer = data ? localTimer : 180;
  const nextAka = data?.nextAka ?? '—';
  const nextAo  = data?.nextAo  ?? '—';

  return (
    <div style={{
      width: '100vw', height: '100vh', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Arial Black', 'Helvetica Neue', Arial, sans-serif",
      userSelect: 'none',
    }}>
      {/* ── TOP HEADER BAR ── */}
      <div style={{
        background: '#1A1A8C',
        borderBottom: '2px solid rgba(255,255,255,0.3)',
        padding: '8px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, minHeight: '6vh',
      }}>
        <span style={{
          color: '#FFF8C8', fontSize: 'clamp(14px, 2vw, 24px)',
          fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase',
          textAlign: 'center',
        }}>
          {categoryName}
        </span>
      </div>

      {/* ── MAIN BODY ── */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>

        {/* AKA SIDE — left red */}
        <div style={{
          flex: 1, background: '#C8161A',
          display: 'flex', flexDirection: 'column',
          alignItems: 'flex-start', justifyContent: 'flex-start',
          padding: '2vh 3vw',
          position: 'relative',
        }}>
          <span style={{
            color: '#FFF8C8', fontSize: 'clamp(28px, 5vw, 72px)',
            fontWeight: 900, lineHeight: 1,
          }}>Aka</span>
        </div>

        {/* AO SIDE — right blue */}
        <div style={{
          flex: 1, background: '#1A2EC8',
          display: 'flex', flexDirection: 'column',
          alignItems: 'flex-end', justifyContent: 'flex-start',
          padding: '2vh 3vw',
        }}>
          <span style={{
            color: '#FFF8C8', fontSize: 'clamp(28px, 5vw, 72px)',
            fontWeight: 900, lineHeight: 1,
          }}>Ao</span>
        </div>

        {/* ── CENTER OVERLAY ── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'flex-start',
          pointerEvents: 'none',
          gap: 0,
        }}>

          {/* Tatami badge */}
          <div style={{
            background: '#fff', borderRadius: 10,
            padding: '4px 16px', marginTop: '1.5vh',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            <span style={{ fontSize: 'clamp(9px, 1vw, 12px)', fontWeight: 700, color: '#333', letterSpacing: 1 }}>TATAMI</span>
            <span style={{ fontSize: 'clamp(18px, 2.5vw, 36px)', fontWeight: 900, color: '#000', lineHeight: 1.1 }}>{tatami}</span>
          </div>

          {/* Score row: AKA score | Timer | AO score */}
          <div style={{
            display: 'flex', alignItems: 'center',
            gap: 'clamp(8px, 2vw, 32px)',
            marginTop: '2vh',
          }}>
            {/* AKA score */}
            <span style={{
              color: '#fff', fontSize: 'clamp(60px, 12vw, 180px)',
              fontWeight: 900, lineHeight: 1, minWidth: '1.2em', textAlign: 'center',
              textShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}>{aka.score}</span>

            {/* Timer */}
            <div style={{
              background: '#fff', borderRadius: 14,
              padding: 'clamp(8px, 1.5vh, 20px) clamp(16px, 2.5vw, 40px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              minWidth: 'clamp(120px, 16vw, 240px)',
              textAlign: 'center',
            }}>
              <span style={{
                fontSize: 'clamp(36px, 7vw, 100px)',
                fontWeight: 900, color: timer <= 30 ? '#C8161A' : '#000',
                letterSpacing: 2, lineHeight: 1,
              }}>
                {formatTime(timer)}
              </span>
            </div>

            {/* AO score */}
            <span style={{
              color: '#fff', fontSize: 'clamp(60px, 12vw, 180px)',
              fontWeight: 900, lineHeight: 1, minWidth: '1.2em', textAlign: 'center',
              textShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}>{ao.score}</span>
          </div>

          {/* Penalty section */}
          <div style={{
            display: 'flex', alignItems: 'center',
            gap: 'clamp(8px, 2vw, 32px)',
            marginTop: '1.5vh',
          }}>
            <PenaltyDots active={aka.penalties} side="aka" />
            <span style={{
              color: '#FFF8C8', fontSize: 'clamp(10px, 1.2vw, 16px)',
              fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase',
              minWidth: '5em', textAlign: 'center',
            }}>Penalty</span>
            <PenaltyDots active={ao.penalties} side="ao" />
          </div>
        </div>
      </div>

      {/* ── BOTTOM NAME PANELS ── */}
      <div style={{
        display: 'flex', flexShrink: 0,
        minHeight: '18vh',
      }}>
        {/* AKA names */}
        <div style={{
          flex: 1, background: '#6B0000',
          borderTop: '2px solid rgba(255,255,255,0.15)',
          padding: '10px 20px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          gap: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ color: '#888', fontSize: 'clamp(9px, 1vw, 12px)', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', minWidth: '4em' }}>Current</span>
            <span style={{ color: '#FFF8C8', fontSize: 'clamp(14px, 2.2vw, 28px)', fontWeight: 900, textTransform: 'uppercase' }}>
              {aka.name}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ color: '#888', fontSize: 'clamp(9px, 1vw, 12px)', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', minWidth: '4em' }}>Next</span>
            <span style={{ color: '#FFF8C8', fontSize: 'clamp(12px, 1.6vw, 20px)', fontWeight: 700, textTransform: 'uppercase', opacity: 0.75 }}>
              {nextAka}
            </span>
          </div>
        </div>

        {/* AO names */}
        <div style={{
          flex: 1, background: '#000066',
          borderTop: '2px solid rgba(255,255,255,0.15)',
          padding: '10px 20px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end',
          gap: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexDirection: 'row-reverse' }}>
            <span style={{ color: '#888', fontSize: 'clamp(9px, 1vw, 12px)', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', minWidth: '4em', textAlign: 'right' }}>Current</span>
            <span style={{ color: '#FFF8C8', fontSize: 'clamp(14px, 2.2vw, 28px)', fontWeight: 900, textTransform: 'uppercase' }}>
              {ao.name}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexDirection: 'row-reverse' }}>
            <span style={{ color: '#888', fontSize: 'clamp(9px, 1vw, 12px)', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', minWidth: '4em', textAlign: 'right' }}>Next</span>
            <span style={{ color: '#FFF8C8', fontSize: 'clamp(12px, 1.6vw, 20px)', fontWeight: 700, textTransform: 'uppercase', opacity: 0.75 }}>
              {nextAo}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
