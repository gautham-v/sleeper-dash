import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'leaguemate.fyi',
    template: '%s | leaguemate.fyi',
  },
  description: 'Fantasy football analytics for your Sleeper leagues',
  metadataBase: new URL('https://leaguemate.fyi'),
  openGraph: {
    siteName: 'leaguemate.fyi',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
