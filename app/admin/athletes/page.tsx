'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Athlete = {
  id: number;
  firstName: string;
  surname: string;
  club: string;
  grade: string;
  gender: string;
  dateOfBirth: string;
};

export default function AthletesPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('');

  useEffect(() => {
    fetch('/api/athletes')
      .then(r => r.json())
      .then(data => {
        setAthletes(data.athletes || []);
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  const filtered = athletes.filter(a => {
    const name = `${a.firstName} ${a.surname} ${a.club}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase());
    const matchGender = !genderFilter || a.gender === genderFilter;
    return matchSearch && matchGender;
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Athletes</h1>
          <p style={{ color: '#888' }}>{athletes.length} registered athletes</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/athletes/import" className="btn-secondary">Import CSV</Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <input
          className="max-w-xs"
          placeholder="Search name or club..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="max-w-[150px]" value={genderFilter} onChange={e => setGenderFilter(e.target.value)}>
          <option value="">All genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12" style={{ color: '#555' }}>Loading athletes...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">👥</div>
          <div className="text-white font-medium mb-1">{athletes.length === 0 ? 'No athletes yet' : 'No results'}</div>
          {athletes.length === 0 && (
            <div className="mt-3">
              <Link href="/admin/athletes/import" className="btn-primary">Import CSV</Link>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Club</th>
                <th>Grade</th>
                <th>Gender</th>
                <th>DOB</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/admin/athletes/${a.id}`} className="text-white font-medium hover:underline">
                      {a.firstName} {a.surname}
                    </Link>
                  </td>
                  <td style={{ color: '#aaa' }}>{a.club}</td>
                  <td style={{ color: '#aaa' }}>{a.grade}</td>
                  <td style={{ color: '#aaa' }} className="capitalize">{a.gender}</td>
                  <td style={{ color: '#aaa' }}>{a.dateOfBirth}</td>
                  <td>
                    <Link href={`/admin/athletes/${a.id}`} className="text-xs" style={{ color: '#0066cc' }}>View →</Link>
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
