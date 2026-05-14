'use client';

import { useState } from 'react';
import Link from 'next/link';
import PrintAllBracketsButton from './PrintAllBracketsButton';
import WukoToggleButton from './WukoToggleButton';

const disciplineColor: Record<string, string> = {
  kumite: '#ef4444', kata: '#0066cc', slam_man: '#f59e0b',
};
const disciplineLabel: Record<string, string> = {
  kumite: 'Kumite', kata: 'Kata', slam_man: 'Slam-Man',
};

export default function EventAdminClient({ eventId, event, initialCategories, totalRegs }: {
  eventId: number;
  event: any;
  initialCategories: any[];
  totalRegs: number;
}) {
  const [categories, setCategories] = useState<any[]>(initialCategories);

  const handleFormatToggle = (id: number, newFormat: string) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, format: newFormat } : c));
  };

  return (
    <div style={{ padding: '32px 24px', minHeight: '100vh', background: '#0a0a0a' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/admin/events" style={{ color: '#0066cc', fontSize: 13, textDecoration: 'none' }}>← Events</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          <h1 style={{ color: '#f5f5f5', fontSize: 24, fontWeight: 700 }}>{event.name}</h1>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
            background: event.status === 'registration' ? '#001a33' : '#1a1a1a',
            color: event.status === 'registration' ? '#0066cc' : '#888',
            border: '1px solid currentColor', textTransform: 'uppercase',
          }}>{event.status}</span>
        </div>
        <p style={{ color: '#888', fontSize: 14, marginTop: 4 }}>
          {event.date} · {event.location} · {event.federation}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Categories', val: categories.length, color: '#0066cc' },
          { label: 'Athletes registered', val: totalRegs, color: '#22c55e' },
          { label: 'Matches', val: 0, color: '#f59e0b' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px', textAlign: 'center' }}>
            <div style={{ color, fontSize: 28, fontWeight: 900 }}>{val}</div>
            <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <Link href={`/admin/events/${eventId}/categories`} style={{
          background: '#0066cc', color: '#fff', borderRadius: 8,
          padding: '8px 16px', fontSize: 13, fontWeight: 700, textDecoration: 'none',
        }}>Manage Categories</Link>
        <PrintAllBracketsButton eventId={eventId} categories={categories.map((c: any) => ({ id: c.id, name: c.name }))} />
        <Link href={`/admin/events/${eventId}/timetable`} style={{
          background: '#1a1a1a', color: '#f5f5f5', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, textDecoration: 'none',
        }}>🕐 Timetable</Link>
      </div>

      {/* Categories table */}
      <div style={{ background: '#141414', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ color: '#f5f5f5', fontSize: 16, fontWeight: 700 }}>Event Categories</h2>
          <span style={{ color: '#888', fontSize: 13 }}>{categories.length} categories</span>
        </div>

        {categories.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#555' }}>No categories found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Category', 'Discipline', 'Age Group', 'Athletes', 'Format', 'Action', 'Print'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((c: any) => (
                <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '12px 16px', color: '#f5f5f5', fontWeight: 600, fontSize: 14 }}>{c.name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: (disciplineColor[c.discipline] ?? '#888') + '22',
                      color: disciplineColor[c.discipline] ?? '#888',
                      border: `1px solid ${(disciplineColor[c.discipline] ?? '#888')}44`,
                    }}>
                      {disciplineLabel[c.discipline] ?? c.discipline}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#aaa', fontSize: 14 }}>{c.age_group}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ color: c.reg_count > 0 ? '#22c55e' : '#555', fontWeight: 700, fontSize: 15 }}>{c.reg_count}</span>
                  </td>
                  {/* WUKO toggle (kata only) */}
                  <td style={{ padding: '8px 16px' }}>
                    <WukoToggleButton
                      eventId={eventId}
                      categoryId={c.id}
                      currentFormat={c.format ?? 'bracket'}
                      discipline={c.discipline}
                      onToggled={handleFormatToggle}
                    />
                  </td>
                  {/* Action */}
                  <td style={{ padding: '12px 16px' }}>
                    {c.format === 'wuko' ? (
                      <Link href={`/events/${eventId}/wuko/${c.id}`} style={{ color: '#a78bfa', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Score →</Link>
                    ) : (
                      <Link href={`/events/${eventId}/brackets/${c.id}/draw`} style={{ color: '#0066cc', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Draw →</Link>
                    )}
                  </td>
                  {/* Print */}
                  <td style={{ padding: '12px 16px' }}>
                    {c.format === 'wuko' ? (
                      <Link href={`/events/${eventId}/wuko/${c.id}/print`} target="_blank" style={{
                        background: '#7c3aed22', color: '#a78bfa', border: '1px solid #7c3aed44',
                        borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, textDecoration: 'none',
                      }}>🖨 Print</Link>
                    ) : (
                      <Link href={`/events/${eventId}/brackets/${c.id}/print`} target="_blank" style={{
                        background: '#1a1a1a', color: '#f5f5f5', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, textDecoration: 'none',
                      }}>🖨 Print</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
