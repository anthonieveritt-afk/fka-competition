'use client';

import { useState } from 'react';

interface Props {
  eventId: number;
  categoryId: number;
  currentFormat: string;
  discipline: string;
  onToggled: (id: number, newFormat: string) => void;
}

export default function WukoToggleButton({ eventId, categoryId, currentFormat, discipline, onToggled }: Props) {
  const [loading, setLoading] = useState(false);
  const isWuko = currentFormat === 'wuko';

  // Only kata categories can be WUKO
  if (discipline !== 'kata') return null;

  const toggle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/categories/${categoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: isWuko ? 'bracket' : 'wuko' }),
      });
      const data = await res.json();
      if (data.category) onToggled(categoryId, data.category.format);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={isWuko ? 'Switch back to bracket format' : 'Switch to WUKO kata scoring'}
      style={{
        background: isWuko ? '#7c3aed22' : '#1a1a1a',
        color: isWuko ? '#a78bfa' : '#888',
        border: `1px solid ${isWuko ? '#7c3aed55' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700,
        cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.5 : 1,
      }}
    >
      {isWuko ? '✓ WUKO' : 'Set WUKO'}
    </button>
  );
}
