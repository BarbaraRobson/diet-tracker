import { requireApiUser, errorResponse, rejectCrossOriginMutation } from '@/lib/api';
import { ensureUserDefaults } from '@/db/ensure';
import { getD1 } from '@/db/index';
import { cleanText } from '@/lib/validation';

export async function PUT(request:Request) {
  const originError=rejectCrossOriginMutation(request); if(originError) return originError;
  const auth=await requireApiUser(); if(!auth.user) return auth.response;
  await ensureUserDefaults(auth.user.userId);
  let body:{categories?:unknown}; try{body=await request.json();}catch{return errorResponse('Invalid settings.');}
  if(!Array.isArray(body.categories)||body.categories.length<1||body.categories.length>20) return errorResponse('Keep between 1 and 20 categories.');
  const seen=new Set<string>(); let categories:Array<{id:string;name:string;target:number;guide:string;index:number;locked:boolean}>;
  try {
    categories=body.categories.map((raw,index)=>{
      const item=raw && typeof raw==='object' ? raw as Record<string,unknown> : {};
      const id=cleanText(item.id,40).replace(/[^a-zA-Z0-9_-]/g,''); const name=cleanText(item.name,80); const target=Number(item.target); const guide=cleanText(item.guide,2000);
      if(!id||!name||seen.has(id)||!Number.isFinite(target)||target<0||target>100) throw new Error('Invalid category.'); seen.add(id);
      return {id,name,target,guide,index,locked:Boolean(item.locked)};
    });
  } catch { return errorResponse('Every category needs a unique name and ID, with a target from 0 to 100.'); }
  const db=getD1();
  const statements=[db.prepare('DELETE FROM categories WHERE user_id=?').bind(auth.user.userId),...categories.map((item)=>db.prepare('INSERT INTO categories (user_id,id,name,target,guide,sort_order,locked) VALUES (?,?,?,?,?,?,?)').bind(auth.user.userId,item.id,item.name,item.target,item.guide,item.index,item.locked?1:0))];
  await db.batch(statements); return Response.json({ok:true});
}

// metadata: GPT-5.6 Sol; time: 2026-09-11 13:39 Australia/Sydney; date: 2026-09-11; prompt: Convert Diet Tracker to a private signed-in Site with synced data and AI analysis of meal descriptions, meal photos, and recipe photos.
// metadata: GPT-5.6 Sol; time: 2026-09-11 14:14 Australia/Sydney; date: 2026-09-11; prompt: Validate and prepare the private Diet Tracker Site after configuring its dedicated API key.
// metadata: GPT-5.6 Sol; time: 2026-09-11 14:23 Australia/Sydney; date: 2026-09-11; prompt: Harden private Site mutation routes against cross-origin requests before deployment.
