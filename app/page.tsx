import { requireChatGPTUser } from './chatgpt-auth';
import TrackerClient from './tracker-client';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await requireChatGPTUser('/');
  return <TrackerClient initialUserName={user.displayName} />;
}

// metadata: GPT-5.6 Sol; time: 2026-09-11 13:39 Australia/Sydney; date: 2026-09-11; prompt: Convert Diet Tracker to a private signed-in Site with synced data and AI analysis of meal descriptions, meal photos, and recipe photos.
// metadata: GPT-5.6 Sol; time: 2026-09-11 13:56 Australia/Sydney; date: 2026-09-11; prompt: Implement the complete signed-in Diet Tracker Site, including meal and recipe-photo AI analysis and reusable nutrition snapshots.
