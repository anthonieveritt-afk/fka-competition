import { getDb } from '@/lib/db';
import { events, categories, registrations, athletes } from '@/lib/db/schema';
import { eq, count } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function EventPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const eventId = parseInt(id);
  let event = null;
  let categoryList: Array<{ id: number; name: string; discipline: string; gender: string; ageGroup: string; weightClass: string | null; beltRange: string }> = [];

  try {
    const [ev] = await db.select().from(events).where(eq(events.id, eventId));
    event = ev;
    if (!event) return notFound();
    categoryList = await db.select().from(categories).where(eq(categories.eventId, eventId));
  } catch (e) {}

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-white">Event not found.</div>
          <Link href="/events" className="btn-secondary mt-4 inline-block">← Events</Link>
        </div>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    draft: 'badge-gray',
    registration: 'badge-blue',
    live: 'badge-green',
    completed: 'badge-orange',
  };

  const kumiteCategories = categoryList.filter(c => c.discipline === 'kumite');
  const kataCategories = categoryList.filter(c => c.discipline === 'kata');

  return (
    <div className="min-h-screen px-4 py-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/events" className="text-sm" style={{ color: '#0066cc' }}>← Events</Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-bold text-white">{event.name}</h1>
          <span className={`badge ${statusColor[event.status]}`}>{event.status}</span>
        </div>
        <p className="text-sm mt-1" style={{ color: '#888' }}>{event.date} · {event.location} · {event.federation}</p>
      </div>

      {categoryList.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-white">Categories not yet published.</div>
        </div>
      ) : (
        <div className="space-y-6">
          {kumiteCategories.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#555' }}>Kumite</h2>
              <div className="space-y-2">
                {kumiteCategories.map(c => (
                  <Link key={c.id} href={`/events/${eventId}/brackets/${c.id}`} className="flex items-center justify-between card hover:border-white/20 transition-colors no-underline">
                    <div>
                      <div className="font-medium text-white">{c.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#666' }}>{c.ageGroup} · {c.beltRange} {c.weightClass ? `· ${c.weightClass}` : ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-red">kumite</span>
                      <span className="text-xs" style={{ color: '#0066cc' }}>Brackets →</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {kataCategories.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#555' }}>Kata</h2>
              <div className="space-y-2">
                {kataCategories.map(c => (
                  <Link key={c.id} href={`/events/${eventId}/brackets/${c.id}`} className="flex items-center justify-between card hover:border-white/20 transition-colors no-underline">
                    <div>
                      <div className="font-medium text-white">{c.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#666' }}>{c.ageGroup} · {c.beltRange}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-blue">kata</span>
                      <span className="text-xs" style={{ color: '#0066cc' }}>Brackets →</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
