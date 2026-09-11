export const DEFAULT_CATEGORIES = [
  { id: 'protein', name: 'Meat & Protein', target: 2.5, guide: '100g raw lean meat, chicken, fish, tempeh or firm tofu; 185g drained canned tuna; 3/4 cup kidney beans; 1 cup edamame or lentils; 2 eggs.', locked: true },
  { id: 'grain', name: 'Bread & Cereals', target: 3, guide: '1 slice bread; 1/2 bread roll; 1 mini wrap; 4 crispbread crackers; 2 wheat biscuits; 3/4 cup sweet potato; 1 medium potato; 1/2 cup cooked pasta, quinoa, brown rice or pearl barley.', locked: true },
  { id: 'veg', name: 'Vegetables', target: 2.5, guide: '150g mixed salad greens; 1 cup coleslaw mix; 2 cups cauliflower rice, broccoli, zucchini noodles or mushrooms; 3/4 cup pumpkin; 1 cup canned tomatoes or mixed vegetables.', locked: true },
  { id: 'fruit', name: 'Fruit', target: 2, guide: '1 medium apple, banana or orange; 1 cup watermelon; 2 kiwi fruits; 1 cup berries; 3/4 cup canned peaches; 1 cup frozen fruit; 2 tablespoons dried fruit.', locked: true },
  { id: 'dairy', name: 'Dairy', target: 3, guide: '50g reduced-fat cheddar; 1/2 cup ricotta; 3/4 cup cottage cheese; 1 cup soy or low-fat milk; 2/3 cup low-fat yoghurt; 1 large low-fat latte.', locked: true },
  { id: 'fat', name: 'Healthy Fats & Oils', target: 3, guide: '1 teaspoon olive oil; 2 teaspoons margarine; 1 heaped teaspoon peanut butter; 1 tablespoon avocado; 6 almonds; 5 walnuts; 1 tablespoon chia seeds.', locked: true },
  { id: 'indulgence', name: 'Indulgences', target: 0, guide: '4 squares chocolate; 30g lollies; 1 small cookie; 20g chips; 150ml wine; 275ml beer; 30ml spirits.', locked: true },
] as const;

export const NUTRIENT_KEYS = ['energyKj', 'proteinG', 'carbohydrateG', 'sugarsG', 'fatG', 'saturatedFatG', 'fibreG', 'sodiumMg'] as const;
export type NutrientKey = typeof NUTRIENT_KEYS[number];

// metadata: GPT-5.6 Sol; time: 2026-09-11 13:39 Australia/Sydney; date: 2026-09-11; prompt: Convert Diet Tracker to a private signed-in Site with synced data and AI analysis of meal descriptions, meal photos, and recipe photos.
