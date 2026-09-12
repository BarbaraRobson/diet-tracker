import { requireApiUser, errorResponse, rejectCrossOriginMutation } from '@/lib/api';
import { ensureUserDefaults } from '@/db/ensure';
import { getD1 } from '@/db/index';
import { cleanText, readNutrients } from '@/lib/validation';
import { NUTRIENT_KEYS } from '@/lib/defaults';

export async function PUT(request:Request,{params}:{params:Promise<{id:string}>}){
  const originError=rejectCrossOriginMutation(request);if(originError)return originError;
  const auth=await requireApiUser();if(!auth.user)return auth.response;
  await ensureUserDefaults(auth.user.userId);const {id}=await params;const db=getD1();
  const owned=await db.prepare('SELECT id FROM meal_templates WHERE id=? AND user_id=?').bind(id,auth.user.userId).first();
  if(!owned)return errorResponse('Saved meal not found.',404);
  let body:Record<string,unknown>;try{body=await request.json();}catch{return errorResponse('Invalid saved meal data.');}
  const name=cleanText(body.name,120);if(!name)return errorResponse('Enter a meal name.');
  const description=cleanText(body.description,2000);const nutrients=readNutrients(body);
  const unitSource=body.units&&typeof body.units==='object'?body.units as Record<string,unknown>:{};
  const allowedRows=await db.prepare('SELECT id FROM categories WHERE user_id=?').bind(auth.user.userId).all();const allowed=new Set(allowedRows.results.map(row=>String(row.id)));
  const units=Object.entries(unitSource).filter(([key])=>allowed.has(key)).map(([key,value])=>[key,Math.max(0,Math.min(100,Number(value)||0))] as const);
  const now=new Date().toISOString();
  await db.batch([db.prepare('UPDATE meal_templates SET name=?,description=?,energy_kj=?,protein_g=?,carbohydrate_g=?,sugars_g=?,fat_g=?,saturated_fat_g=?,fibre_g=?,sodium_mg=?,updated_at=? WHERE id=? AND user_id=?').bind(name,description,...NUTRIENT_KEYS.map(key=>nutrients[key]),now,id,auth.user.userId),db.prepare('DELETE FROM template_units WHERE template_id=?').bind(id),...units.map(([categoryId,value])=>db.prepare('INSERT INTO template_units (template_id,category_id,units) VALUES (?,?,?)').bind(id,categoryId,value))]);
  return Response.json({ok:true});
}

export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
  const originError=rejectCrossOriginMutation(request);if(originError)return originError;
  const auth=await requireApiUser();if(!auth.user)return auth.response;
  await ensureUserDefaults(auth.user.userId);const {id}=await params;const db=getD1();
  const owned=await db.prepare('SELECT id FROM meal_templates WHERE id=? AND user_id=?').bind(id,auth.user.userId).first();
  if(!owned)return errorResponse('Saved meal not found.',404);
  await db.batch([db.prepare('DELETE FROM template_units WHERE template_id=?').bind(id),db.prepare('DELETE FROM meal_templates WHERE id=? AND user_id=?').bind(id,auth.user.userId)]);
  return Response.json({ok:true});
}

// metadata: date: 2026-09-12; model: GPT (Codex; exact version unavailable); prompt: Let AI-added meals be named, manage saved meals, and round serving-scaled nutrition to integers.
