import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    const list = await db.select({ id: events.id, name: events.name, date: events.date, status: events.status })
      .from(events).orderBy(desc(events.date));
    return NextResponse.json(list);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
