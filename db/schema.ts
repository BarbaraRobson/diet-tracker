import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const categories = sqliteTable('categories', {
  userId: text('user_id').notNull(), id: text('id').notNull(), name: text('name').notNull(),
  target: real('target').notNull(), guide: text('guide').notNull().default(''), sortOrder: integer('sort_order').notNull(),
  locked: integer('locked', { mode: 'boolean' }).notNull().default(false),
}, (table) => [primaryKey({ columns: [table.userId, table.id] })]);

export const meals = sqliteTable('meals', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(), mealDate: text('meal_date').notNull(),
  mealTime: text('meal_time').notNull(), name: text('name').notNull(), description: text('description').notNull().default(''),
  source: text('source').notNull(), templateId: text('template_id'), energyKj: real('energy_kj'),
  proteinG: real('protein_g'), carbohydrateG: real('carbohydrate_g'), sugarsG: real('sugars_g'),
  fatG: real('fat_g'), saturatedFatG: real('saturated_fat_g'), fibreG: real('fibre_g'), sodiumMg: real('sodium_mg'),
  confidence: text('confidence'), assumptions: text('assumptions').notNull().default('[]'),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, (table) => [index('idx_meals_user_date').on(table.userId, table.mealDate)]);

export const mealUnits = sqliteTable('meal_units', {
  mealId: text('meal_id').notNull(), categoryId: text('category_id').notNull(), units: real('units').notNull(),
}, (table) => [primaryKey({ columns: [table.mealId, table.categoryId] })]);

export const mealTemplates = sqliteTable('meal_templates', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(), name: text('name').notNull(),
  description: text('description').notNull().default(''), source: text('source').notNull(), energyKj: real('energy_kj'),
  proteinG: real('protein_g'), carbohydrateG: real('carbohydrate_g'), sugarsG: real('sugars_g'), fatG: real('fat_g'),
  saturatedFatG: real('saturated_fat_g'), fibreG: real('fibre_g'), sodiumMg: real('sodium_mg'),
  confidence: text('confidence'), assumptions: text('assumptions').notNull().default('[]'), components: text('components').notNull().default('[]'),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(), lastUsedAt: text('last_used_at').notNull(),
}, (table) => [index('idx_templates_user_used').on(table.userId, table.lastUsedAt)]);

export const templateUnits = sqliteTable('template_units', {
  templateId: text('template_id').notNull(), categoryId: text('category_id').notNull(), units: real('units').notNull(),
}, (table) => [primaryKey({ columns: [table.templateId, table.categoryId] })]);

export const aiAnalyses = sqliteTable('ai_analyses', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(), model: text('model').notNull(), inputKind: text('input_kind').notNull(),
  status: text('status').notNull(), confidence: text('confidence'), inputTokens: integer('input_tokens'), outputTokens: integer('output_tokens'),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_ai_user_created').on(table.userId, table.createdAt)]);

// metadata: GPT-5.6 Sol; time: 2026-09-11 13:39 Australia/Sydney; date: 2026-09-11; prompt: Convert Diet Tracker to a private signed-in Site with synced data and AI analysis of meal descriptions, meal photos, and recipe photos.
