'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

type ScoreData = {
  matchId: number;
  redName: string;
  blueName: string;
  categoryName: string;
  round: string;
  redYuko: number;
  redWazaari: number;
  redIppon: number;
  redPenalties: string[];
  blueYuko: number;
  blueWazaari: number;
  blueIppon: number;
  bluePenalties: string[];
  redTotal: number;
  blueTotal: number;
  duration: number;
  status: string;
};

export default function ScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const [data, setData] = useState<ScoreData | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [error, setError] = useState(false);

  // Poll for score updates every 500ms
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/matches/${matchId}/score`);
        if (!res.ok) { setError(true); return; }
        const json = await res.json();
        if (json.score) {
          setData(json.score);
          setLastUpdate(Date.now());
          setError(false);
        }
      } catch {
        setError(true);
      }
    };

    poll();
    const interval = setInterval(poll, 500);
    return () => clearInterval(interval);
  }, [matchId]);

  const timerStr = data ? (() => {
    const rem = Math.max(0, data.duration - elapsed);
    const m = Math.floor(rem / 60);
    const s = rem % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  })() : '0:00';

  const noData = !data || data.status === 'scheduled';

  if (noData && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#000' }}>
        <div className="text-center">
          <div className="text-8xl mb-6">🥋</div>
          <div className="text-3xl font-bold text-white mb-2">FKA</div>
          <div className="text-lg" style={{ color: '#444' }}>No active match</div>
          <div className="mt-4 text-sm" style={{ color: '#333' }}>Waiting for match to start...</div>
        </div>
      </div>
    );
  }

  const maxScore = Math.max(data?.redTotal || 1, data?.blueTotal || 1, 1);
  const redWidth = `${Math.max(10, ((data?.redTotal || 0) / maxScore) * 100)}%`;
  const blueWidth = `${Math.max(10, ((data?.blueTotal || 0) / maxScore) * 100)}%`;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#000', fontFamily: 'system-ui, sans-serif' }}>
      {/* Category bar */}
      <div className="text-center py-4" style={{ background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
        <div className="text-xl font-bold text-white tracking-widest uppercase">{data?.categoryName || '—'}</div>
        <div className="text-sm mt-1 uppercase tracking-wider" style={{ color: '#555' }}>{data?.round || '—'}</div>
      </div>

      {/* Main scoreboard */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-6xl">
          <div className="grid grid-cols-3 gap-0 items-center">

            {/* Red side */}
            <div className="text-center py-12 px-6" style={{ background: 'rgba(180,0,0,0.08)', borderRight: '2px solid rgba(200,0,0,0.2)' }}>
              <div className="text-lg font-semibold uppercase tracking-widest mb-6" style={{ color: '#cc4444' }}>RED</div>
              <div className="text-8xl font-bold text-white leading-none mb-4" style={{ fontSize: 'clamp(4rem, 12vw, 9rem)' }}>
                {data?.redTotal ?? 0}
              </div>
              <div className="text-4xl font-bold uppercase tracking-wide mb-2" style={{ color: 'white', fontSize: 'clamp(1.5rem, 4vw, 3rem)' }}>
                {data?.redName || 'RED'}
              </div>
              {/* Score breakdown */}
              <div className="flex justify-center gap-6 mt-4 text-lg" style={{ color: '#555' }}>
                <span>Y <span style={{ color: '#888' }}>{data?.redYuko ?? 0}</span></span>
                <span>W <span style={{ color: '#888' }}>{data?.redWazaari ?? 0}</span></span>
                <span>I <span style={{ color: '#888' }}>{data?.redIppon ?? 0}</span></span>
              </div>
              {/* Penalties */}
              {(data?.redPenalties?.length ?? 0) > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-1">
                  {data!.redPenalties.map((p, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(200,100,0,0.3)', color: '#ffaa44' }}>{p}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Center - Timer */}
            <div className="text-center px-6">
              <div className="text-8xl font-bold font-mono" style={{
                color: '#fff',
                fontSize: 'clamp(3rem, 10vw, 8rem)',
                textShadow: '0 0 40px rgba(255,255,255,0.1)',
              }}>
                {data ? (() => {
                  const rem = Math.max(0, data.duration);
                  const m = Math.floor(rem / 60);
                  const s = rem % 60;
                  return `${m}:${s.toString().padStart(2, '0')}`;
                })() : '—:——'}
              </div>
              <div className="mt-4 text-sm uppercase tracking-widest" style={{ color: '#333' }}>
                {data?.status === 'complete' ? '🏆 COMPLETE' : data?.status === 'live' ? '● LIVE' : '● READY'}
              </div>
              {/* VS */}
              <div className="mt-6 text-4xl font-black" style={{ color: '#222' }}>VS</div>
            </div>

            {/* Blue side */}
            <div className="text-center py-12 px-6" style={{ background: 'rgba(0,60,160,0.08)', borderLeft: '2px solid rgba(0,80,200,0.2)' }}>
              <div className="text-lg font-semibold uppercase tracking-widest mb-6" style={{ color: '#4488cc' }}>BLUE</div>
              <div className="text-8xl font-bold text-white leading-none mb-4" style={{ fontSize: 'clamp(4rem, 12vw, 9rem)' }}>
                {data?.blueTotal ?? 0}
              </div>
              <div className="text-4xl font-bold uppercase tracking-wide mb-2" style={{ color: 'white', fontSize: 'clamp(1.5rem, 4vw, 3rem)' }}>
                {data?.blueName || 'BLUE'}
              </div>
              <div className="flex justify-center gap-6 mt-4 text-lg" style={{ color: '#555' }}>
                <span>Y <span style={{ color: '#888' }}>{data?.blueYuko ?? 0}</span></span>
                <span>W <span style={{ color: '#888' }}>{data?.blueWazaari ?? 0}</span></span>
                <span>I <span style={{ color: '#888' }}>{data?.blueIppon ?? 0}</span></span>
              </div>
              {(data?.bluePenalties?.length ?? 0) > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-1">
                  {data!.bluePenalties.map((p, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(0,80,160,0.3)', color: '#88aaff' }}>{p}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Score bar */}
          <div className="mt-8 px-4">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#111' }}>
              <div className="h-full flex">
                <div className="transition-all duration-300" style={{ width: redWidth, background: '#cc2200', opacity: 0.8 }}></div>
                <div className="flex-1"></div>
                <div className="transition-all duration-300" style={{ width: blueWidth, background: '#0055cc', opacity: 0.8 }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FKA Footer */}
      <div className="text-center py-3" style={{ borderTop: '1px solid #111' }}>
        <div className="text-xs uppercase tracking-widest" style={{ color: '#222' }}>Frontier Karate Association</div>
      </div>
    </div>
  );
}
