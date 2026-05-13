import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { categories } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const { id } = await params;
    const eventId = parseInt(id);
    const categoryList = await db.select().from(categories).where(eq(categories.eventId, eventId));
    return NextResponse.json({ categories: categoryList });
  } catch (e: unknown) {
    return NextResponse.json({ categories: [], error: String(e) });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const { id } = await params;
    const eventId = parseInt(id);
    const body = await req.json();
    const [category] = await db.insert(categories).values({
      eventId,
      name: body.name,
      discipline: body.discipline,
      gender: body.gender,
      ageGroup: body.ageGroup,
      weightClass: body.weightClass || null,
      beltRange: body.beltRange,
    }).returning();
    return NextResponse.json({ category });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
