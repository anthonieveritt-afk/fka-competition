'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type ScoreState = {
  matchId: number | null;
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
  timer: number;
  timerRunning: boolean;
  duration: number;
  status: string;
};

const defaultState = (): ScoreState => ({
  matchId: null,
  redName: 'RED',
  blueName: 'BLUE',
  categoryName: '—',
  round: '—',
  redYuko: 0,
  redWazaari: 0,
  redIppon: 0,
  redPenalties: [],
  blueYuko: 0,
  blueWazaari: 0,
  blueIppon: 0,
  bluePenalties: [],
  redTotal: 0,
  blueTotal: 0,
  timer: 180,
  timerRunning: false,
  duration: 180,
  status: 'scheduled',
});

function calcTotal(yuko: number, wazaari: number, ippon: number) {
  return yuko + (wazaari * 2) + (ippon * 3);
}

export default function TatamiPage() {
  const params = useParams();
  const tatamiId = params.id as string;
  const [score, setScore] = useState<ScoreState>(defaultState());
  const [matchInfo, setMatchInfo] = useState<{ id: number; redName: string; blueName: string; categoryName: string; round: string } | null>(null);
  const [matches, setMatches] = useState<Array<{ id: number; matchNumber: number; redName: string; blueName: string; categoryName: string; roundType: string; status: string }>>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSaveRef = useRef<number>(0);

  // Load scheduled matches for this tatami
  useEffect(() => {
    const load = () => {
      fetch(`/api/tatami/${tatamiId}/matches`)
        .then(r => r.json())
        .then(data => setMatches(data.matches || []))
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [tatamiId]);

  // Auto-save scores periodically
  const saveScore = useCallback(async (s: ScoreState) => {
    if (!s.matchId) return;
    const now = Date.now();
    if (now - lastSaveRef.current < 500) return;
    lastSaveRef.current = now;
    try {
      await fetch(`/api/matches/${s.matchId}/score`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redYuko: s.redYuko, redWazaari: s.redWazaari, redIppon: s.redIppon, redPenalties: s.redPenalties,
          blueYuko: s.blueYuko, blueWazaari: s.blueWazaari, blueIppon: s.blueIppon, bluePenalties: s.bluePenalties,
          redTotal: s.redTotal, blueTotal: s.blueTotal, duration: s.duration - s.timer,
        }),
      });
    } catch (e) {}
  }, []);

  // Timer
  useEffect(() => {
    if (score.timerRunning) {
      timerRef.current = setInterval(() => {
        setScore(prev => {
          if (prev.timer <= 0) {
            if (timerRef.current) clearInterval(timerRef.current);
            return { ...prev, timerRunning: false };
          }
          const newState = { ...prev, timer: prev.timer - 1 };
          saveScore(newState);
          return newState;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [score.timerRunning, saveScore]);

  const loadMatch = (m: typeof matches[0]) => {
    setScore({
      ...defaultState(),
      matchId: m.id,
      redName: m.redName || 'RED',
      blueName: m.blueName || 'BLUE',
      categoryName: m.categoryName,
      round: m.roundType,
      status: 'live',
    });
  };

  const updateScore = (side: 'red' | 'blue', type: 'yuko' | 'wazaari' | 'ippon', delta: number) => {
    setScore(prev => {
      const newS = { ...prev };
      if (side === 'red') {
        if (type === 'yuko') newS.redYuko = Math.max(0, prev.redYuko + delta);
        else if (type === 'wazaari') newS.redWazaari = Math.max(0, prev.redWazaari + delta);
        else if (type === 'ippon') newS.redIppon = Math.max(0, prev.redIppon + delta);
      } else {
        if (type === 'yuko') newS.blueYuko = Math.max(0, prev.blueYuko + delta);
        else if (type === 'wazaari') newS.blueWazaari = Math.max(0, prev.blueWazaari + delta);
        else if (type === 'ippon') newS.blueIppon = Math.max(0, prev.blueIppon + delta);
      }
      newS.redTotal = calcTotal(newS.redYuko, newS.redWazaari, newS.redIppon);
      newS.blueTotal = calcTotal(newS.blueYuko, newS.blueWazaari, newS.blueIppon);
      saveScore(newS);
      return newS;
    });
  };

  const addPenalty = (side: 'red' | 'blue', penalty: string) => {
    setScore(prev => {
      const key = `${side}Penalties` as 'redPenalties' | 'bluePenalties';
      return { ...prev, [key]: [...prev[key], penalty] };
    });
  };

  const resetTimer = (duration: number) => {
    setScore(prev => ({ ...prev, timer: duration, duration, timerRunning: false }));
  };

  const endMatch = async () => {
    if (!score.matchId) return;
    setScore(prev => ({ ...prev, timerRunning: false, status: 'complete' }));
    try {
      const winnerId = score.redTotal >= score.blueTotal ? 'red' : 'blue';
      await fetch(`/api/matches/${score.matchId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winnerId, method: 'score' }),
      });
      setMatches(prev => prev.filter(m => m.id !== score.matchId));
      setScore(defaultState());
    } catch (e) {}
  };

  const mins = Math.floor(score.timer / 60);
  const secs = score.timer % 60;
  const timerStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const timerColor = score.timer <= 30 ? '#ff4444' : score.timer <= 60 ? '#ffaa00' : '#4dffaa';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#050505' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: '#0a0a0a', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Link href="/admin" className="text-sm" style={{ color: '#666' }}>← Admin</Link>
        <div className="font-bold text-white">TATAMI {tatamiId}</div>
        <div className="text-sm" style={{ color: '#666' }}>{score.categoryName} · {score.round}</div>
      </div>

      {/* Match selector */}
      {!score.matchId && (
        <div className="flex-1 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Select Match</h2>
          {matches.length === 0 ? (
            <div className="text-center py-12" style={{ color: '#555' }}>No matches scheduled for Tatami {tatamiId}.</div>
          ) : (
            <div className="space-y-2">
              {matches.map(m => (
                <button key={m.id} onClick={() => loadMatch(m)} className="w-full text-left card hover:border-white/20 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">Match {m.matchNumber}: {m.redName} vs {m.blueName}</div>
                      <div className="text-xs mt-1" style={{ color: '#666' }}>{m.categoryName} · {m.roundType}</div>
                    </div>
                    <span className="text-xs" style={{ color: '#0066cc' }}>Start →</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active scoring UI */}
      {score.matchId && (
        <div className="flex-1 flex flex-col">
          {/* Timer */}
          <div className="text-center py-6">
            <div className="text-7xl font-bold font-mono" style={{ color: timerColor }}>{timerStr}</div>
            <div className="flex justify-center gap-3 mt-4">
              <button onClick={() => setScore(p => ({ ...p, timerRunning: !p.timerRunning }))}
                className="btn-primary text-lg px-8 py-3">
                {score.timerRunning ? '⏸ Pause' : '▶ Start'}
              </button>
              <button onClick={() => resetTimer(180)} className="btn-secondary">3:00</button>
              <button onClick={() => resetTimer(120)} className="btn-secondary">2:00</button>
              <button onClick={() => resetTimer(score.duration)} className="btn-secondary">Reset</button>
            </div>
          </div>

          {/* Score display */}
          <div className="grid grid-cols-2 gap-4 px-4 mb-4">
            <div className="text-center py-6 rounded-xl" style={{ background: 'rgba(204,34,0,0.15)', border: '2px solid rgba(204,34,0,0.3)' }}>
              <div className="text-2xl font-bold mb-1" style={{ color: '#ff6644' }}>{score.redName}</div>
              <div className="text-6xl font-bold text-white">{score.redTotal}</div>
              <div className="flex justify-center gap-4 mt-2 text-sm" style={{ color: '#aaa' }}>
                <span>Y:{score.redYuko}</span>
                <span>W:{score.redWazaari}</span>
                <span>I:{score.redIppon}</span>
              </div>
              {score.redPenalties.length > 0 && (
                <div className="mt-2 text-xs" style={{ color: '#ff9944' }}>{score.redPenalties.join(', ')}</div>
              )}
            </div>
            <div className="text-center py-6 rounded-xl" style={{ background: 'rgba(0,102,204,0.15)', border: '2px solid rgba(0,102,204,0.3)' }}>
              <div className="text-2xl font-bold mb-1" style={{ color: '#4da6ff' }}>{score.blueName}</div>
              <div className="text-6xl font-bold text-white">{score.blueTotal}</div>
              <div className="flex justify-center gap-4 mt-2 text-sm" style={{ color: '#aaa' }}>
                <span>Y:{score.blueYuko}</span>
                <span>W:{score.blueWazaari}</span>
                <span>I:{score.blueIppon}</span>
              </div>
              {score.bluePenalties.length > 0 && (
                <div className="mt-2 text-xs" style={{ color: '#ff9944' }}>{score.bluePenalties.join(', ')}</div>
              )}
            </div>
          </div>

          {/* Score buttons */}
          <div className="grid grid-cols-2 gap-4 px-4 mb-4">
            {/* Red buttons */}
            <div className="space-y-2">
              {[
                { label: '+1 Yuko', action: () => updateScore('red', 'yuko', 1), style: 'rgba(204,34,0,0.7)' },
                { label: '+2 Waza-ari', action: () => updateScore('red', 'wazaari', 1), style: 'rgba(204,34,0,0.7)' },
                { label: '+3 Ippon', action: () => updateScore('red', 'ippon', 1), style: '#cc2200' },
                { label: '-1 Undo', action: () => {
                  if (score.redIppon > 0) updateScore('red', 'ippon', -1);
                  else if (score.redWazaari > 0) updateScore('red', 'wazaari', -1);
                  else if (score.redYuko > 0) updateScore('red', 'yuko', -1);
                }, style: 'rgba(100,0,0,0.6)' },
              ].map(btn => (
                <button key={btn.label} onClick={btn.action} className="w-full py-4 rounded-lg font-bold text-white text-lg transition-opacity hover:opacity-80"
                  style={{ background: btn.style }}>
                  {btn.label}
                </button>
              ))}
              <div className="grid grid-cols-2 gap-2">
                {['Chukoku', 'Keikoku', 'Hansoku', 'Hansoku-make'].map(p => (
                  <button key={p} onClick={() => addPenalty('red', p)} className="py-2 rounded text-xs font-medium text-white"
                    style={{ background: 'rgba(150,80,0,0.5)' }}>{p}</button>
                ))}
              </div>
            </div>

            {/* Blue buttons */}
            <div className="space-y-2">
              {[
                { label: '+1 Yuko', action: () => updateScore('blue', 'yuko', 1), style: 'rgba(0,80,180,0.7)' },
                { label: '+2 Waza-ari', action: () => updateScore('blue', 'wazaari', 1), style: 'rgba(0,80,180,0.7)' },
                { label: '+3 Ippon', action: () => updateScore('blue', 'ippon', 1), style: '#0066cc' },
                { label: '-1 Undo', action: () => {
                  if (score.blueIppon > 0) updateScore('blue', 'ippon', -1);
                  else if (score.blueWazaari > 0) updateScore('blue', 'wazaari', -1);
                  else if (score.blueYuko > 0) updateScore('blue', 'yuko', -1);
                }, style: 'rgba(0,30,100,0.6)' },
              ].map(btn => (
                <button key={btn.label} onClick={btn.action} className="w-full py-4 rounded-lg font-bold text-white text-lg transition-opacity hover:opacity-80"
                  style={{ background: btn.style }}>
                  {btn.label}
                </button>
              ))}
              <div className="grid grid-cols-2 gap-2">
                {['Chukoku', 'Keikoku', 'Hansoku', 'Hansoku-make'].map(p => (
                  <button key={p} onClick={() => addPenalty('blue', p)} className="py-2 rounded text-xs font-medium text-white"
                    style={{ background: 'rgba(0,60,120,0.6)' }}>{p}</button>
                ))}
              </div>
            </div>
          </div>

          {/* End match + scoreboard links */}
          <div className="flex justify-center gap-4 px-4 pb-6">
            <button onClick={endMatch} className="btn-danger px-8 py-3 text-lg font-bold">End Match</button>
            <Link href={`/scoreboard/${score.matchId}`} target="_blank" className="btn-secondary px-6 py-3">🖥 Scoreboard ↗</Link>
          </div>
        </div>
      )}
    </div>
  );
}
