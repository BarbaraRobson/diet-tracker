import { requireApiUser, errorResponse, rejectCrossOriginMutation } from '@/lib/api';
import { ensureUserDefaults } from '@/db/ensure';
import { getD1 } from '@/db/index';
import { cleanText, readNutrients, validDate } from '@/lib/validation';
import { NUTRIENT_KEYS } from '@/lib/defaults';

export async function POST(request: Request) {
  const originError=rejectCrossOriginMutation(request); if(originError) return originError;
  const auth=await requireApiUser(); if(!auth.user) return auth.response;
  await ensureUserDefaults(auth.user.userId);
  let body:Record<string,unknown>; try { body=await request.json(); } catch { return errorResponse('Invalid meal data.'); }
  const date=body.date; if(!validDate(date)) return errorResponse('Choose a valid date.');
  const name=cleanText(body.name,120); if(!name) return errorResponse('Enter a meal name.');
  const time=/^([01]\d|2[0-3]):[0-5]\d$/.test(String(body.time || '')) ? String(body.time) : new Date().toISOString().slice(11,16);
  const source=['manual','ai','template'].includes(String(body.source)) ? String(body.source) : 'manual';
  const description=cleanText(body.description,2000);
  const nutrients=readNutrients(body.nutrients);
  const confidence=['high','medium','low'].includes(String(body.confidence)) ? String(body.confidence) : null;
  const assumptions=Array.isArray(body.assumptions) ? body.assumptions.map((item) => cleanText(item,240)).filter(Boolean).slice(0,12) : [];
  const components=Array.isArray(body.components) ? body.components.slice(0,40) : [];
  const templateId=cleanText(body.templateId,80) || null;
  const existingId=cleanText(body.id,80);
  const id=existingId || crypto.randomUUID();
  const db=getD1();
  if(existingId) { const owned=await db.prepare('SELECT id FROM meals WHERE id=? AND user_id=?').bind(existingId,auth.user.userId).first(); if(!owned) return errorResponse('Meal not found.',404); }
  const allowedRows=await db.prepare('SELECT id FROM categories WHERE user_id=?').bind(auth.user.userId).all();
  const allowed=new Set(allowedRows.results.map((row)=>String(row.id)));
  const unitSource=body.units && typeof body.units==='object' ? body.units as Record<string,unknown> : {};
  const units=Object.entries(unitSource).filter(([key])=>allowed.has(key)).map(([key,value])=>[key,Math.max(0,Math.min(100,Number(value)||0))] as const);
  const now=new Date().toISOString();
  const statements=[];
  if(existingId) {
    statements.push(db.prepare('UPDATE meals SET meal_date=?,meal_time=?,name=?,description=?,source=?,template_id=?,energy_kj=?,protein_g=?,carbohydrate_g=?,sugars_g=?,fat_g=?,saturated_fat_g=?,fibre_g=?,sodium_mg=?,confidence=?,assumptions=?,updated_at=? WHERE id=? AND user_id=?').bind(date,time,name,description,source,templateId,...NUTRIENT_KEYS.map((key)=>nutrients[key]),confidence,JSON.stringify(assumptions),now,id,auth.user.userId));
    statements.push(db.prepare('DELETE FROM meal_units WHERE meal_id=?').bind(id));
  } else {
    statements.push(db.prepare('INSERT INTO meals (id,user_id,meal_date,meal_time,name,description,source,template_id,energy_kj,protein_g,carbohydrate_g,sugars_g,fat_g,saturated_fat_g,fibre_g,sodium_mg,confidence,assumptions,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,auth.user.userId,date,time,name,description,source,templateId,...NUTRIENT_KEYS.map((key)=>nutrients[key]),confidence,JSON.stringify(assumptions),now,now));
  }
  statements.push(...units.map(([categoryId,value])=>db.prepare('INSERT INTO meal_units (meal_id,category_id,units) VALUES (?,?,?)').bind(id,categoryId,value)));
  let savedTemplateId:string|null=null;
  if(body.saveTemplate && !templateId) {
    savedTemplateId=crypto.randomUUID();
    statements.push(db.prepare('INSERT INTO meal_templates (id,user_id,name,description,source,energy_kj,protein_g,carbohydrate_g,sugars_g,fat_g,saturated_fat_g,fibre_g,sodium_mg,confidence,assumptions,components,created_at,updated_at,last_used_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(savedTemplateId,auth.user.userId,name,description,source,...NUTRIENT_KEYS.map((key)=>nutrients[key]),confidence,JSON.stringify(assumptions),JSON.stringify(components),now,now,now));
    statements.push(...units.map(([categoryId,value])=>db.prepare('INSERT INTO template_units (template_id,category_id,units) VALUES (?,?,?)').bind(savedTemplateId,categoryId,value)));
  }
  if(templateId) statements.push(db.prepare('UPDATE meal_templates SET last_used_at=? WHERE id=? AND user_id=?').bind(now,templateId,auth.user.userId));
  await db.batch(statements);
  return Response.json({ id, templateId:savedTemplateId ?? templateId });
}

// metadata: GPT-5.6 Sol; time: 2026-09-11 13:39 Australia/Sydney; date: 2026-09-11; prompt: Convert Diet Tracker to a private signed-in Site with synced data and AI analysis of meal descriptions, meal photos, and recipe photos.
// metadata: GPT-5.6 Sol; time: 2026-09-11 14:23 Australia/Sydney; date: 2026-09-11; prompt: Harden private Site mutation routes against cross-origin requests before deployment.
