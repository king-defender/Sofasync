import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import PwaRegister from '@/components/PwaRegister';

export const metadata: Metadata = {
  title: 'SofaSync — Watch Together. Stay Connected.',
  description: 'Real-time social watch-along platform. Screen share or play local media together with live chat and webcam video calls.',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#6366f1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground min-h-screen flex flex-col">
        <PwaRegister />
        <Navbar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
