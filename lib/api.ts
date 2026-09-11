import { getChatGPTUser } from '@/app/chatgpt-auth';

export async function requireApiUser() {
  const user = await getChatGPTUser();
  if (!user) return { user:null, response:Response.json({ error:'Sign in required.' }, { status:401 }) } as const;
  return { user, response:null } as const;
}

export function errorResponse(message: string, status = 400) {
  return Response.json({ error:message }, { status });
}

export function rejectCrossOriginMutation(request: Request): Response | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  try {
    return origin === new URL(request.url).origin ? null : errorResponse('Cross-origin request rejected.', 403);
  } catch {
    return errorResponse('Invalid request origin.', 403);
  }
}

// metadata: GPT-5.6 Sol; time: 2026-09-11 13:39 Australia/Sydney; date: 2026-09-11; prompt: Convert Diet Tracker to a private signed-in Site with synced data and AI analysis of meal descriptions, meal photos, and recipe photos.
// metadata: GPT-5.6 Sol; time: 2026-09-11 14:23 Australia/Sydney; date: 2026-09-11; prompt: Harden private Site mutation routes against cross-origin requests before deployment.
