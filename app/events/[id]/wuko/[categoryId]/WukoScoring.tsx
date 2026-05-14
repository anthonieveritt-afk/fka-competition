'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Athlete { id: number; first_name: string; surname: string; club: string; }
interface ScoreRow {
  athleteId: number;
  name: string;
  club: string;
  j1: string; j2: string; j3: string; j4: string;
  total: number;
  rank: number;
  inFinal: boolean;
}
interface Props { event: any; category: any; eventId: number; categoryId: number; }

function calcTotal(j1: string, j2: string, j3: string, j4: string): number {
  const vals = [j1, j2, j3, j4].map(s => parseFloat(s)).filter(n => !isNaN(n) && n >= 5 && n <= 9.9);
  if (vals.length < 4) return 0;
  const sorted = [...vals].sort((a, b) => a - b);
  return Math.round((sorted[1] + sorted[2]) * 100) / 100;
}

function assignRanks(rows: ScoreRow[]): ScoreRow[] {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  let rank = 1;
  return rows.map(r => {
    const pos = sorted.findIndex(s => s.athleteId === r.athleteId) + 1;
    return { ...r, rank: r.total > 0 ? pos : 0, inFinal: pos <= 4 && r.total > 0 };
  });
}

const SCORE_INPUT_STYLE = {
  width: 52, height: 28, border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 4, background: '#1a1a1a', color: '#f5f5f5',
  textAlign: 'center' as const, fontSize: 13, fontWeight: 700,
  outline: 'none',
};

const medalColor: Record<number, string> = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32', 4: '#CD7F32' };
const medalLabel: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉', 4: '🥉' };

