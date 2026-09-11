import { requireApiUser } from '@/lib/api';
import { ensureUserDefaults } from '@/db/ensure';
import { getD1 } from '@/db/index';
import { validDate } from '@/lib/validation';
import { mealFromRow, nutrientsFromRow, templateFromRow } from '@/lib/rows';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireApiUser(); if (!auth.user) return auth.response;
  const selectedDate = new URL(request.url).searchParams.get('date');
  if (!validDate(selectedDate)) return Response.json({ error:'Invalid date.' }, { status:400 });
  await ensureUserDefaults(auth.user.userId);
  const db = getD1();
  const start = addDays(selectedDate, -6);
  const [categoryRows, mealRows, unitRows, templateRows, templateUnitRows, dailyRow, weeklyRow, weeklyUnitRows, dayRows] = await Promise.all([
    db.prepare('SELECT id,name,target,guide,sort_order,locked FROM categories WHERE user_id=? ORDER BY sort_order').bind(auth.user.userId).all(),
    db.prepare('SELECT * FROM meals WHERE user_id=? AND meal_date=? ORDER BY meal_time,created_at').bind(auth.user.userId, selectedDate).all(),
    db.prepare('SELECT mu.meal_id,mu.category_id,mu.units FROM meal_units mu JOIN meals m ON m.id=mu.meal_id WHERE m.user_id=? AND m.meal_date=?').bind(auth.user.userId, selectedDate).all(),
    db.prepare('SELECT * FROM meal_templates WHERE user_id=? ORDER BY last_used_at DESC LIMIT 30').bind(auth.user.userId).all(),
    db.prepare('SELECT tu.template_id,tu.category_id,tu.units FROM template_units tu JOIN meal_templates t ON t.id=tu.template_id WHERE t.user_id=?').bind(auth.user.userId).all(),
    nutritionTotals(db, auth.user.userId, selectedDate, selectedDate), nutritionTotals(db, auth.user.userId, start, selectedDate),
    db.prepare('SELECT mu.category_id,SUM(mu.units) total FROM meal_units mu JOIN meals m ON m.id=mu.meal_id WHERE m.user_id=? AND m.meal_date BETWEEN ? AND ? GROUP BY mu.category_id').bind(auth.user.userId,start,selectedDate).all(),
    db.prepare('SELECT DISTINCT meal_date FROM meals WHERE user_id=? AND meal_date BETWEEN ? AND ?').bind(auth.user.userId,start,selectedDate).all(),
  ]);
  const mealUnits = groupUnits(unitRows.results, 'meal_id');
  const templateUnits = groupUnits(templateUnitRows.results, 'template_id');
  return Response.json({
    selectedDate, weeklyStart:start, weeklyEnd:selectedDate, weeklyDaysRecorded:dayRows.results.length,
    user:{ displayName:auth.user.displayName },
    categories:categoryRows.results.map((row) => ({ id:String(row.id), name:String(row.name), target:Number(row.target), guide:String(row.guide || ''), sortOrder:Number(row.sort_order), locked:Boolean(row.locked) })),
    meals:mealRows.results.map((row) => mealFromRow(row, mealUnits[String(row.id)] || {})),
    templates:templateRows.results.map((row) => templateFromRow(row, templateUnits[String(row.id)] || {})),
    dailyNutrition:nutrientsFromRow(dailyRow || {}), weeklyNutrition:nutrientsFromRow(weeklyRow || {}),
    weeklyUnits:Object.fromEntries(weeklyUnitRows.results.map((row) => [String(row.category_id), Number(row.total)])),
  });
}

async function nutritionTotals(db:D1Database,userId:string,start:string,end:string) {
  return db.prepare('SELECT SUM(energy_kj) energy_kj,SUM(protein_g) protein_g,SUM(carbohydrate_g) carbohydrate_g,SUM(sugars_g) sugars_g,SUM(fat_g) fat_g,SUM(saturated_fat_g) saturated_fat_g,SUM(fibre_g) fibre_g,SUM(sodium_mg) sodium_mg FROM meals WHERE user_id=? AND meal_date BETWEEN ? AND ?').bind(userId,start,end).first<Record<string,unknown>>();
}
function groupUnits(rows:Record<string,unknown>[], key:string) { const grouped:Record<string,Record<string,number>>={}; for(const row of rows){ const id=String(row[key]); grouped[id]??={}; grouped[id][String(row.category_id)]=Number(row.units); } return grouped; }
function addDays(key:string,offset:number) { const date=new Date(`${key}T12:00:00Z`); date.setUTCDate(date.getUTCDate()+offset); return date.toISOString().slice(0,10); }

// metadata: GPT-5.6 Sol; time: 2026-09-11 13:39 Australia/Sydney; date: 2026-09-11; prompt: Convert Diet Tracker to a private signed-in Site with synced data and AI analysis of meal descriptions, meal photos, and recipe photos.
