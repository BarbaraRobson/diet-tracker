import { getD1 } from './index';

/** Add a snapshot of the saved breakfast on the first visit to the current day. */
export async function ensureUsualBreakfast(userId:string, date:string) {
  const db=getD1();
  const marked=await db.prepare('SELECT meal_id FROM daily_starters WHERE user_id=? AND meal_date=?').bind(userId,date).first();
  if(marked) return;

  const template=await db.prepare("SELECT id FROM meal_templates WHERE user_id=? AND lower(trim(name))='usual breakfast' ORDER BY last_used_at DESC LIMIT 1").bind(userId).first<{id:string}>();
  if(!template) return;

  // A breakfast already logged before this feature went live must not be duplicated.
  const logged=await db.prepare('SELECT id FROM meals WHERE user_id=? AND meal_date=? AND (template_id=? OR lower(trim(name))=?) LIMIT 1')
    .bind(userId,date,template.id,'usual breakfast').first<{id:string}>();
  const id=logged ? null : crypto.randomUUID();
  const now=new Date().toISOString();
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO daily_starters (user_id,meal_date,meal_id) VALUES (?,?,?)').bind(userId,date,id),
    db.prepare(`INSERT INTO meals (id,user_id,meal_date,meal_time,name,description,source,template_id,energy_kj,protein_g,carbohydrate_g,sugars_g,fat_g,saturated_fat_g,fibre_g,sodium_mg,confidence,assumptions,created_at,updated_at)
      SELECT ?,?,?,?,t.name,t.description,'template',t.id,t.energy_kj,t.protein_g,t.carbohydrate_g,t.sugars_g,t.fat_g,t.saturated_fat_g,t.fibre_g,t.sodium_mg,t.confidence,t.assumptions,?,?
      FROM meal_templates t JOIN daily_starters s ON s.user_id=t.user_id AND s.meal_date=? AND s.meal_id=?
      WHERE t.user_id=? AND t.id=?`).bind(id,userId,date,'08:00',now,now,date,id,userId,template.id),
    db.prepare('INSERT INTO meal_units (meal_id,category_id,units) SELECT ?,tu.category_id,tu.units FROM template_units tu JOIN meals m ON m.id=? WHERE tu.template_id=?').bind(id,id,template.id),
    db.prepare('INSERT INTO meal_details (meal_id,components) SELECT ?,t.components FROM meal_templates t JOIN meals m ON m.id=? WHERE t.id=? AND t.user_id=?').bind(id,id,template.id,userId),
  ]);
}

// metadata: date: 2026-09-26; model: GPT-6; prompt: Start each new day with Usual breakfast while allowing its removal, and allow adding multiple saved foods at once.
