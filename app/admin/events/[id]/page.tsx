import { getDb } from '@/lib/db';
import { events, categories, registrations, matches, athletes } from '@/lib/db/schema';
import { eq, count } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const eventId = parseInt(id);

  let event = null;
  let categoryList: Array<{
    id: number; name: string; discipline: string; gender: string; ageGroup: string; weightClass: string | null; beltRange: string | null
  }> = [];
  let regCount = 0;
  let matchList: Array<{
    id: number; roundType: string; matchNumber: number; tatami: number | null; status: string;
    redAthleteId: number | null; blueAthleteId: number | null;
  }> = [];

  try {
    const [ev] = await db.select().from(events).where(eq(events.id, eventId));
    event = ev;
    if (!event) return notFound();
    categoryList = await db.select().from(categories).where(eq(categories.eventId, eventId));
    const [rc] = await db.select({ count: count() }).from(registrations).where(eq(registrations.eventId, eventId));
    regCount = rc?.count ?? 0;
    matchList = await db.select({
      id: matches.id,
      roundType: matches.roundType,
      matchNumber: matches.matchNumber,
      tatami: matches.tatami,
      status: matches.status,
      redAthleteId: matches.redAthleteId,
      blueAthleteId: matches.blueAthleteId,
    }).from(matches).where(eq(matches.eventId, eventId)).limit(20);
  } catch (e) {
    // fallback
    if (!event) {
      return (
        <div className="p-8">
          <div className="card text-center py-12">
            <div className="text-white">Database not connected. Check your DATABASE_URL.</div>
          </div>
        </div>
      );
    }
  }

  if (!event) return notFound();

  const statusColor: Record<string, string> = {
    draft: 'badge-gray',
    registration: 'badge-blue',
    live: 'badge-green',
    completed: 'badge-orange',
    scheduled: 'badge-gray',
    complete: 'badge-green',
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/admin/events" className="text-sm" style={{ color: '#0066cc' }}>← Events</Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-bold text-white">{event.name}</h1>
          <span className={`badge ${statusColor[event.status]}`}>{event.status}</span>
        </div>
        <p className="text-sm mt-1" style={{ color: '#888' }}>{event.date} · {event.location} · {event.federation}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <div className="text-2xl font-bold text-white">{categoryList.length}</div>
          <div className="text-xs mt-1" style={{ color: '#888' }}>Categories</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-white">{regCount}</div>
          <div className="text-xs mt-1" style={{ color: '#888' }}>Registrations</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-white">{matchList.length}</div>
          <div className="text-xs mt-1" style={{ color: '#888' }}>Matches</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Categories</h2>
            <Link href={`/admin/events/${event.id}/categories`} className="btn-primary text-sm py-1">Manage</Link>
          </div>
          {categoryList.length === 0 ? (
            <div className="text-sm py-6 text-center" style={{ color: '#555' }}>
              No categories. <Link href={`/admin/events/${event.id}/categories`} style={{ color: '#0066cc' }}>Add categories →</Link>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Discipline</th>
                  <th>Age Group</th>
                </tr>
              </thead>
              <tbody>
                {categoryList.map(c => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/events/${eventId}/brackets/${c.id}`} className="text-white hover:underline">{c.name}</Link>
                    </td>
                    <td><span className={`badge ${c.discipline === 'kumite' ? 'badge-red' : 'badge-blue'}`}>{c.discipline}</span></td>
                    <td style={{ color: '#aaa' }}>{c.ageGroup}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Matches */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Recent Matches</h2>
          </div>
          {matchList.length === 0 ? (
            <div className="text-sm py-6 text-center" style={{ color: '#555' }}>No matches scheduled yet.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Round</th>
                  <th>Tatami</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {matchList.map(m => (
                  <tr key={m.id}>
                    <td style={{ color: '#888' }}>{m.matchNumber}</td>
                    <td style={{ color: '#aaa' }} className="capitalize">{m.roundType}</td>
                    <td style={{ color: '#aaa' }}>{m.tatami ? `T${m.tatami}` : '—'}</td>
                    <td><span className={`badge ${statusColor[m.status] || 'badge-gray'}`}>{m.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/admin/events/${event.id}/categories`} className="btn-secondary">Manage Categories</Link>
        <Link href={`/events/${event.id}`} className="btn-secondary">Public View</Link>
      </div>
    </div>
  );
}
