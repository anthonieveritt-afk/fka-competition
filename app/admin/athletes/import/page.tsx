'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Event { id: number; name: string; date: string; status: string; }

export default function ImportAthletesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [eventId, setEventId] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ summary: string; created: number; updated: number; registered: number; errors: string[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/events').then(r => r.json()).then(data => {
      setEvents(data);
      if (data.length > 0) setEventId(String(data[0].id));
    }).catch(() => {});
  }, []);

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

  const selectedEvent = events.find(e => String(e.id) === eventId);

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
          Upload the filled-in FKA registration spreadsheet. Athletes will be created and automatically added to the events they said Yes to.
        </p>

        <form onSubmit={handleSubmit}>

          {/* Step 1: Pick event */}
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ background: '#0066cc', color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, flexShrink: 0 }}>1</div>
              <span style={{ color: '#f5f5f5', fontWeight: 700, fontSize: 16 }}>Choose the event</span>
            </div>
            {events.length === 0 ? (
              <p style={{ color: '#888', fontSize: 14 }}>Loading events…</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {events.map(ev => (
                  <label key={ev.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    background: eventId === String(ev.id) ? '#001a33' : '#1a1a1a',
                    border: `2px solid ${eventId === String(ev.id) ? '#0066cc' : 'transparent'}`,
                    borderRadius: 10, cursor: 'pointer',
                  }}>
                    <input
                      type="radio" name="eventId" value={String(ev.id)}
                      checked={eventId === String(ev.id)}
                      onChange={() => setEventId(String(ev.id))}
                      style={{ accentColor: '#0066cc' }}
                    />
                    <div>
                      <div style={{ color: '#f5f5f5', fontWeight: 700, fontSize: 15 }}>{ev.name}</div>
                      <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                        {ev.date} · <span style={{
                          color: ev.status === 'registration' ? '#22c55e' : ev.status === 'live' ? '#f59e0b' : '#888'
                        }}>{ev.status}</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Upload file */}
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ background: '#0066cc', color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, flexShrink: 0 }}>2</div>
              <span style={{ color: '#f5f5f5', fontWeight: 700, fontSize: 16 }}>Upload the registration spreadsheet</span>
            </div>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
              This is the Excel file clubs fill in with their athletes. Accepts .xlsx, .xltx, or .csv
            </p>
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px dashed rgba(255,255,255,0.15)', borderRadius: 10,
              padding: 24, cursor: 'pointer', flexDirection: 'column', gap: 8,
              background: file ? '#001a0a' : '#1a1a1a',
              borderColor: file ? '#22c55e' : 'rgba(255,255,255,0.15)',
            }}>
              <input type="file" accept=".xlsx,.xltx,.csv" onChange={e => setFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
              {file ? (
                <>
                  <span style={{ fontSize: 28 }}>✅</span>
                  <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 14 }}>{file.name}</span>
                  <span style={{ color: '#888', fontSize: 12 }}>Tap to change file</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 32 }}>📂</span>
                  <span style={{ color: '#f5f5f5', fontWeight: 700, fontSize: 14 }}>Tap to choose file</span>
                  <span style={{ color: '#888', fontSize: 12 }}>Excel (.xlsx) or CSV</span>
                </>
              )}
            </label>
          </div>

          {/* Step 3: Import */}
          <div style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ background: '#0066cc', color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, flexShrink: 0 }}>3</div>
              <span style={{ color: '#f5f5f5', fontWeight: 700, fontSize: 16 }}>Run the import</span>
            </div>

            {selectedEvent && file ? (
              <div style={{ background: '#001a0a', border: '1px solid #22c55e44', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                <p style={{ color: '#22c55e', fontSize: 13, margin: 0 }}>
                  ✓ Ready — will import athletes into <strong>{selectedEvent.name}</strong>
                </p>
              </div>
            ) : (
              <p style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
                {!file && !eventId ? 'Complete steps 1 and 2 first.' : !file ? 'Choose a file in step 2.' : 'Select an event in step 1.'}
              </p>
            )}

            <button
              type="submit"
              disabled={!file || !eventId || loading}
              style={{
                width: '100%', padding: '14px 24px',
                background: !file || !eventId ? '#222' : loading ? '#333' : '#0066cc',
                color: !file || !eventId ? '#555' : '#fff',
                border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700,
                cursor: !file || !eventId || loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '⏳ Importing…' : '⚡ Import Athletes'}
            </button>
          </div>
        </form>

        {/* Result */}
        {result && (
          <div style={{ background: '#0d1f0d', border: '1px solid #22c55e44', borderRadius: 12, padding: 24 }}>
            <div style={{ color: '#22c55e', fontSize: 17, fontWeight: 700, marginBottom: 12 }}>✅ Import complete!</div>
            <p style={{ color: '#f5f5f5', fontSize: 14, marginBottom: 16 }}>{result.summary}</p>
            <div style={{ display: 'flex', gap: 24 }}>
              {[
                { label: 'Athletes created', val: result.created, color: '#22c55e' },
                { label: 'Athletes updated', val: result.updated, color: '#0066cc' },
                { label: 'Event entries',    val: result.registered, color: '#f59e0b' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ color, fontSize: 32, fontWeight: 900 }}>{val}</div>
                  <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
            {result.errors.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ color: '#f59e0b', fontSize: 13, fontWeight: 700 }}>{result.errors.length} row(s) had issues:</p>
                {result.errors.map((e, i) => <p key={i} style={{ color: '#ef4444', fontSize: 12 }}>• {e}</p>)}
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ background: '#1f0d0d', border: '1px solid #ef444444', borderRadius: 12, padding: 16 }}>
            <p style={{ color: '#ef4444', fontSize: 14 }}>❌ {error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
