import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { athletes, registrations, competitionResults } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const athleteId = parseInt(id);
    if (isNaN(athleteId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    const db = getDb();
    // Remove from registrations and results first (FK constraint)
    await db.delete(registrations).where(eq(registrations.athleteId, athleteId));
    await db.delete(competitionResults).where(eq(competitionResults.athleteId, athleteId));
    await db.delete(athletes).where(eq(athletes.id, athleteId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Delete failed' }, { status: 500 });
  }
}
