import { NUTRIENT_KEYS, type NutrientKey } from './defaults';
import type { Nutrients } from './types';

export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function boundedNumber(value: unknown, maximum = 1_000_000): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= maximum ? number : null;
}

export function readNutrients(value: unknown): Nutrients {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, boundedNumber(source[key])])) as Nutrients;
}

export function nutrientColumn(key: NutrientKey): string {
  return ({ energyKj:'energy_kj', proteinG:'protein_g', carbohydrateG:'carbohydrate_g', sugarsG:'sugars_g', fatG:'fat_g', saturatedFatG:'saturated_fat_g', fibreG:'fibre_g', sodiumMg:'sodium_mg' })[key];
}

export function cleanText(value: unknown, maximum: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

// metadata: GPT-5.6 Sol; time: 2026-09-11 13:39 Australia/Sydney; date: 2026-09-11; prompt: Convert Diet Tracker to a private signed-in Site with synced data and AI analysis of meal descriptions, meal photos, and recipe photos.
