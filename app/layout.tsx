import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FKA Competition Manager',
  description: 'Frontier Karate Association — Competition Management System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ background: '#0a0a0a', color: '#ededed' }}>
        {children}
      </body>
    </html>
  );
}
