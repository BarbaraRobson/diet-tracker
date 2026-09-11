export const CSIRO_UNIT_RULES = [
  'Use CSIRO Total Wellbeing Diet food-group units and the supplied portion guide, not macronutrient exchanges. Scale portions proportionally and keep decimal units. Daily targets must never change a meal estimate.',
  'Meat & Protein units count meat, poultry, fish, eggs, tofu, tempeh and legumes only. Protein grams from milk, cereals, nuts and vegetables still contribute to nutrition, but do not create Meat & Protein units.',
  'Legumes count towards BOTH Meat & Protein and Vegetables. Calculate the two contributions separately; do not force one category per ingredient. If the vegetable conversion is unavailable, state the assumed portion and ask for clarification rather than silently omitting it.',
  'Soy milk counts as Dairy, not Meat & Protein. Calculate dairy units from calcium: consumed calcium in mg divided by 300 mg (the working reference for 250 mL dairy milk). Use the product calcium label when supplied. Otherwise assume 120 mg/100 mL for calcium-fortified soy milk and state that assumption; do not assume all plant milks have equal calcium.',
  'Potato and sweet potato count as Bread & Cereals using the guide portions. Low- and moderate-carbohydrate vegetables count as Vegetables and do not generate cereal units from their carbohydrate grams.',
  'Use the guide food category even when its nutrients overlap another category: nuts and oils count as Healthy Fats & Oils; listed indulgences count as Indulgences. Count separate ingredients in mixed meals separately.',
  'The legacy guide mentions free foods. This does not erase vegetable units for listed portions or make oils, dressings and energy-containing additions free. Record their nutrition and applicable units.',
  'Use Australian measures: 1 cup = 250 mL, 1 teaspoon = 5 mL, 1 tablespoon = 20 mL. Respect raw versus cooked and drained weights. Explain uncertain conversions and show the main unit calculations in assumptions.',
] as const;

// metadata: date: 2026-09-11; model: GPT (Codex; exact model version unavailable); prompt: Restore the detailed supplied CSIRO unit guide, align AI food-group counting, allow decimal units, and suggest UX improvements.
