import { getDb } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function EventsPublicPage() {
  const db = getDb();
  let eventList: Array<{ id: number; name: string; date: string; location: string; status: string; federation: string }> = [];

  try {
    eventList = await db.select().from(events).orderBy(desc(events.date));
  } catch (e) {}

  const upcoming = eventList.filter(e => e.status !== 'completed');
  const past = eventList.filter(e => e.status === 'completed');

  const statusColor: Record<string, string> = {
    draft: 'badge-gray',
    registration: 'badge-blue',
    live: 'badge-green',
    completed: 'badge-orange',
  };

  return (
    <div className="min-h-screen px-4 py-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/" className="text-2xl">🥋</Link>
        <div>
          <h1 className="text-2xl font-bold text-white">FKA Events</h1>
          <p className="text-sm" style={{ color: '#888' }}>Frontier Karate Association Competitions</p>
        </div>
      </div>

      {upcoming.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: '#555' }}>Upcoming & Active</h2>
          <div className="space-y-3">
            {upcoming.map(e => (
              <Link key={e.id} href={`/events/${e.id}`} className="block card hover:border-white/20 transition-colors no-underline">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">{e.name}</div>
                    <div className="text-sm mt-1" style={{ color: '#888' }}>{e.date} · {e.location}</div>
                  </div>
                  <span className={`badge ${statusColor[e.status]}`}>{e.status}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: '#555' }}>Past Events</h2>
          <div className="space-y-3">
            {past.map(e => (
              <Link key={e.id} href={`/events/${e.id}`} className="block card hover:border-white/20 transition-colors no-underline">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">{e.name}</div>
                    <div className="text-sm mt-1" style={{ color: '#888' }}>{e.date} · {e.location}</div>
                  </div>
                  <span className="badge badge-gray">completed</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {eventList.length === 0 && (
        <div className="card text-center py-16">
          <div className="text-4xl mb-3">🏆</div>
          <div className="text-white font-medium">No events scheduled</div>
          <p className="text-sm mt-2" style={{ color: '#666' }}>Check back soon for upcoming competitions.</p>
        </div>
      )}
    </div>
  );
}
