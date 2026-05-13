'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Event = {
  id: number;
  name: string;
  date: string;
  location: string;
  federation: string;
  status: string;
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', date: '', location: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/events').then(r => r.json()).then(data => {
      setEvents(data.events || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.event) setEvents(prev => [data.event, ...prev]);
    setShowCreate(false);
    setForm({ name: '', date: '', location: '' });
    setSaving(false);
  };

  const statusColor: Record<string, string> = {
    draft: 'badge-gray',
    registration: 'badge-blue',
    live: 'badge-green',
    completed: 'badge-orange',
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Events</h1>
          <p style={{ color: '#888' }}>Manage competitions</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ New Event</button>
      </div>

      {/* Create form modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)' }}>
          <div className="card w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">Create Event</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: '#888' }}>Event Name</label>
                <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="FKA Spring Open 2026" />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: '#888' }}>Date</label>
                <input required type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: '#888' }}>Location</label>
                <input required value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Sports Centre, City" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Event'}</button>
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12" style={{ color: '#555' }}>Loading events...</div>
      ) : events.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">🏆</div>
          <div className="text-white font-medium mb-1">No events yet</div>
          <div className="text-sm mb-4" style={{ color: '#888' }}>Create your first competition event</div>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>+ Create Event</button>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Date</th>
                <th>Location</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {events.map(e => (
                <tr key={e.id}>
                  <td>
                    <Link href={`/admin/events/${e.id}`} className="text-white font-medium hover:underline">{e.name}</Link>
                    <div className="text-xs mt-0.5" style={{ color: '#555' }}>{e.federation}</div>
                  </td>
                  <td style={{ color: '#aaa' }}>{e.date}</td>
                  <td style={{ color: '#aaa' }}>{e.location}</td>
                  <td><span className={`badge ${statusColor[e.status] || 'badge-gray'}`}>{e.status}</span></td>
                  <td>
                    <Link href={`/admin/events/${e.id}`} className="text-xs" style={{ color: '#0066cc' }}>Manage →</Link>
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
