import { getDb } from '@/lib/db';
import { athletes, competitionResults } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PublicAthleteProfile({ params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const athleteId = parseInt(id);
  let athlete = null;
  let results: Array<{ id: number; eventName: string; eventDate: string; categoryName: string; position: number | null; medal: string | null }> = [];

  try {
    const [a] = await db.select().from(athletes).where(eq(athletes.id, athleteId));
    athlete = a;
    results = await db.select().from(competitionResults).where(eq(competitionResults.athleteId, athleteId));
  } catch (e) {}

  if (!athlete) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-lg">Athlete not found.</div>
          <Link href="/events" className="btn-secondary mt-4 inline-block">← Events</Link>
        </div>
      </div>
    );
  }

  const gold = results.filter(r => r.medal === 'gold').length;
  const silver = results.filter(r => r.medal === 'silver').length;
  const bronze = results.filter(r => r.medal === 'bronze').length;

  return (
    <div className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/events" className="text-sm" style={{ color: '#0066cc' }}>← Events</Link>
      </div>

      <div className="card mb-6 text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-4" style={{ background: '#222' }}>🥋</div>
        <h1 className="text-2xl font-bold text-white">{athlete.firstName} {athlete.surname}</h1>
        <p className="text-sm mt-1" style={{ color: '#888' }}>{athlete.club}</p>
        <div className="flex justify-center gap-6 mt-4">
          <div className="text-center"><div className="font-medium text-white">{athlete.grade}</div><div className="text-xs" style={{ color: '#666' }}>Grade</div></div>
          {athlete.weight && <div className="text-center"><div className="font-medium text-white">{athlete.weight}kg</div><div className="text-xs" style={{ color: '#666' }}>Weight</div></div>}
        </div>
      </div>

      {/* Medals */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center"><div className="text-3xl">🥇</div><div className="text-xl font-bold text-white mt-1">{gold}</div></div>
        <div className="card text-center"><div className="text-3xl">🥈</div><div className="text-xl font-bold text-white mt-1">{silver}</div></div>
        <div className="card text-center"><div className="text-3xl">🥉</div><div className="text-xl font-bold text-white mt-1">{bronze}</div></div>
      </div>

      {results.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-white mb-4">Competition History</h2>
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Date</th>
                <th>Category</th>
                <th>Place</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.id}>
                  <td className="text-white">{r.eventName}</td>
                  <td style={{ color: '#aaa' }}>{r.eventDate}</td>
                  <td style={{ color: '#aaa' }}>{r.categoryName}</td>
                  <td>{r.medal ? {gold:'🥇',silver:'🥈',bronze:'🥉'}[r.medal] || r.medal : `#${r.position}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
