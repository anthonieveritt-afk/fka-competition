'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Category = {
  id: number;
  eventId: number;
  name: string;
  discipline: string;
  gender: string;
  ageGroup: string;
  weightClass?: string;
  beltRange: string | null;
};

export default function CategoriesPage() {
  const params = useParams();
  const eventId = params.id as string;
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    discipline: 'kumite',
    gender: 'male',
    ageGroup: 'Senior',
    weightClass: '',
    beltRange: 'All grades',
  });

  useEffect(() => {
    fetch(`/api/events/${eventId}/categories`)
      .then(r => r.json())
      .then(data => {
        setCategories(data.categories || []);
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [eventId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/events/${eventId}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.category) setCategories(p => [...p, data.category]);
    setShowCreate(false);
    setSaving(false);
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href={`/admin/events/${eventId}`} className="text-sm" style={{ color: '#0066cc' }}>← Event</Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-2xl font-bold text-white">Categories</h1>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>+ Add Category</button>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="card w-full max-w-md overflow-y-auto max-h-screen">
            <h2 className="text-lg font-semibold text-white mb-4">Add Category</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: '#888' }}>Name</label>
                <input required value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="Senior Male -75kg Kumite" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1" style={{ color: '#888' }}>Discipline</label>
                  <select value={form.discipline} onChange={e => setForm(p => ({...p, discipline: e.target.value}))}>
                    <option value="kumite">Kumite</option>
                    <option value="kata">Kata</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: '#888' }}>Gender</label>
                  <select value={form.gender} onChange={e => setForm(p => ({...p, gender: e.target.value}))}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: '#888' }}>Age Group</label>
                <select value={form.ageGroup} onChange={e => setForm(p => ({...p, ageGroup: e.target.value}))}>
                  <option>Under 10</option>
                  <option>Under 12</option>
                  <option>Under 14</option>
                  <option>Cadet</option>
                  <option>Junior</option>
                  <option>Senior</option>
                  <option>Veteran</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: '#888' }}>Weight Class (kumite only)</label>
                <input value={form.weightClass} onChange={e => setForm(p => ({...p, weightClass: e.target.value}))} placeholder="-75kg or Open" />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: '#888' }}>Belt Range</label>
                <select value={form.beltRange} onChange={e => setForm(p => ({...p, beltRange: e.target.value}))}>
                  <option>All grades</option>
                  <option>Kyu grades</option>
                  <option>Dan grades</option>
                  <option>Black belt</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add Category'}</button>
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12" style={{ color: '#555' }}>Loading...</div>
      ) : categories.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">📋</div>
          <div className="text-white font-medium mb-1">No categories yet</div>
          <button className="btn-primary mt-3" onClick={() => setShowCreate(true)}>+ Add Category</button>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Discipline</th>
                <th>Gender</th>
                <th>Age Group</th>
                <th>Weight</th>
                <th>Belt</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categories.map(c => (
                <tr key={c.id}>
                  <td className="text-white font-medium">{c.name}</td>
                  <td><span className={`badge ${c.discipline === 'kumite' ? 'badge-red' : 'badge-blue'}`}>{c.discipline}</span></td>
                  <td style={{ color: '#aaa' }} className="capitalize">{c.gender}</td>
                  <td style={{ color: '#aaa' }}>{c.ageGroup}</td>
                  <td style={{ color: '#aaa' }}>{c.weightClass || '—'}</td>
                  <td style={{ color: '#aaa' }}>{c.beltRange}</td>
                  <td>
                    <Link href={`/events/${eventId}/brackets/${c.id}`} className="text-xs" style={{ color: '#0066cc' }}>Brackets</Link>
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
