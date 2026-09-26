import { requireApiUser, errorResponse, rejectCrossOriginMutation } from '@/lib/api';
import { ensureUserDefaults } from '@/db/ensure';
import { getD1 } from '@/db/index';
import { validDate } from '@/lib/validation';

export async function POST(request:Request) {
  const originError=rejectCrossOriginMutation(request); if(originError) return originError;
  const auth=await requireApiUser(); if(!auth.user) return auth.response;
  let body:Record<string,unknown>; try { body=await request.json(); } catch { return errorResponse('Invalid saved-meal selection.'); }
  if(!validDate(body.date)) return errorResponse('Choose a valid date.');
  const ids=body.templateIds;
  if(!Array.isArray(ids)||ids.length<1||ids.length>20||ids.some(id=>typeof id!=='string'||id.length>80)||new Set(ids).size!==ids.length)
    return errorResponse('Select between 1 and 20 different saved meals.');
  const time=/^([01]\d|2[0-3]):[0-5]\d$/.test(String(body.time||''))?String(body.time):'12:00';
  await ensureUserDefaults(auth.user.userId);
  const db=getD1();
  const snapshots=[];
  for(const templateId of ids as string[]) {
    const template=await db.prepare('SELECT * FROM meal_templates WHERE id=? AND user_id=?').bind(templateId,auth.user.userId).first<Record<string,unknown>>();
    if(!template) return errorResponse('A selected saved meal could not be found. Refresh and try again.',404);
    const units=await db.prepare('SELECT category_id,units FROM template_units WHERE template_id=?').bind(templateId).all<{category_id:string;units:number}>();
    snapshots.push({template,units:units.results});
  }
  const now=new Date().toISOString();
  const statements:D1PreparedStatement[]=[];
  const createdIds:string[]=[];
  for(const {template,units} of snapshots) {
    const id=crypto.randomUUID(); createdIds.push(id);
    statements.push(db.prepare(`INSERT INTO meals (id,user_id,meal_date,meal_time,name,description,source,template_id,energy_kj,protein_g,carbohydrate_g,sugars_g,fat_g,saturated_fat_g,fibre_g,sodium_mg,confidence,assumptions,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,auth.user.userId,body.date,time,template.name,template.description,'template',template.id,template.energy_kj,template.protein_g,template.carbohydrate_g,template.sugars_g,template.fat_g,template.saturated_fat_g,template.fibre_g,template.sodium_mg,template.confidence,template.assumptions,now,now));
    statements.push(db.prepare('INSERT INTO meal_details (meal_id,components) VALUES (?,?)').bind(id,template.components));
    for(const unit of units) statements.push(db.prepare('INSERT INTO meal_units (meal_id,category_id,units) VALUES (?,?,?)').bind(id,unit.category_id,unit.units));
    statements.push(db.prepare('UPDATE meal_templates SET last_used_at=? WHERE id=? AND user_id=?').bind(now,template.id,auth.user.userId));
  }
  await db.batch(statements);
  return Response.json({ids:createdIds});
}

// metadata: date: 2026-09-26; model: GPT-6; prompt: Start each new day with Usual breakfast while allowing its removal, and allow adding multiple saved foods at once.
