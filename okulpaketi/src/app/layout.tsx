import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AtlasELT – OkulPaketi | WhatsApp Bilgilendirme',
  description: 'Teslimat bilgilendirme mesajları yönetim paneli',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
