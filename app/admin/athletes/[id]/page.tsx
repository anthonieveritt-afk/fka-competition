import { getDb } from '@/lib/db';
import { athletes, competitionResults } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AthleteProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  const athleteId = parseInt(id);

  let athlete = null;
  let results: Array<{
    id: number; eventName: string; eventDate: string; categoryName: string;
    position: number; medal: string | null; notes: string | null;
  }> = [];

  try {
    const [a] = await db.select().from(athletes).where(eq(athletes.id, athleteId));
    athlete = a;
    results = await db.select().from(competitionResults).where(eq(competitionResults.athleteId, athleteId));
  } catch (e) {}

  if (!athlete) {
    return (
      <div className="p-8">
        <div className="card text-center py-12">
          <div className="text-white">Athlete not found or database not connected.</div>
          <Link href="/admin/athletes" className="btn-secondary mt-4 inline-block">← Athletes</Link>
        </div>
      </div>
    );
  }

  const gold = results.filter(r => r.medal === 'gold').length;
  const silver = results.filter(r => r.medal === 'silver').length;
  const bronze = results.filter(r => r.medal === 'bronze').length;

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/admin/athletes" className="text-sm" style={{ color: '#0066cc' }}>← Athletes</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <div className="card">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl mb-4" style={{ background: '#222' }}>
              🥋
            </div>
            <h1 className="text-xl font-bold text-white">{athlete.firstName} {athlete.surname}</h1>
            <p className="text-sm mt-1" style={{ color: '#888' }}>{athlete.club}</p>
          </div>
          <div className="mt-6 space-y-3">
            {[
              ['Grade', athlete.grade],
              ['Gender', athlete.gender],
              ['DOB', athlete.dateOfBirth],
              ['Weight', athlete.weight ? `${athlete.weight}kg` : '—'],
              ['Email', athlete.email || '—'],
              ['Phone', athlete.phone || '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <span style={{ color: '#666' }}>{label}</span>
                <span className="text-white capitalize">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats + results */}
        <div className="lg:col-span-2 space-y-6">
          {/* Medal stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center">
              <div className="text-2xl mb-1">🥇</div>
              <div className="text-2xl font-bold text-white">{gold}</div>
              <div className="text-xs" style={{ color: '#888' }}>Gold</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl mb-1">🥈</div>
              <div className="text-2xl font-bold text-white">{silver}</div>
              <div className="text-xs" style={{ color: '#888' }}>Silver</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl mb-1">🥉</div>
              <div className="text-2xl font-bold text-white">{bronze}</div>
              <div className="text-xs" style={{ color: '#888' }}>Bronze</div>
            </div>
          </div>

          {/* Competition history */}
          <div className="card">
            <h2 className="font-semibold text-white mb-4">Competition History</h2>
            {results.length === 0 ? (
              <div className="text-sm text-center py-6" style={{ color: '#555' }}>No competition history yet.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Position</th>
                    <th>Medal</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(r => (
                    <tr key={r.id}>
                      <td className="text-white">{r.eventName}</td>
                      <td style={{ color: '#aaa' }}>{r.eventDate}</td>
                      <td style={{ color: '#aaa' }}>{r.categoryName}</td>
                      <td style={{ color: '#aaa' }}>{r.position}</td>
                      <td>{r.medal ? {gold:'🥇',silver:'🥈',bronze:'🥉'}[r.medal] || r.medal : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
