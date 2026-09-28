export type ReviewedIngredient = { quantity:string; name:string };
export type ReviewedRecipe = { name:string; yield:string; ingredients:ReviewedIngredient[] };

export function copyReviewedRecipeFields(source:FormData,destination:FormData):void {
  if(source.get('reviewedRecipe')!=='true')return;
  destination.set('reviewedRecipe','true');
  destination.set('recipe',String(source.get('recipe')||''));
}

const fractions:Record<string,string>={'½':' 1/2','¼':' 1/4','¾':' 3/4','⅓':' 1/3','⅔':' 2/3','⅛':' 1/8'};
const numberPattern='(\\d+(?:[.,]\\d+)?(?:\\s+\\d+\\/\\d+)?|\\d+\\/\\d+)';
const volumePattern=new RegExp(`^\\s*${numberPattern}\\s*(tablespoons?|tbsp\\.?|teaspoons?|tsp\\.?|cups?|millilit(?:res|ers)|ml|litres?|liters?|l)\\b`,'i');

function amount(value:string):number {
  return value.trim().split(/\s+/).reduce((sum,part)=>{
    if(part.includes('/')){const [numerator,denominator]=part.split('/').map(Number);return sum+numerator/denominator;}
    return sum+Number(part.replace(',','.'));
  },0);
}

export function volumeMl(quantity:string):number|null {
  const expanded=quantity.replace(/[½¼¾⅓⅔⅛]/g,char=>fractions[char]);
  const match=expanded.match(volumePattern);if(!match)return null;
  const count=amount(match[1]);if(!Number.isFinite(count)||count<0)return null;
  const unit=match[2].toLowerCase().replace(/\.$/,'');
  const explicit=quantity.match(/\b(\d+(?:[.,]\d+)?)\s*ml\s*(?:per|\/|for|=)\s*(?:1\s*)?(?:tablespoon|tbsp)\b/i)
    ||quantity.match(/(?:tablespoon|tbsp)\s*(?:=|is)\s*(\d+(?:[.,]\d+)?)\s*ml\b/i)
    ||quantity.match(/(?:tablespoon|tbsp)\s*\(\s*(\d+(?:[.,]\d+)?)\s*ml\s*\)/i);
  const tablespoonMl=explicit?Number(explicit[1].replace(',','.')):/\bUS\b/i.test(quantity)?15:20;
  const factor=unit.startsWith('table')||unit.startsWith('tbsp')?tablespoonMl:unit.startsWith('tea')||unit.startsWith('tsp')?5:unit.startsWith('cup')?250:unit==='l'||unit.startsWith('lit')?1000:1;
  return Number((count*factor).toFixed(3));
}

export function densityGPerMl(name:string):number|null {
  const food=name.toLowerCase();
  // FSANZ Nutrition Panel Calculator specific gravities for liquids. Dry flour is
  // an approximate bulk density from the USDA 120 g/cup measure, not 1 g/mL.
  if(/\boil\b/.test(food))return /\b(olive|peanut)\b/.test(food)?.91:.92;
  if(/\bhoney\b/.test(food))return 1.43;
  if(/\b(?:milk|soy beverage|soy drink)\b/.test(food))return /\bskim|reduced.fat\b/.test(food)?1.04:1.03;
  if(/\bwater\b/.test(food))return 1;
  if(/\b(?:plain|all.purpose|whole.wheat|wheat) flour\b|^flour\b/.test(food))return .5;
  return null;
}

export function volumeMassG(quantity:string,name:string):number|null {
  const ml=volumeMl(quantity);if(ml===null)return null;
  const statedMass=quantity.match(/\(\s*(\d+(?:[.,]\d+)?)\s*g(?:rams?)?\s*\)/i);
  if(statedMass)return Number(statedMass[1].replace(',','.'));
  const density=densityGPerMl(name);
  return density===null?null:Number((ml*density).toFixed(2));
}

export function normalisedQuantity(quantity:string,name:string):string {
  const ml=volumeMl(quantity);if(ml===null)return quantity;
  const mass=volumeMassG(quantity,name);
  return `${quantity} [equivalent to ${ml} mL${/(?:tablespoons?|tbsp)\b/i.test(quantity)?` or ${Number((ml/5).toFixed(3))} Australian teaspoons`:''}; ${mass===null?'estimate grams using this ingredient’s own density, not water density':`approximately ${mass} g of ${name} by ingredient-specific density`}; these are equivalent measures, not extra ingredients]`;
}

export function recipeServings(yieldText:string):number|null {
  if(/\b\d+\s*(?:-|–|to)\s*\d+\b/i.test(yieldText))return null;
  const match=yieldText.match(/\bserves?\s+(\d+(?:\.\d+)?)\b/i)||yieldText.match(/\b(\d+(?:\.\d+)?)\s*(?:servings?|portions?)\b/i)||yieldText.match(/\bmakes\s+(\d+(?:\.\d+)?)\s*(?:servings?|portions?)?\b/i);
  if(!match)return null;const value=Number(match[1]);return value>0&&value<=100?value:null;
}

export function oilPerServing(recipe:ReviewedRecipe):Array<{name:string;ml:number;units:number}> {
  const servings=recipeServings(recipe.yield)||1;
  return recipe.ingredients.filter(item=>/\boil\b/i.test(item.name)).flatMap(item=>{
    const ml=volumeMl(item.quantity);return ml===null?[]:[{name:item.name,ml:Number((ml/servings).toFixed(3)),units:Number((ml/5/servings).toFixed(4))}];
  });
}

export function reviewedRecipeText(recipe:ReviewedRecipe):string {
  return `Recipe: ${recipe.name}. Yield: ${recipe.yield||'not stated; assume one serving'}. Ingredients for the whole recipe:\n${recipe.ingredients.map(item=>`${normalisedQuantity(item.quantity,item.name)} ${item.name}`).join('\n')}`;
}

// metadata: date: 2026-09-28; model: GPT-6; prompt: Fix recipe saving and use deterministic Australian spoon measures, including 1 tablespoon = 20 mL = 4 teaspoons and 1 teaspoon of oil per Healthy Fats & Oils unit.
// metadata: date: 2026-09-28; model: GPT-6; prompt: Consider ingredient-specific density for every volumetric recipe ingredient, using measured or estimated grams and flagging unknown densities.
