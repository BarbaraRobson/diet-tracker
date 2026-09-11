import { requireApiUser } from '@/lib/api';
import { ensureUserDefaults } from '@/db/ensure';
import { getD1 } from '@/db/index';

export async function GET(request:Request) {
  const auth=await requireApiUser(); if(!auth.user) return auth.response;
  await ensureUserDefaults(auth.user.userId); const db=getD1(); const format=new URL(request.url).searchParams.get('format')||'csv';
  const rows=await db.prepare('SELECT m.meal_date,m.meal_time,m.name,m.energy_kj,m.protein_g,m.carbohydrate_g,m.sugars_g,m.fat_g,m.saturated_fat_g,m.fibre_g,m.sodium_mg,GROUP_CONCAT(mu.category_id||\':\'||mu.units,\'|\') units FROM meals m LEFT JOIN meal_units mu ON mu.meal_id=m.id WHERE m.user_id=? GROUP BY m.id ORDER BY m.meal_date,m.meal_time').bind(auth.user.userId).all();
  if(format==='json') return new Response(JSON.stringify({app:'Diet Tracker',exportedAt:new Date().toISOString(),meals:rows.results},null,2),{headers:{'content-type':'application/json','content-disposition':'attachment; filename="diet-tracker.json"'}});
  const headers=['date','time','meal','kilojoules','protein_g','carbohydrate_g','sugars_g','fat_g','saturated_fat_g','fibre_g','sodium_mg','food_units'];
  const keys=['meal_date','meal_time','name','energy_kj','protein_g','carbohydrate_g','sugars_g','fat_g','saturated_fat_g','fibre_g','sodium_mg','units'];
  const csv=[headers,...rows.results.map((row)=>keys.map((key)=>safeCsv(row[key])))].map((row)=>row.join(',')).join('\n');
  return new Response(csv,{headers:{'content-type':'text/csv;charset=utf-8','content-disposition':'attachment; filename="diet-tracker.csv"'}});
}
function safeCsv(value:unknown){let text=String(value??'');if(/^[=+\-@]/.test(text))text=`'${text}`;return /[",\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;}

// metadata: GPT-5.6 Sol; time: 2026-09-11 13:39 Australia/Sydney; date: 2026-09-11; prompt: Convert Diet Tracker to a private signed-in Site with synced data and AI analysis of meal descriptions, meal photos, and recipe photos.
