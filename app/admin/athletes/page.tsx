'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Athlete = {
  id: number;
  firstName: string;
  surname: string;
  club: string;
  grade: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  importedFrom: string | null;
};

export default function AthletesPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const [clearingAll, setClearingAll] = useState(false);

  const loadAthletes = () => {
    fetch('/api/athletes')
      .then(r => r.json())
      .then(data => { setAthletes(data.athletes || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadAthletes(); }, []);

  const deleteAthlete = async (id: number, name: string) => {
    if (!confirm(`Delete ${name}? This removes them from all events too.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/athletes/${id}`, { method: 'DELETE' });
      if (res.ok) setAthletes(prev => prev.filter(a => a.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  const clearAllImported = async () => {
    const importedCount = athletes.filter(a => a.importedFrom === 'csv').length;
    if (importedCount === 0) return alert('No imported athletes to delete.');
    if (!confirm(`Delete all ${importedCount} imported athletes and their event registrations? This cannot be undone.`)) return;
    setClearingAll(true);
    try {
      const res = await fetch('/api/athletes/delete-imported', { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) loadAthletes();
    } finally {
      setClearingAll(false);
    }
  };

  const filtered = athletes.filter(a => {
    const name = `${a.firstName} ${a.surname} ${a.club}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase());
    const matchGender = !genderFilter || a.gender === genderFilter;
    return matchSearch && matchGender;
  });

  const importedCount = athletes.filter(a => a.importedFrom === 'csv').length;

  return (
    <div style={{ padding: '32px 24px', minHeight: '100vh', background: '#0a0a0a' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ color: '#f5f5f5', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Athletes</h1>
          <p style={{ color: '#888', fontSize: 14 }}>{athletes.length} registered athletes{importedCount > 0 ? ` · ${importedCount} imported via CSV` : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {importedCount > 0 && (
            <button
              onClick={clearAllImported}
              disabled={clearingAll}
              style={{
                background: '#2a0a0a', color: '#ef4444', border: '1px solid #ef444444',
                borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {clearingAll ? 'Deleting…' : `🗑 Delete all ${importedCount} imported`}
            </button>
          )}
          <Link href="/admin/athletes/import" style={{
            background: '#0066cc', color: '#fff', borderRadius: 8,
            padding: '8px 16px', fontSize: 13, fontWeight: 700, textDecoration: 'none',
          }}>
            + Import CSV
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          placeholder="Search name or club…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
            padding: '8px 12px', color: '#f5f5f5', fontSize: 14, width: 240,
          }}
        />
        <select
          value={genderFilter}
          onChange={e => setGenderFilter(e.target.value)}
          style={{
            background: '#141414', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
            padding: '8px 12px', color: '#f5f5f5', fontSize: 14,
          }}
        >
          <option value="">All genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </div>

      {loading ? (
        <p style={{ color: '#555', textAlign: 'center', padding: 48 }}>Loading athletes…</p>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#141414', borderRadius: 12, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
          <p style={{ color: '#f5f5f5', fontWeight: 700 }}>{athletes.length === 0 ? 'No athletes yet' : 'No results'}</p>
          {athletes.length === 0 && (
            <Link href="/admin/athletes/import" style={{
              display: 'inline-block', marginTop: 16, background: '#0066cc', color: '#fff',
              borderRadius: 8, padding: '10px 20px', fontWeight: 700, textDecoration: 'none',
            }}>Import CSV</Link>
          )}
        </div>
      ) : (
        <div style={{ background: '#141414', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {['Name', 'Club', 'Grade', 'Gender', 'DOB', 'Source', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#888', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <Link href={`/admin/athletes/${a.id}`} style={{ color: '#f5f5f5', fontWeight: 600, textDecoration: 'none' }}>
                      {a.firstName} {a.surname}
                    </Link>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#aaa', fontSize: 14 }}>{a.club}</td>
                  <td style={{ padding: '12px 16px', color: '#aaa', fontSize: 14 }}>{a.grade ?? '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#aaa', fontSize: 14, textTransform: 'capitalize' }}>{a.gender ?? '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#aaa', fontSize: 14 }}>{a.dateOfBirth ?? '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: a.importedFrom === 'csv' ? '#1a1000' : '#0a1a0a',
                      color: a.importedFrom === 'csv' ? '#f59e0b' : '#22c55e',
                      border: `1px solid ${a.importedFrom === 'csv' ? '#f59e0b44' : '#22c55e44'}`,
                    }}>
                      {a.importedFrom === 'csv' ? 'CSV' : 'Manual'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                      <Link href={`/admin/athletes/${a.id}`} style={{ color: '#0066cc', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>View</Link>
                      <button
                        onClick={() => deleteAthlete(a.id, `${a.firstName} ${a.surname}`)}
                        disabled={deleting === a.id}
                        style={{
                          background: 'transparent', color: '#ef4444', border: '1px solid #ef444433',
                          borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {deleting === a.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
