import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col" style={{ background: '#0f0f0f', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="p-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <Link href="/" className="flex items-center gap-2 text-white no-underline">
            <span className="text-2xl">🥋</span>
            <div>
              <div className="font-bold text-sm">FKA</div>
              <div className="text-xs" style={{ color: '#666' }}>Competition Manager</div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#555' }}>Management</div>
          <ul className="space-y-1 mb-6">
            <li>
              <Link href="/admin" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5 text-white no-underline">
                <span>📊</span> Dashboard
              </Link>
            </li>
            <li>
              <Link href="/admin/events" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5 text-white no-underline">
                <span>🏆</span> Events
              </Link>
            </li>
            <li>
              <Link href="/admin/athletes" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5 text-white no-underline">
                <span>👥</span> Athletes
              </Link>
            </li>
            <li>
              <Link href="/admin/athletes/import" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5 text-white no-underline">
                <span>📥</span> Import CSV
              </Link>
            </li>
          </ul>
          <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#555' }}>Live</div>
          <ul className="space-y-1">
            {[1,2,3,4,5,6,7,8].map(n => (
              <li key={n}>
                <Link href={`/tatami/${n}`} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5 text-white no-underline">
                  <span>🥊</span> Tatami {n}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <Link href="/events" className="text-xs" style={{ color: '#666' }}>← Public Site</Link>
        </div>
      </aside>
      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
