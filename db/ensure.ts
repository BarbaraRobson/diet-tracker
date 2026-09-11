import { getD1 } from './index';
import { DEFAULT_CATEGORIES } from '@/lib/defaults';

let schemaReady: Promise<void> | null = null;

export async function ensureSchema() {
  if (!schemaReady) schemaReady = createSchema().catch((error) => { schemaReady = null; throw error; });
  await schemaReady;
}

async function createSchema() {
  const db = getD1();
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS categories (user_id TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, target REAL NOT NULL, guide TEXT NOT NULL DEFAULT \'\', sort_order INTEGER NOT NULL, locked INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id,id))'),
    db.prepare('CREATE TABLE IF NOT EXISTS meals (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, meal_date TEXT NOT NULL, meal_time TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT \'\', source TEXT NOT NULL, template_id TEXT, energy_kj REAL, protein_g REAL, carbohydrate_g REAL, sugars_g REAL, fat_g REAL, saturated_fat_g REAL, fibre_g REAL, sodium_mg REAL, confidence TEXT, assumptions TEXT NOT NULL DEFAULT \'[]\', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_meals_user_date ON meals(user_id,meal_date)'),
    db.prepare('CREATE TABLE IF NOT EXISTS meal_units (meal_id TEXT NOT NULL, category_id TEXT NOT NULL, units REAL NOT NULL, PRIMARY KEY(meal_id,category_id), FOREIGN KEY(meal_id) REFERENCES meals(id) ON DELETE CASCADE)'),
    db.prepare('CREATE TABLE IF NOT EXISTS meal_templates (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT \'\', source TEXT NOT NULL, energy_kj REAL, protein_g REAL, carbohydrate_g REAL, sugars_g REAL, fat_g REAL, saturated_fat_g REAL, fibre_g REAL, sodium_mg REAL, confidence TEXT, assumptions TEXT NOT NULL DEFAULT \'[]\', components TEXT NOT NULL DEFAULT \'[]\', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_used_at TEXT NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_templates_user_used ON meal_templates(user_id,last_used_at)'),
    db.prepare('CREATE TABLE IF NOT EXISTS template_units (template_id TEXT NOT NULL, category_id TEXT NOT NULL, units REAL NOT NULL, PRIMARY KEY(template_id,category_id), FOREIGN KEY(template_id) REFERENCES meal_templates(id) ON DELETE CASCADE)'),
    db.prepare('CREATE TABLE IF NOT EXISTS ai_analyses (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, model TEXT NOT NULL, input_kind TEXT NOT NULL, status TEXT NOT NULL, confidence TEXT, input_tokens INTEGER, output_tokens INTEGER, created_at TEXT NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_ai_user_created ON ai_analyses(user_id,created_at)'),
  ]);
}

export async function ensureUserDefaults(userId: string) {
  await ensureSchema();
  const db = getD1();
  await db.batch(DEFAULT_CATEGORIES.map((category, index) => db.prepare('INSERT OR IGNORE INTO categories (user_id,id,name,target,guide,sort_order,locked) VALUES (?,?,?,?,?,?,?)')
    .bind(userId, category.id, category.name, category.target, category.guide, index, category.locked ? 1 : 0)));
}

// metadata: GPT-5.6 Sol; time: 2026-09-11 13:39 Australia/Sydney; date: 2026-09-11; prompt: Convert Diet Tracker to a private signed-in Site with synced data and AI analysis of meal descriptions, meal photos, and recipe photos.
