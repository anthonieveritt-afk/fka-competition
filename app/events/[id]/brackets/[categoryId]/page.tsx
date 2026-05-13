import { getDb } from '@/lib/db';
import { events, categories, matches, athletes, registrations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function BracketPage({ params }: { params: Promise<{ id: string; categoryId: string }> }) {
  const db = getDb();
  const { id, categoryId: categoryIdStr } = await params;
  const eventId = parseInt(id);
  const categoryId = parseInt(categoryIdStr);

  let event = null;
  let category = null;
  let matchList: Array<{
    id: number; roundType: string; matchNumber: number; tatami: number | null;
    status: string; redAthleteId: number | null; blueAthleteId: number | null;
    winnerId: number | null; method: string | null;
  }> = [];
  let athleteMap: Record<number, { firstName: string; surname: string; club: string }> = {};
  let registeredAthletes: Array<{ id: number; firstName: string; surname: string; club: string; grade: string | null }> = [];

  try {
    const [ev] = await db.select().from(events).where(eq(events.id, eventId));
    event = ev;
    const [cat] = await db.select().from(categories).where(eq(categories.id, categoryId));
    category = cat;

    if (!event || !category) return notFound();

    matchList = await db.select({
      id: matches.id, roundType: matches.roundType, matchNumber: matches.matchNumber,
      tatami: matches.tatami, status: matches.status,
      redAthleteId: matches.redAthleteId, blueAthleteId: matches.blueAthleteId,
      winnerId: matches.winnerId, method: matches.method,
    }).from(matches).where(and(eq(matches.categoryId, categoryId), eq(matches.eventId, eventId)));

    // Get registered athletes
    const regs = await db.select({
      athleteId: registrations.athleteId,
    }).from(registrations).where(and(eq(registrations.categoryId, categoryId), eq(registrations.eventId, eventId)));

    if (regs.length > 0) {
      const ids = regs.map(r => r.athleteId);
      const allAthletes = await db.select({
        id: athletes.id, firstName: athletes.firstName, surname: athletes.surname,
        club: athletes.club, grade: athletes.grade,
      }).from(athletes);
      registeredAthletes = allAthletes.filter(a => ids.includes(a.id));
      allAthletes.forEach(a => { athleteMap[a.id] = a; });
    }

    // Build athlete map from matches too
    const allAthletes = await db.select({
      id: athletes.id, firstName: athletes.firstName, surname: athletes.surname, club: athletes.club,
    }).from(athletes);
    allAthletes.forEach(a => { athleteMap[a.id] = a; });

  } catch (e) {}

  if (!event || !category) {
    return <div className="p-8 text-white">Not found or database not connected.</div>;
  }

  const getAthlete = (id: number | null) => id ? athleteMap[id] : null;

  return (
    <div className="min-h-screen px-4 py-8">
      {/* Print button */}
      <div className="no-print flex items-center justify-between max-w-5xl mx-auto mb-6">
        <Link href={`/events/${eventId}`} className="text-sm" style={{ color: '#0066cc' }}>← Event</Link>
        <button className="btn-secondary" onClick={() => window.print()}>🖨️ Print / Save PDF</button>
      </div>

      {/* Printable content */}
      <div className="max-w-5xl mx-auto" id="bracket-print">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🥋</div>
          <h1 className="text-2xl font-bold text-white">{event.name}</h1>
          <h2 className="text-xl mt-1" style={{ color: '#aaa' }}>{category.name}</h2>
          <p className="text-sm mt-1" style={{ color: '#666' }}>{event.date} · {event.location}</p>
          <p className="text-sm" style={{ color: '#666' }}>{category.ageGroup} · {category.beltRange} {category.weightClass ? `· ${category.weightClass}` : ''}</p>
        </div>

        {/* Registered athletes */}
        {registeredAthletes.length > 0 && (
          <div className="card mb-6">
            <h3 className="font-semibold text-white mb-4">Registered Athletes ({registeredAthletes.length})</h3>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Club</th>
                  <th>Grade</th>
                  <th className="no-print">Score</th>
                  <th className="no-print">Notes</th>
                </tr>
              </thead>
              <tbody>
                {registeredAthletes.map((a, i) => (
                  <tr key={a.id}>
                    <td style={{ color: '#666' }}>{i + 1}</td>
                    <td className="font-medium text-white">{a.firstName} {a.surname}</td>
                    <td style={{ color: '#aaa' }}>{a.club}</td>
                    <td style={{ color: '#aaa' }}>{a.grade}</td>
                    <td className="no-print" style={{ color: '#444' }}>____</td>
                    <td className="no-print" style={{ color: '#444' }}>____________________</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Match bracket */}
        {matchList.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-white mb-4">Draw / Bracket</h3>
            <table>
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Round</th>
                  <th>Red</th>
                  <th>Blue</th>
                  <th>Tatami</th>
                  <th>Status</th>
                  <th>Winner</th>
                </tr>
              </thead>
              <tbody>
                {matchList.sort((a, b) => a.matchNumber - b.matchNumber).map(m => {
                  const red = getAthlete(m.redAthleteId);
                  const blue = getAthlete(m.blueAthleteId);
                  const winner = getAthlete(m.winnerId);
                  return (
                    <tr key={m.id}>
                      <td style={{ color: '#888' }}>{m.matchNumber}</td>
                      <td style={{ color: '#aaa' }} className="capitalize">{m.roundType}</td>
                      <td>
                        {red ? (
                          <span className="text-white">{red.surname}<span style={{ color: '#666' }}> ({red.club})</span></span>
                        ) : <span style={{ color: '#444' }}>TBD</span>}
                      </td>
                      <td>
                        {blue ? (
                          <span className="text-white">{blue.surname}<span style={{ color: '#666' }}> ({blue.club})</span></span>
                        ) : <span style={{ color: '#444' }}>TBD</span>}
                      </td>
                      <td style={{ color: '#888' }}>{m.tatami ? `T${m.tatami}` : '—'}</td>
                      <td>
                        <span className={`badge ${m.status === 'complete' ? 'badge-green' : m.status === 'live' ? 'badge-orange' : 'badge-gray'}`}>{m.status}</span>
                      </td>
                      <td>
                        {winner ? <span className="font-medium" style={{ color: '#4dffaa' }}>{winner.surname}</span> : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {matchList.length === 0 && registeredAthletes.length === 0 && (
          <div className="card text-center py-12">
            <div className="text-white">Draw not yet published for this category.</div>
          </div>
        )}
      </div>


    </div>
  );
}
