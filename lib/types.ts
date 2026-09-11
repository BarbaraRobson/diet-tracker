export type Nutrients = { energyKj: number | null; proteinG: number | null; carbohydrateG: number | null; sugarsG: number | null; fatG: number | null; saturatedFatG: number | null; fibreG: number | null; sodiumMg: number | null };
export type Category = { id: string; name: string; target: number; guide: string; sortOrder: number; locked: boolean };
export type Meal = Nutrients & { id: string; date: string; time: string; name: string; description: string; source: string; templateId: string | null; confidence: string | null; assumptions: string[]; units: Record<string, number> };
export type MealTemplate = Nutrients & { id: string; name: string; description: string; source: string; confidence: string | null; assumptions: string[]; components: AnalysisComponent[]; units: Record<string, number> };
export type AnalysisComponent = Nutrients & { name: string; searchTerm: string; grams: number; matchedFoodKey: string | null; matchedFoodName: string | null; matchScore: number | null; nutritionSource: 'AFCD' | 'AI estimate' };
export type TrackerState = { selectedDate: string; categories: Category[]; meals: Meal[]; templates: MealTemplate[]; dailyNutrition: Nutrients; weeklyNutrition: Nutrients; weeklyDaysRecorded: number; weeklyStart: string; weeklyEnd: string; weeklyUnits: Record<string, number>; user: { displayName: string } };

// metadata: GPT-5.6 Sol; time: 2026-09-11 13:39 Australia/Sydney; date: 2026-09-11; prompt: Convert Diet Tracker to a private signed-in Site with synced data and AI analysis of meal descriptions, meal photos, and recipe photos.
