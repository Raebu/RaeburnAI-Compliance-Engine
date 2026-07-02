import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RaeburnAI Compliance Engine',
  description: 'AI governance and compliance platform for GDPR, ISO 42001, ISO 27001, EU AI Act and UK AI guidance.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
