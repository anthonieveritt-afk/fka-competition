import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#0a0a0a' }}>
      <div className="text-center max-w-2xl">
        <div className="mb-6">
          <span className="text-6xl">🥋</span>
        </div>
        <h1 className="text-4xl font-bold mb-2 text-white">
          Frontier Karate Association
        </h1>
        <p className="text-lg mb-8" style={{ color: '#888' }}>
          Competition Management System
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
          <Link href="/admin" className="block p-6 rounded-lg text-left transition-all hover:scale-105" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-2xl mb-2">⚙️</div>
            <div className="font-semibold text-white">Admin Panel</div>
            <div className="text-sm mt-1" style={{ color: '#888' }}>Manage events, athletes, draws</div>
          </Link>
          <Link href="/events" className="block p-6 rounded-lg text-left transition-all hover:scale-105" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-2xl mb-2">🏆</div>
            <div className="font-semibold text-white">Events</div>
            <div className="text-sm mt-1" style={{ color: '#888' }}>View competitions & brackets</div>
          </Link>
          <Link href="/tatami/1" className="block p-6 rounded-lg text-left transition-all hover:scale-105" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-2xl mb-2">📊</div>
            <div className="font-semibold text-white">Tatami 1</div>
            <div className="text-sm mt-1" style={{ color: '#888' }}>Score keeper interface</div>
          </Link>
          <Link href="/scoreboard/1" className="block p-6 rounded-lg text-left transition-all hover:scale-105" style={{ background: '#141414', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-2xl mb-2">🖥️</div>
            <div className="font-semibold text-white">Scoreboard</div>
            <div className="text-sm mt-1" style={{ color: '#888' }}>Full-screen projection display</div>
          </Link>
        </div>
      </div>
    </main>
  );
}
