import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://barbara-diet-tracker.bjrobson.chatgpt.site'),
  title: 'Diet Tracker',
  description: 'A private, synced diet-unit and nutrition tracker.',
  applicationName: 'Diet Tracker',
  appleWebApp: { capable: true, title: 'Diet Tracker', statusBarStyle: 'default' },
  icons: {
    apple: '/icons/icon-192.png',
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
  openGraph: {
    title: 'Diet Tracker',
    description: 'Private, synced food-unit and nutrition tracking.',
    url: '/',
    siteName: 'Diet Tracker',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'Diet Tracker' }],
    type: 'website',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-AU"><body>{children}</body></html>;
}

// metadata: GPT-5.6 Sol; time: 2026-09-11 13:39 Australia/Sydney; date: 2026-09-11; prompt: Convert Diet Tracker to a private signed-in Site with synced data and AI analysis of meal descriptions, meal photos, and recipe photos.
// metadata: GPT-5.6 Sol; time: 2026-09-11 14:14 Australia/Sydney; date: 2026-09-11; prompt: Add iOS and installable-app metadata to the private Diet Tracker Site.
// metadata: GPT-5.6 Sol; time: 2026-09-11 14:31 Australia/Sydney; date: 2026-09-11; prompt: Bind absolute metadata to the newly created private Diet Tracker Site origin.
