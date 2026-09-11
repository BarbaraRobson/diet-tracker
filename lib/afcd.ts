import reference from '@/data/afcd-reference.json';
import type { AnalysisComponent, Nutrients } from './types';

type Food = { key:string; name:string; energyKj:number; proteinG:number; carbohydrateG:number; sugarsG:number; fatG:number; saturatedFatG:number; fibreG:number; sodiumMg:number };
const foods = reference.foods as Food[];
const stop = new Set(['and','with','without','the','a','of','in','style','fresh','cooked','prepared']);

function terms(value: string) { return normalize(value).split(' ').filter((term) => term.length > 1 && !stop.has(term)); }
function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

function score(query: string, candidate: string) {
  const q = normalize(query); const c = normalize(candidate);
  if (!q) return 0;
  if (q === c) return 1;
  if (c.includes(q)) return Math.min(.94, .78 + q.length / Math.max(c.length, 1) * .16);
  const qt = terms(q); const ct = new Set(terms(c));
  const intersection = qt.filter((token) => ct.has(token)).length;
  if (!intersection) return 0;
  const recall = intersection / qt.length;
  const precision = intersection / Math.max(ct.size, 1);
  return recall * .72 + precision * .28;
}

export function matchAfcdFood(searchTerm: string) {
  let best: { food:Food; score:number } | null = null;
  for (const food of foods) {
    const value = score(searchTerm, food.name);
    if (!best || value > best.score) best = { food, score:value };
  }
  return best && best.score >= .58 ? best : null;
}

export function enrichComponent(component: Omit<AnalysisComponent,'matchedFoodKey'|'matchedFoodName'|'matchScore'|'nutritionSource'>): AnalysisComponent {
  const matched = matchAfcdFood(component.searchTerm || component.name);
  if (!matched) return { ...component, matchedFoodKey:null, matchedFoodName:null, matchScore:null, nutritionSource:'AI estimate' };
  const factor = component.grams / 100;
  const nutrition = Object.fromEntries(['energyKj','proteinG','carbohydrateG','sugarsG','fatG','saturatedFatG','fibreG','sodiumMg'].map((key) => [key, round((matched.food[key as keyof Food] as number) * factor)])) as Nutrients;
  return { ...component, ...nutrition, matchedFoodKey:matched.food.key, matchedFoodName:matched.food.name, matchScore:round(matched.score, 3), nutritionSource:'AFCD' };
}

export function totalComponents(components: AnalysisComponent[]): Nutrients {
  const keys = ['energyKj','proteinG','carbohydrateG','sugarsG','fatG','saturatedFatG','fibreG','sodiumMg'] as const;
  return Object.fromEntries(keys.map((key) => [key, round(components.reduce((sum, item) => sum + Number(item[key] || 0), 0))])) as Nutrients;
}

function round(value: number, places = 1) { const factor = 10 ** places; return Math.round(value * factor) / factor; }

// metadata: GPT-5.6 Sol; time: 2026-09-11 13:39 Australia/Sydney; date: 2026-09-11; prompt: Convert Diet Tracker to a private signed-in Site with synced data and AI analysis of meal descriptions, meal photos, and recipe photos.
