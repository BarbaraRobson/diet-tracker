import type { Meal, MealTemplate, Nutrients } from './types';

type Row = Record<string, unknown>;

export function nutrientsFromRow(row: Row): Nutrients {
  return { energyKj:numOrNull(row.energy_kj), proteinG:numOrNull(row.protein_g), carbohydrateG:numOrNull(row.carbohydrate_g), sugarsG:numOrNull(row.sugars_g), fatG:numOrNull(row.fat_g), saturatedFatG:numOrNull(row.saturated_fat_g), fibreG:numOrNull(row.fibre_g), sodiumMg:numOrNull(row.sodium_mg) };
}

export function mealFromRow(row: Row, units: Record<string,number>): Meal {
  return { id:String(row.id), date:String(row.meal_date), time:String(row.meal_time), name:String(row.name), description:String(row.description || ''), source:String(row.source), templateId:row.template_id ? String(row.template_id) : null, confidence:row.confidence ? String(row.confidence) : null, assumptions:jsonArray(row.assumptions), units, ...nutrientsFromRow(row) };
}

export function templateFromRow(row: Row, units: Record<string,number>): MealTemplate {
  return { id:String(row.id), name:String(row.name), description:String(row.description || ''), source:String(row.source), confidence:row.confidence ? String(row.confidence) : null, assumptions:jsonArray(row.assumptions), components:jsonArray(row.components), units, ...nutrientsFromRow(row) };
}

function numOrNull(value: unknown) { return value === null || value === undefined ? null : Number(value); }
function jsonArray(value: unknown) { try { const parsed=JSON.parse(String(value || '[]')); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }

// metadata: GPT-5.6 Sol; time: 2026-09-11 13:39 Australia/Sydney; date: 2026-09-11; prompt: Convert Diet Tracker to a private signed-in Site with synced data and AI analysis of meal descriptions, meal photos, and recipe photos.
