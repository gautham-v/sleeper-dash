import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'recordbook.fyi',
    template: '%s | recordbook.fyi',
  },
  description: 'Fantasy football analytics for your Sleeper leagues',
  metadataBase: new URL('https://recordbook.fyi'),
  openGraph: {
    siteName: 'recordbook.fyi',
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
