import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'ArchiMétro · plan de l’organisation',
  description: 'Visualisation d’une architecture d’entreprise sous forme de plan de métro.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" data-theme="light" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
