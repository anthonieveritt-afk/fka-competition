'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function ImportAthletesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [eventId, setEventId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ summary: string; created: number; updated: number; registered: number; errors: string[] } | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setResult(null);
    setError('');

    const fd = new FormData();
    fd.append('file', file);
    if (eventId) fd.append('eventId', eventId);

    try {
      const res = await fetch('/api/athletes/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', padding: '32px 24px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Link href="/admin/athletes" style={{ color: '#888', fontSize: 14, textDecoration: 'none' }}>
          ← Back to Athletes
        </Link>

        <h1 style={{ color: '#f5f5f5', fontSize: 28, fontWeight: 700, margin: '24px 0 8px' }}>
          Import Athletes
        </h1>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 32 }}>
          Upload the FKA registration template (.xlsx, .xltx, or .csv). Athletes will be created or updated, and automatically registered into selected events.
        </p>

        {/* Format reminder */}
        <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 20, marginBottom: 24 }}>
          <h3 style={{ color: '#f5f5f5', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Expected columns (FKA template)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
            {[
              ['A', 'Full Name'], ['B', 'Age'], ['C', 'Date of Birth'], ['D', 'Height (cm)'],
              ['E', 'EKF Licence Number'], ['F', 'Licence Expiry'],
              ['G–T', 'Event entries (Y/X/✓ = entered)'],
              ['U', 'Emergency Contact'], ['V', 'Email'],
            ].map(([col, label]) => (
              <div key={col} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ background: '#0066cc22', color: '#0066cc', fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, minWidth: 32, textAlign: 'center' }}>{col}</span>
                <span style={{ color: '#aaa', fontSize: 13 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* File upload */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ color: '#f5f5f5', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
              File (.xlsx, .xltx, .csv)
            </label>
            <input
              type="file"
              accept=".xlsx,.xltx,.csv"
              onChange={e => setFile(e.target.files?.[0] || null)}
              style={{ color: '#f5f5f5', fontSize: 14, width: '100%' }}
              required
            />
          </div>

          {/* Event ID (optional) */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ color: '#f5f5f5', fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
              Event ID <span style={{ color: '#888', fontWeight: 400 }}>(optional — links entries to an event)</span>
            </label>
            <input
              type="number"
              placeholder="e.g. 1"
              value={eventId}
              onChange={e => setEventId(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', background: '#141414',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
                color: '#f5f5f5', fontSize: 14, boxSizing: 'border-box',
              }}
            />
            <p style={{ color: '#666', fontSize: 12, marginTop: 6 }}>
              Find the event ID in the admin events list. If left blank, athletes will be imported without event registration.
            </p>
          </div>

          <button
            type="submit"
            disabled={!file || loading}
            style={{
              width: '100%', padding: '12px 24px', background: loading ? '#333' : '#0066cc',
              color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Importing…' : 'Import Athletes'}
          </button>
        </form>

        {/* Result */}
        {result && (
          <div style={{ marginTop: 24, background: '#0d1f0d', border: '1px solid #22c55e44', borderRadius: 10, padding: 20 }}>
            <div style={{ color: '#22c55e', fontSize: 15, fontWeight: 600, marginBottom: 12 }}>✓ Import complete</div>
            <p style={{ color: '#f5f5f5', fontSize: 14, marginBottom: 12 }}>{result.summary}</p>
            <div style={{ display: 'flex', gap: 16 }}>
              {[
                { label: 'Created', val: result.created, color: '#22c55e' },
                { label: 'Updated', val: result.updated, color: '#0066cc' },
                { label: 'Registered', val: result.registered, color: '#f59e0b' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ color, fontSize: 24, fontWeight: 700 }}>{val}</div>
                  <div style={{ color: '#888', fontSize: 12 }}>{label}</div>
                </div>
              ))}
            </div>
            {result.errors.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  {result.errors.length} row(s) had issues:
                </p>
                {result.errors.map((e, i) => (
                  <p key={i} style={{ color: '#ef4444', fontSize: 12, marginBottom: 4 }}>• {e}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 24, background: '#1f0d0d', border: '1px solid #ef444444', borderRadius: 10, padding: 16 }}>
            <p style={{ color: '#ef4444', fontSize: 14 }}>Error: {error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
