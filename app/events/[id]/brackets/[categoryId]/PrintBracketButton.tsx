'use client';
import { useEffect, useState } from 'react';

export default function PrintBracketButton() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Wait for full render before triggering print
    const timer = setTimeout(() => {
      setReady(true);
      window.print();
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="no-print" style={{
      position: 'fixed', top: 16, right: 16, zIndex: 100,
      display: 'flex', gap: 8, alignItems: 'center',
    }}>
      {!ready && <span style={{ color: '#888', fontSize: 13 }}>Loading…</span>}
      <button
        onClick={() => window.print()}
        style={{
          background: '#0066cc', color: '#fff', border: 'none',
          borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        }}
      >
        🖨 Print / Save PDF
      </button>
      <button
        onClick={() => window.close()}
        style={{
          background: '#333', color: '#fff', border: 'none',
          borderRadius: 8, padding: '10px 16px', fontSize: 14, cursor: 'pointer',
        }}
      >✕</button>
    </div>
  );
}