export default function WukoScoring({ event, category, eventId, categoryId }: Props) {
  const [phase, setPhase] = useState<'prelim' | 'final'>('prelim');
  const [prelim, setPrelim] = useState<ScoreRow[]>([]);
  const [final, setFinal] = useState<ScoreRow[]>([]);
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/wuko-scores/${categoryId}?eventId=${eventId}`)
      .then(r => r.json())
      .then(data => {
        const athletes: Athlete[] = data.athletes ?? [];
        const sm = data.scoreMap ?? {};

        const buildRows = (round: 'prelim' | 'final', list: Athlete[]): ScoreRow[] => {
          return assignRanks(list.map(a => {
            const s = sm[`${a.id}_${round}`];
            const j1 = s?.j1 != null ? String(s.j1) : '';
            const j2 = s?.j2 != null ? String(s.j2) : '';
            const j3 = s?.j3 != null ? String(s.j3) : '';
            const j4 = s?.j4 != null ? String(s.j4) : '';
            return {
              athleteId: a.id, name: `${a.first_name} ${a.surname}`, club: a.club,
              j1, j2, j3, j4, total: calcTotal(j1, j2, j3, j4), rank: 0, inFinal: false,
            };
          }));
        };

        const pRows = buildRows('prelim', athletes);
        setPrelim(pRows);

        // Final: top 4 from prelim, or athletes with existing final scores
        const finalAthletes = athletes.filter(a => {
          const ps = sm[`${a.id}_prelim`];
          const fs = sm[`${a.id}_final`];
          if (fs) return true;
          const top4ids = pRows.filter(r => r.inFinal).map(r => r.athleteId);
          return top4ids.includes(a.id);
        });
        const fRows = buildRows('final', finalAthletes.length > 0 ? finalAthletes : athletes.slice(0, 4));
        setFinal(fRows);

        // Auto-switch to final if any final scores exist
        const hasFinal = Object.keys(sm).some(k => k.endsWith('_final'));
        if (hasFinal) setPhase('final');

        setLoading(false);
      }).catch(() => setLoading(false));
  }, [categoryId, eventId]);

  const updateScore = useCallback(async (
    round: 'prelim' | 'final',
    athleteId: number,
    field: 'j1' | 'j2' | 'j3' | 'j4',
    value: string
  ) => {
    const setter = round === 'prelim' ? setPrelim : setFinal;
    setter(prev => {
      const updated = prev.map(r => {
        if (r.athleteId !== athleteId) return r;
        const next = { ...r, [field]: value };
        next.total = calcTotal(next.j1, next.j2, next.j3, next.j4);
        return next;
      });
      return assignRanks(updated);
    });

    // Debounced save
    setSaving(athleteId);
    const rows = round === 'prelim' ? prelim : final;
    const row = rows.find(r => r.athleteId === athleteId);
    if (!row) return;
    const updated = { ...row, [field]: value };

    try {
      await fetch(`/api/wuko-scores/${categoryId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId, athleteId, round,
          j1: parseFloat(updated.j1) || null,
          j2: parseFloat(updated.j2) || null,
          j3: parseFloat(updated.j3) || null,
          j4: parseFloat(updated.j4) || null,
        }),
      });
      setSaved(athleteId);
      setTimeout(() => setSaved(null), 1500);
    } finally {
      setSaving(null);
    }
  }, [prelim, final, categoryId, eventId]);

  const goToFinal = () => {
    const top4 = prelim.filter(r => r.inFinal).sort((a, b) => a.rank - b.rank);
    setFinal(top4.map(r => ({ ...r, j1: '', j2: '', j3: '', j4: '', total: 0, rank: 0, inFinal: false })));
    setPhase('final');
  };

  const rows = phase === 'prelim' ? prelim : final;
  const allPrelimScored = prelim.length > 0 && prelim.every(r => r.total > 0);
  const top4Ready = prelim.filter(r => r.inFinal).length === 4;

  const ScoreInput = ({ round, athleteId, field, value }: { round: 'prelim'|'final'; athleteId: number; field: 'j1'|'j2'|'j3'|'j4'; value: string }) => (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={e => {
        const raw = e.target.value;
        // Allow partial input while typing (e.g. "6", "6.", "6.0")
        if (raw === '' || /^[5-9](\.[0-9]?)?$/.test(raw)) {
          updateScore(round, athleteId, field, raw);
        }
      }}
      onBlur={e => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v) && v >= 5 && v <= 9.9) {
          updateScore(round, athleteId, field, v.toFixed(1));
        } else if (e.target.value === '') {
          updateScore(round, athleteId, field, '');
        }
      }}
      style={SCORE_INPUT_STYLE}
      placeholder="—"
    />
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'Arial, sans-serif', padding: '24px' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <Link href={`/admin/events/${eventId}`} style={{ color: '#0066cc', fontSize: 13, textDecoration: 'none' }}>← Event</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          <h1 style={{ color: '#f5f5f5', fontSize: 22, fontWeight: 900 }}>{category.name}</h1>
          <span style={{ background: '#7c3aed22', color: '#a78bfa', border: '1px solid #7c3aed44', borderRadius: 20, fontSize: 11, fontWeight: 700, padding: '2px 10px' }}>WUKO</span>
          <span style={{ color: '#888', fontSize: 13 }}>{event.name}</span>
        </div>
      </div>

      {/* Phase toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        {(['prelim', 'final'] as const).map(p => (
          <button key={p} onClick={() => setPhase(p)} style={{
            background: phase === p ? '#7c3aed' : '#1a1a1a',
            color: phase === p ? '#fff' : '#888',
            border: `1px solid ${phase === p ? '#7c3aed' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 8, padding: '7px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            {p === 'prelim' ? `Preliminary (${prelim.length})` : `Final 4`}
          </button>
        ))}
        {phase === 'prelim' && allPrelimScored && top4Ready && (
          <button onClick={goToFinal} style={{
            background: '#22c55e', color: '#000', border: 'none',
            borderRadius: 8, padding: '7px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>▶ Advance Top 4 to Final</button>
        )}
        <a href={`/events/${eventId}/wuko/${categoryId}/print`} target="_blank" style={{
          marginLeft: 'auto', background: '#1a1a8c', color: '#fff', border: 'none',
          borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 700,
          textDecoration: 'none', display: 'inline-block',
        }}>🖨 Print Sheet</a>
      </div>

      {loading ? (
        <div style={{ color: '#555', padding: 40, textAlign: 'center' }}>Loading…</div>
      ) : (
        <div style={{ background: '#141414', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#1a1a1a', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                {['#', 'Athlete', 'Club', 'Judge 1', 'Judge 2', 'Judge 3', 'Judge 4', 'Total', phase === 'final' ? 'Medal' : 'Rank'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: h === '#' || h === 'Total' || h === 'Rank' || h === 'Medal' ? 'center' : 'left', color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isTop4 = phase === 'prelim' && row.inFinal;
                const rowBg = phase === 'final'
                  ? (row.rank >= 1 && row.rank <= 4 ? medalColor[row.rank] + '11' : 'transparent')
                  : (isTop4 ? '#22c55e11' : 'transparent');
                return (
                  <tr key={row.athleteId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: rowBg }}>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#555', fontSize: 13 }}>{i + 1}</td>
                    <td style={{ padding: '10px 14px', color: '#f5f5f5', fontWeight: 600, fontSize: 14 }}>
                      {row.name}
                      {saving === row.athleteId && <span style={{ color: '#888', fontSize: 10, marginLeft: 6 }}>saving…</span>}
                      {saved === row.athleteId && <span style={{ color: '#22c55e', fontSize: 10, marginLeft: 6 }}>✓</span>}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#888', fontSize: 13 }}>{row.club}</td>
                    {(['j1', 'j2', 'j3', 'j4'] as const).map(f => (
                      <td key={f} style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <ScoreInput round={phase} athleteId={row.athleteId} field={f} value={row[f]} />
                      </td>
                    ))}
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 900, fontSize: 16, color: row.total > 0 ? '#f5f5f5' : '#333' }}>
                      {row.total > 0 ? row.total.toFixed(2) : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {phase === 'final' && row.rank > 0 ? (
                        <span style={{ fontSize: 20 }}>{medalLabel[row.rank]}</span>
                      ) : phase === 'prelim' && row.rank > 0 ? (
                        <span style={{
                          fontWeight: 700, fontSize: 13,
                          color: isTop4 ? '#22c55e' : '#888',
                        }}>{isTop4 ? `✓ ${row.rank}` : row.rank}</span>
                      ) : <span style={{ color: '#333' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {rows.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', color: '#555' }}>No athletes registered in this category.</div>
          )}
        </div>
      )}

      {/* Scoring rules reminder */}
      <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 16px', fontSize: 12, color: '#888' }}>
          <strong style={{ color: '#a78bfa' }}>Scoring:</strong> 4 judges · 5.0–9.9 · Drop highest &amp; lowest · Sum middle 2
        </div>
        <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px 16px', fontSize: 12, color: '#888' }}>
          <strong style={{ color: '#22c55e' }}>Final:</strong> Top 4 from prelim · Same scoring rules · 🥇 1st · 🥈 2nd · 🥉 3rd &amp; 4th
        </div>
      </div>
    </div>
  );
}
