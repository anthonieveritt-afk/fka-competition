import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

// ── Types ──────────────────────────────────────────────────────────────────
interface Athlete { id: number; first_name: string; surname: string; club: string; }
interface Slot { athleteId: number | null; name: string; club: string; }
interface BracketMatch {
  id: string; round: number; matchIndex: number;
  top: Slot; bottom: Slot; winnerId: number | null; bye: boolean;
}
interface BracketState { size: number; rounds: number; matches: BracketMatch[]; }

// ── Helpers ────────────────────────────────────────────────────────────────
function bracketSize(n: number) { let s = 4; while (s < n) s *= 2; return s; }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildBracket(athletes: Athlete[]): BracketState {
  const n = athletes.length;
  const size = bracketSize(n);
  const rounds = Math.log2(size);
  const slots: (Athlete | null)[] = new Array(size).fill(null);

  // Bresenham even-distribution — never fill sequentially
  athletes.forEach((a, i) => {
    const pos = Math.floor(i * size / n + size / (2 * n));
    slots[pos] = a;
  });

  const matches: BracketMatch[] = [];

  // Round 0 — seed matches
  for (let m = 0; m < size / 2; m++) {
    const top = slots[m * 2];
    const bot = slots[m * 2 + 1];
    const isBye = (!top && !!bot) || (!!top && !bot);
    const wid = isBye ? (top?.id ?? bot?.id ?? null) : null;
    matches.push({
      id: `R0-M${m}`, round: 0, matchIndex: m,
      top:    { athleteId: top?.id ?? null, name: top ? `${top.first_name} ${top.surname}` : 'BYE', club: top?.club ?? '' },
      bottom: { athleteId: bot?.id ?? null, name: bot ? `${bot.first_name} ${bot.surname}` : 'BYE', club: bot?.club ?? '' },
      winnerId: wid, bye: isBye,
    });
  }

  // Later rounds — empty slots
  for (let r = 1; r < rounds; r++) {
    const mc = size / Math.pow(2, r + 1);
    for (let m = 0; m < mc; m++) {
      matches.push({
        id: `R${r}-M${m}`, round: r, matchIndex: m,
        top:    { athleteId: null, name: '—', club: '' },
        bottom: { athleteId: null, name: '—', club: '' },
        winnerId: null, bye: false,
      });
    }
  }

  // Propagate first-round byes into round 1
  for (const m of matches.filter(x => x.round === 0 && x.bye && x.winnerId)) {
    const next = matches.find(x => x.id === `R1-M${Math.floor(m.matchIndex / 2)}`);
    if (!next) continue;
    if (m.matchIndex % 2 === 0) next.top    = { athleteId: m.winnerId!, name: '', club: '' };
    else                         next.bottom = { athleteId: m.winnerId!, name: '', club: '' };
    if (next.top.athleteId && !next.bottom.athleteId) { next.winnerId = next.top.athleteId;    next.bye = true; }
    if (!next.top.athleteId && next.bottom.athleteId) { next.winnerId = next.bottom.athleteId; next.bye = true; }
  }

  return { size, rounds, matches };
}

// R1 pairs: set of "id1-id2" strings (sorted) for all real R0 match-ups
function getR1Pairs(state: BracketState): Set<string> {
  const pairs = new Set<string>();
  for (const m of state.matches.filter(x => x.round === 0 && !x.bye)) {
    if (m.top.athleteId && m.bottom.athleteId) {
      pairs.add([m.top.athleteId, m.bottom.athleteId].sort((a, b) => a - b).join('-'));
    }
  }
  return pairs;
}

function hasConflict(newPairs: Set<string>, allPriorPairs: Set<string>[]): boolean {
  for (const pair of newPairs) {
    for (const prior of allPriorPairs) {
      if (prior.has(pair)) return true;
    }
  }
  return false;
}

// ── Route ──────────────────────────────────────────────────────────────────
export async function POST(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  const eventId = parseInt(id);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // Load all categories + their athletes for this event
    const catRes = await client.query(`
      SELECT c.id, c.name, c.discipline
      FROM comp_categories c
      WHERE c.event_id = $1
      ORDER BY c.id
    `, [eventId]);

    const results: any[] = [];
    const allPriorPairs: Set<string>[] = [];
    const MAX_ATTEMPTS = 20;

    for (const cat of catRes.rows) {
      const athRes = await client.query(`
        SELECT a.id, a.first_name, a.surname, a.club
        FROM comp_athletes a
        JOIN comp_registrations r ON r.athlete_id = a.id
        WHERE r.category_id = $1 AND r.event_id = $2
        ORDER BY a.surname, a.first_name
      `, [cat.id, eventId]);

      const athletes: Athlete[] = athRes.rows;

      if (athletes.length < 2) {
        results.push({ id: cat.id, name: cat.name, athletes: athletes.length, skipped: true, reason: 'fewer than 2 athletes' });
        continue;
      }

      let state: BracketState;
      let pairs: Set<string>;
      let attempts = 0;
      let conflictsResolved = false;

      // Attempt up to MAX_ATTEMPTS shuffles to avoid cross-category R1 conflicts
      do {
        const shuffled = shuffle(athletes);
        state = buildBracket(shuffled);
        pairs = getR1Pairs(state);
        attempts++;
        if (!hasConflict(pairs, allPriorPairs)) break;
        conflictsResolved = true;
      } while (attempts < MAX_ATTEMPTS);

      // Save bracket state (upsert)
      await client.query(`
        INSERT INTO comp_bracket_state (category_id, event_id, bracket_json, locked)
        VALUES ($1, $2, $3, false)
        ON CONFLICT (category_id, event_id)
        DO UPDATE SET bracket_json = $3, locked = false
      `, [cat.id, eventId, JSON.stringify(state!)]);

      allPriorPairs.push(pairs!);
      results.push({
        id: cat.id,
        name: cat.name,
        athletes: athletes.length,
        size: state!.size,
        attempts,
        conflictsResolved,
        skipped: false,
      });
    }

    const totalConflictsResolved = results.filter(r => r.conflictsResolved).length;

    return NextResponse.json({
      success: true,
      eventId,
      categories: results,
      totalConflictsResolved,
      summary: `${results.filter(r => !r.skipped).length} draws regenerated, ${totalConflictsResolved} cross-category conflicts resolved`,
    });

  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  } finally {
    client.release();
    await pool.end();
  }
}
