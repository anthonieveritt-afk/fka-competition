'use client';
import { useEffect } from 'react';

export default function PrintBracketButton() {
  useEffect(() => {
    // Auto-trigger print dialog when ?print=1
    const timer = setTimeout(() => window.print(), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="no-print" style={{
      position: 'fixed', top: 16, right: 16, zIndex: 100,
      display: 'flex', gap: 8,
    }}>
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
