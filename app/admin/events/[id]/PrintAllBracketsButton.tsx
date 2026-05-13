'use client';

interface Props {
  eventId: number;
  categories: { id: number; name: string }[];
}

export default function PrintAllBracketsButton({ eventId, categories }: Props) {
  const printAll = () => {
    // Open each bracket in a new tab — browser handles print
    categories.forEach((c, i) => {
      setTimeout(() => {
        window.open(`/events/${eventId}/brackets/${c.id}?print=1`, '_blank');
      }, i * 300); // stagger so they don't all open at once
    });
  };

  return (
    <button
      onClick={printAll}
      style={{
        background: '#1a1a1a', color: '#f5f5f5',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 8, padding: '8px 16px',
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
      }}
    >
      🖨 Print All Brackets ({categories.length})
    </button>
  );
}
