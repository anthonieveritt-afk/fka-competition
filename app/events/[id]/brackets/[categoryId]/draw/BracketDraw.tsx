'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';

interface Athlete { id: number; first_name: string; surname: string; club: string; grade: string | null; ekf_licence: string | null; }
interface Props {
  event: any; category: any; initialAthletes: Athlete[];
  eventId: number; categoryId: number;
}

function bracketSize(n: number) { let s = 4; while (s < n) s *= 2; return s; }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildSeeds(athletes: Athlete[], size: number): (Athlete | null)[] {
  const slots: (Athlete | null)[] = new Array(size).fill(null);
  athletes.forEach((a, i) => { if (i < size) slots[i] = a; });
  return slots;
}

export default function BracketDraw({ event, category, initialAthletes, eventId, categoryId }: Props) {
  const [seeds, setSeeds] = useState<(Athlete | null)[]>(() => buildSeeds(initialAthletes, bracketSize(initialAthletes.length)));
  const [locked, setLocked] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const size = seeds.length;
  const rounds = Math.log2(size);
  const athleteCount = initialAthletes.length;

  const doShuffle = () => {
    if (locked) return;
    const athletes = initialAthletes.filter(Boolean);
    const shuffled = shuffle(athletes);
    setSeeds(buildSeeds(shuffled, size));
  };

  const onDragStart = (i: number) => { if (!locked) setDragging(i); };
  const onDragEnter = (i: number) => { if (!locked) setDragOver(i); };
  const onDrop = (i: number) => {
    if (locked || dragging === null || dragging === i) { setDragging(null); setDragOver(null); return; }
    const newSeeds = [...seeds];
    [newSeeds[dragging], newSeeds[i]] = [newSeeds[i], newSeeds[dragging]];
    setSeeds(newSeeds);
    setDragging(null); setDragOver(null);
  };

  const moveUp = (i: number) => {
    if (locked || i === 0) return;
    const s = [...seeds]; [s[i], s[i - 1]] = [s[i - 1], s[i]]; setSeeds(s);
  };
  const moveDown = (i: number) => {
    if (locked || i >= size - 1) return;
    const s = [...seeds]; [s[i], s[i + 1]] = [s[i + 1], s[i]]; setSeeds(s);
  };

  const disciplineColor: Record<string, string> = { kumite: '#ef4444', kata: '#0066cc', slam_man: '#f59e0b' };
  const accentColor = disciplineColor[category.discipline] ?? '#0066cc';

  // Render bracket columns recursively
  // Each round: matches = size / 2^(round+1), each match occupies 2^(round+1) slots
  const SLOT_H = 32; // px per athlete slot
  const SLOT_W = 180;
  const GAP = 2;

  const renderBracket = () => {
    const cols = [];
    for (let round = 0; round < rounds; round++) {
      const matchCount = size / Math.pow(2, round + 1);
      const slotsPerMatch = Math.pow(2, round + 1);
      const matchH = slotsPerMatch * (SLOT_H + GAP);
      const topPad = round === 0 ? 0 : (slotsPerMatch / 4) * (SLOT_H + GAP);

      const matches = [];
      for (let m = 0; m < matchCount; m++) {
        const topSlot = round === 0 ? m * 2 : -1;
        const botSlot = round === 0 ? m * 2 + 1 : -1;

        matches.push(
          <div key={m} style={{
            height: matchH, display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between', position: 'relative',
            paddingTop: topPad, paddingBottom: topPad,
          }}>
            {/* Top athlete slot */}
            <div style={{
              height: SLOT_H, background: '#fff', border: '1px solid #ccc',
              display: 'flex', alignItems: 'center', paddingLeft: 6,
              fontSize: 11, fontWeight: round === 0 ? 500 : 400,
              color: round === 0 && topSlot >= 0 && seeds[topSlot] ? '#000' : '#aaa',
              boxSizing: 'border-box',
            }}>
              {round === 0 && topSlot >= 0
                ? (seeds[topSlot] ? `${seeds[topSlot]!.first_name} ${seeds[topSlot]!.surname}` : 'BYE')
                : ''}
            </div>

            {/* Vertical connector line on right */}
            <div style={{
              position: 'absolute', right: 0, top: topPad + SLOT_H / 2,
              bottom: topPad + SLOT_H / 2,
              width: 1, background: '#999',
            }} />
            {/* Horizontal line from vertical to next column */}
            <div style={{
              position: 'absolute', right: 0, top: '50%',
              width: 20, height: 1, background: '#999',
              transform: 'translateY(-50%)',
            }} />

            {/* Bottom athlete slot */}
            <div style={{
              height: SLOT_H, background: '#fff', border: '1px solid #ccc',
              display: 'flex', alignItems: 'center', paddingLeft: 6,
              fontSize: 11, fontWeight: round === 0 ? 500 : 400,
              color: round === 0 && botSlot >= 0 && seeds[botSlot] ? '#000' : '#aaa',
              boxSizing: 'border-box',
            }}>
              {round === 0 && botSlot >= 0
                ? (seeds[botSlot] ? `${seeds[botSlot]!.first_name} ${seeds[botSlot]!.surname}` : 'BYE')
                : ''}
            </div>
          </div>
        );
      }

      cols.push(
        <div key={round} style={{
          display: 'flex', flexDirection: 'column',
          width: SLOT_W, flexShrink: 0,
          marginLeft: round === 0 ? 0 : 20,
        }}>
          <div style={{ color: '#888', fontSize: 10, fontWeight: 700, textAlign: 'center', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
            {round === 0 ? 'R1' : round === rounds - 2 ? 'Semi' : round === rounds - 1 ? 'Final' : `R${round + 1}`}
          </div>
          {matches}
        </div>
      );
    }

    // Medal boxes
    const finalH = size * (SLOT_H + GAP);
    cols.push(
      <div key="medals" style={{ marginLeft: 40, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12, width: 140 }}>
        <div style={{ background: '#FFD700', border: '1px solid #999', borderRadius: 6, padding: '8px 12px', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>🥇 1st Place</div>
        <div style={{ background: '#C0C0C0', border: '1px solid #999', borderRadius: 6, padding: '8px 12px', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>🥈 2nd Place</div>
        <div style={{ background: '#CD7F32', border: '1px solid #999', borderRadius: 6, padding: '8px 12px', fontSize: 12, fontWeight: 600, textAlign: 'center', color: '#fff' }}>🥉 3rd Place</div>
        <div style={{ background: '#CD7F32', border: '1px solid #999', borderRadius: 6, padding: '8px 12px', fontSize: 12, fontWeight: 600, textAlign: 'center', color: '#fff' }}>🥉 3rd Place</div>
      </div>
    );

    return cols;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', fontFamily: 'Arial, sans-serif' }}>

      {/* Controls — hidden on print */}
      <div className="no-print" style={{ background: '#0a0a0a', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Link href={`/admin/events/${eventId}`} style={{ color: '#0066cc', fontSize: 13, textDecoration: 'none' }}>← Event</Link>
        <span style={{ color: '#888', fontSize: 13 }}>|</span>
        <span style={{ color: '#f5f5f5', fontSize: 14, fontWeight: 700 }}>{category.name}</span>
        <span style={{ color: '#888', fontSize: 13 }}>— {athleteCount} athletes / {size}-bracket</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {!locked ? (
            <>
              <button onClick={doShuffle} style={{ background: '#f59e0b', color: '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                🔀 Shuffle Draw
              </button>
              <button onClick={() => setLocked(true)} style={{ background: '#22c55e', color: '#000', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                🔒 Lock Draw
              </button>
            </>
          ) : (
            <button onClick={() => setLocked(false)} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              🔓 Unlock Draw
            </button>
          )}
          <button onClick={() => window.print()} style={{ background: '#0066cc', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            🖨 Print
          </button>
        </div>
      </div>

      {/* Left panel — seed list (drag to reorder) */}
      <div className="no-print" style={{ display: 'flex', gap: 0 }}>
        <div style={{ width: 300, background: '#1a1a1a', padding: '16px 12px', minHeight: 'calc(100vh - 52px)', borderRight: '1px solid #333' }}>
          <div style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
            {locked ? '🔒 Draw Locked' : '↕ Drag to reorder'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {seeds.map((a, i) => (
              <div
                key={i}
                draggable={!locked}
                onDragStart={() => onDragStart(i)}
                onDragEnter={() => onDragEnter(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => onDrop(i)}
                style={{
                  background: dragOver === i ? '#0066cc22' : a ? '#1e1e1e' : '#111',
                  border: `1px solid ${dragOver === i ? '#0066cc' : dragging === i ? '#f59e0b' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 6, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8,
                  cursor: locked ? 'default' : 'grab', opacity: a ? 1 : 0.4,
                  transition: 'background 0.1s, border 0.1s',
                }}
              >
                <span style={{ color: '#555', fontSize: 11, fontWeight: 700, minWidth: 20 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: a ? '#f5f5f5' : '#555', fontSize: 13, fontWeight: a ? 600 : 400 }}>
                    {a ? `${a.first_name} ${a.surname}` : 'BYE'}
                  </div>
                  {a && <div style={{ color: '#666', fontSize: 10 }}>{a.club}</div>}
                </div>
                {!locked && a && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <button onClick={() => moveUp(i)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 10, padding: '1px 4px' }}>▲</button>
                    <button onClick={() => moveDown(i)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 10, padding: '1px 4px' }}>▼</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bracket preview */}
        <div style={{ flex: 1, padding: 24, overflowX: 'auto' }}>
          <div ref={printRef} id="bracket-print">
            {/* Print header */}
            <div style={{
              background: '#1A1A8C', color: '#fff', padding: '12px 20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 16, borderRadius: 4,
            }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 0.5 }}>{category.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                  {event.name} · {event.location} · {event.date}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                <div style={{ fontWeight: 700 }}>Tatami 1 | Pool 1/1</div>
                <div style={{ marginTop: 2 }}>{athleteCount} Athletes · {size}-draw</div>
              </div>
            </div>

            {/* Bracket */}
            <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 16 }}>
              {renderBracket()}
            </div>

            {/* Print footer */}
            <div style={{ borderTop: '1px solid #ccc', marginTop: 24, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888' }}>
              <span>{event.name} · {category.name}</span>
              <span>Printed: {new Date().toLocaleDateString('en-GB')}</span>
              <span>FKA Competition System</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; }
          @page { size: A4 landscape; margin: 10mm; }
          #bracket-print { display: block !important; }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>
    </div>
  );
}
