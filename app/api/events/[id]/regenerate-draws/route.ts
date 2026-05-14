import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

// ── Types ──────────────────────────────────────────────────────────────────
interface Athlete { id: number; first_name: string; surname: string; club: string; }

const FORZA = 'Forza Karate Club';
const JHKA  = 'JHKA';
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

// Interleave JHKA and Forza so they're likely to face each other in R1
function arrangeCrossClub(athletes: Athlete[]): Athlete[] {
  const jhka   = shuffle(athletes.filter(a => a.club === JHKA));
  const forza  = shuffle(athletes.filter(a => a.club === FORZA));
  const others = shuffle(athletes.filter(a => a.club !== JHKA && a.club !== FORZA));
  const interleaved: Athlete[] = [];
  const max = Math.max(jhka.length, forza.length);
  for (let i = 0; i < max; i++) {
    if (i < jhka.length)  interleaved.push(jhka[i]);
    if (i < forza.length) interleaved.push(forza[i]);
  }
  return [...interleaved, ...others];
}

// Count how many non-bye R1 matches pit athletes from different clubs
function countCrossClubPairs(state: BracketState, clubMap: Record<number, string>): number {
  return state.matches
    .filter(m => m.round === 0 && !m.bye && m.top.athleteId && m.bottom.athleteId)
    .filter(m => (clubMap[m.top.athleteId!] ?? '') !== (clubMap[m.bottom.athleteId!] ?? ''))
    .length;
}

function countSameClubPairs(state: BracketState, clubMap: Record<number, string>): number {
  return state.matches
    .filter(m => m.round === 0 && !m.bye && m.top.athleteId && m.bottom.athleteId)
    .filter(m => {
      const tc = clubMap[m.top.athleteId!] ?? '?';
      const bc = clubMap[m.bottom.athleteId!] ?? '?';
      return tc === bc && (tc === JHKA || tc === FORZA);
    })
    .length;
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

  // Propagate first-round byes into round 1.
  // ONLY mark R1 as bye+winner if BOTH feeder R0 matches are byes.
  // If the partner R0 match is a real contest, leave R1 winnerId null —
  // the winner gets set when that match is actually played on the day.
  for (const m of matches.filter(x => x.round === 0 && x.bye && x.winnerId)) {
    const next = matches.find(x => x.id === `R1-M${Math.floor(m.matchIndex / 2)}`);
    if (!next) continue;
    if (m.matchIndex % 2 === 0) next.top    = { athleteId: m.winnerId!, name: '', club: '' };
    else                         next.bottom = { athleteId: m.winnerId!, name: '', club: '' };

    // Check if the partner R0 match is also a bye (or empty — both slots null)
    const partnerIdx = m.matchIndex % 2 === 0 ? m.matchIndex + 1 : m.matchIndex - 1;
    const partner = matches.find(x => x.round === 0 && x.matchIndex === partnerIdx);
    const partnerAlsoBye = !partner || (partner.bye && !!partner.winnerId);

    // Only auto-complete R1 when both feeders are byes — never when a real match is pending
    if (partnerAlsoBye) {
      if (next.top.athleteId && !next.bottom.athleteId) { next.winnerId = next.top.athleteId;    next.bye = true; }
      if (!next.top.athleteId && next.bottom.athleteId) { next.winnerId = next.bottom.athleteId; next.bye = true; }
    }
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

      // Build club lookup for this category's athletes
      const clubMap: Record<number, string> = {};
      athletes.forEach(a => { clubMap[a.id] = a.club; });

      let state: BracketState;
      let pairs: Set<string>;
      let attempts = 0;
      let conflictsResolved = false;
      let bestState: BracketState | null = null;
      let bestCrossClub = -1;

      // Try up to MAX_ATTEMPTS arrangements:
      // - First attempt: structured JHKA/Forza interleave
      // - Subsequent: random shuffles
      // Pick the arrangement with most cross-club R1 pairs that has no cross-category conflicts
      do {
        const ordered = attempts === 0 ? arrangeCrossClub(athletes) : shuffle(athletes);
        const candidate = buildBracket(ordered);
        const candidatePairs = getR1Pairs(candidate);
        attempts++;

        if (!hasConflict(candidatePairs, allPriorPairs)) {
          const crossClub = countCrossClubPairs(candidate, clubMap);
          if (crossClub > bestCrossClub) {
            bestCrossClub = crossClub;
            bestState = candidate;
            pairs = candidatePairs;
            state = candidate;
            conflictsResolved = attempts > 1;
          }
          // Keep trying for a better cross-club arrangement
          if (bestCrossClub > 0 && attempts >= 5) break; // good enough early exit
        }
      } while (attempts < MAX_ATTEMPTS);

      // Fallback: if all attempts had cross-category conflicts, use the best cross-club one anyway
      if (!bestState) {
        const ordered = arrangeCrossClub(athletes);
        bestState = buildBracket(ordered);
        pairs = getR1Pairs(bestState);
        state = bestState;
      }

      state = bestState!;
      pairs = getR1Pairs(state);

      const sameClub = countSameClubPairs(state, clubMap);

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
        crossClubPairs: bestCrossClub,
        sameClubPairs: sameClub,
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
