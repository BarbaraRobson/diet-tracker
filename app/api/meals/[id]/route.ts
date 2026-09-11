import { requireApiUser, rejectCrossOriginMutation } from '@/lib/api';
import { ensureSchema } from '@/db/ensure';
import { getD1 } from '@/db/index';

export async function DELETE(request:Request,{ params }:{ params:Promise<{id:string}> }) {
  const originError=rejectCrossOriginMutation(request); if(originError) return originError;
  const auth=await requireApiUser(); if(!auth.user) return auth.response;
  await ensureSchema(); const { id }=await params; const db=getD1();
  const owned=await db.prepare('SELECT id FROM meals WHERE id=? AND user_id=?').bind(id,auth.user.userId).first();
  if(!owned) return Response.json({ error:'Meal not found.' },{ status:404 });
  await db.batch([db.prepare('DELETE FROM meal_units WHERE meal_id=?').bind(id),db.prepare('DELETE FROM meals WHERE id=? AND user_id=?').bind(id,auth.user.userId)]);
  return Response.json({ ok:true });
}

// metadata: GPT-5.6 Sol; time: 2026-09-11 13:39 Australia/Sydney; date: 2026-09-11; prompt: Convert Diet Tracker to a private signed-in Site with synced data and AI analysis of meal descriptions, meal photos, and recipe photos.
// metadata: GPT-5.6 Sol; time: 2026-09-11 14:23 Australia/Sydney; date: 2026-09-11; prompt: Harden private Site mutation routes against cross-origin requests before deployment.
