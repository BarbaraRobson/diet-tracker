import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Diet Tracker',
    short_name: 'Diet Tracker',
    description: 'Private, synced diet-unit and nutrition tracking.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fff9fb',
    theme_color: '#d93f7a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}

// metadata: GPT-5.6 Sol; time: 2026-09-11 14:14 Australia/Sydney; date: 2026-09-11; prompt: Add installable Site metadata to the private signed-in Diet Tracker.
