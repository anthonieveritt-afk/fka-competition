import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const db = getDb();
    const eventList = await db.select().from(events).orderBy(desc(events.date));
    return NextResponse.json({ events: eventList });
  } catch (e: unknown) {
    return NextResponse.json({ events: [], error: String(e) });
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const body = await req.json();
    const [event] = await db.insert(events).values({
      name: body.name,
      date: body.date,
      location: body.location,
      federation: body.federation || 'FKA',
      status: 'draft',
    }).returning();
    return NextResponse.json({ event });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
