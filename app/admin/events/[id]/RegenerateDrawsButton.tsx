'use client';

import { useState } from 'react';

interface Props { eventId: number; }

export default function RegenerateDrawsButton({ eventId }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const regenerate = async () => {
    if (!confirm('Regenerate ALL bracket draws?\n\nThis will reshuffle every category and resolve cross-category conflicts. Any manually set draws will be reset.')) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/regenerate-draws`, { method: 'POST' });
      const data = await res.json();
      if (data.success) setResult(data);
      else setError(data.error ?? 'Unknown error');
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        onClick={regenerate}
        disabled={loading}
        style={{
          background: loading ? '#1a1a1a' : '#16a34a',
          color: loading ? '#555' : '#fff',
          border: `1px solid ${loading ? 'rgba(255,255,255,0.08)' : '#16a34a'}`,
          borderRadius: 8, padding: '8px 16px',
          fontSize: 13, fontWeight: 700,
          cursor: loading ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        {loading ? '⏳ Regenerating…' : '🔀 Regenerate All Draws'}
      </button>

      {result && (
        <div style={{
          background: '#052e16', border: '1px solid #16a34a44',
          borderRadius: 8, padding: '10px 14px', fontSize: 12,
        }}>
          <div style={{ color: '#22c55e', fontWeight: 700, marginBottom: 6 }}>
            ✓ {result.summary}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {result.categories.map((c: any) => (
              <div key={c.id} style={{ color: c.skipped ? '#555' : '#aaa', display: 'flex', gap: 8 }}>
                <span style={{ minWidth: 160, color: c.skipped ? '#555' : '#f5f5f5', fontSize: 11 }}>{c.name}</span>
                {c.skipped
                  ? <span style={{ color: '#555' }}>skipped — {c.reason}</span>
                  : <>
                      <span>{c.athletes} athletes · {c.size}-draw</span>
                      {c.crossClubPairs > 0 && <span style={{ color: '#22c55e' }}>⚔ {c.crossClubPairs} JHKA↔Forza</span>}
                      {c.sameClubPairs  > 0 && <span style={{ color: '#f59e0b' }}>⚠ {c.sameClubPairs} same-club</span>}
                      {c.conflictsResolved   && <span style={{ color: '#60a5fa' }}>⚡ re-shuffled</span>}
                    </>
                }
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#1a0000', border: '1px solid #cc000044', borderRadius: 8, padding: '8px 12px', color: '#f87171', fontSize: 12 }}>
          ✗ {error}
        </div>
      )}
    </div>
  );
}
