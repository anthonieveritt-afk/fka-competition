import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { athletes, registrations, competitionResults } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest) {
  try {
    const db = getDb();
    const imported = await db.select({ id: athletes.id }).from(athletes).where(eq(athletes.importedFrom, 'csv'));
    const ids = imported.map(a => a.id);
    if (ids.length === 0) return NextResponse.json({ ok: true, deleted: 0 });
    await db.delete(registrations).where(inArray(registrations.athleteId, ids));
    await db.delete(competitionResults).where(inArray(competitionResults.athleteId, ids));
    await db.delete(athletes).where(inArray(athletes.id, ids));
    return NextResponse.json({ ok: true, deleted: ids.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Delete failed' }, { status: 500 });
  }
}
