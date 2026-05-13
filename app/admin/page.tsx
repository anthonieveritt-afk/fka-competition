import { getDb } from '@/lib/db';
import { events, athletes, registrations, matches } from '@/lib/db/schema';
import { desc, count, eq } from 'drizzle-orm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const db = getDb();

  let eventList: Array<{ id: number; name: string; date: string; location: string; status: string }> = [];
  let athleteCount = 0;
  let matchCount = 0;
  let recentAthletes: Array<{ id: number; firstName: string; surname: string; club: string; createdAt: Date }> = [];

  try {
    eventList = await db.select().from(events).orderBy(desc(events.date)).limit(5);
    const [ac] = await db.select({ count: count() }).from(athletes);
    athleteCount = ac?.count ?? 0;
    const [mc] = await db.select({ count: count() }).from(matches);
    matchCount = mc?.count ?? 0;
    recentAthletes = await db.select({
      id: athletes.id,
      firstName: athletes.firstName,
      surname: athletes.surname,
      club: athletes.club,
      createdAt: athletes.createdAt,
    }).from(athletes).orderBy(desc(athletes.createdAt)).limit(5);
  } catch (e) {
    // DB not connected in dev
  }

  const statusColor: Record<string, string> = {
    draft: 'badge-gray',
    registration: 'badge-blue',
    live: 'badge-green',
    completed: 'badge-orange',
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
        <p style={{ color: '#888' }}>Welcome to the FKA Competition Manager</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <div className="text-3xl font-bold text-white mb-1">{eventList.length || 0}</div>
          <div className="text-sm" style={{ color: '#888' }}>Total Events</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-white mb-1">{athleteCount}</div>
          <div className="text-sm" style={{ color: '#888' }}>Registered Athletes</div>
        </div>
        <div className="card">
          <div className="text-3xl font-bold text-white mb-1">{matchCount}</div>
          <div className="text-sm" style={{ color: '#888' }}>Total Matches</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Events</h2>
            <Link href="/admin/events" className="text-xs" style={{ color: '#0066cc' }}>View all →</Link>
          </div>
          {eventList.length === 0 ? (
            <div className="text-sm py-6 text-center" style={{ color: '#555' }}>No events yet. <Link href="/admin/events" style={{ color: '#0066cc' }}>Create one →</Link></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {eventList.map(e => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/admin/events/${e.id}`} className="text-white hover:underline">{e.name}</Link>
                    </td>
                    <td style={{ color: '#888' }}>{e.date}</td>
                    <td><span className={`badge ${statusColor[e.status] || 'badge-gray'}`}>{e.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Athletes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">Recent Athletes</h2>
            <Link href="/admin/athletes" className="text-xs" style={{ color: '#0066cc' }}>View all →</Link>
          </div>
          {recentAthletes.length === 0 ? (
            <div className="text-sm py-6 text-center" style={{ color: '#555' }}>No athletes yet. <Link href="/admin/athletes/import" style={{ color: '#0066cc' }}>Import CSV →</Link></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Club</th>
                </tr>
              </thead>
              <tbody>
                {recentAthletes.map(a => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/admin/athletes/${a.id}`} className="text-white hover:underline">{a.firstName} {a.surname}</Link>
                    </td>
                    <td style={{ color: '#888' }}>{a.club}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/admin/events" className="btn-primary">+ New Event</Link>
        <Link href="/admin/athletes/import" className="btn-secondary">Import Athletes</Link>
        <Link href="/tatami/1" className="btn-secondary">Open Tatami 1</Link>
      </div>
    </div>
  );
}
