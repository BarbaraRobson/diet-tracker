import { enrichComponent } from './afcd';
import { recipeServings, volumeMassG, volumeMl, type ReviewedRecipe } from './recipe-measures';
import type { AnalysisComponent, Nutrients } from './types';

const nutrientKeys:Array<keyof Nutrients>=['energyKj','proteinG','carbohydrateG','sugarsG','fatG','saturatedFatG','fibreG','sodiumMg'];

/** Reconcile ingredient volumes with their own density after AI estimation. */
export function correctRecipeVolumes(components:AnalysisComponent[],recipe:ReviewedRecipe,categoryIds:string[]):AnalysisComponent[] {
  const servings=recipeServings(recipe.yield)||1;
  const volumes=recipe.ingredients.flatMap(item=>{
    const ml=volumeMl(item.quantity);const mass=volumeMassG(item.quantity,item.name);
    return ml===null||mass===null?[]:[{name:item.name,ml:Number((ml/servings).toFixed(3)),grams:Number((mass/servings).toFixed(2)),isOil:/\boil\b/i.test(item.name)}];
  });
  if(!volumes.length)return components;
  const result=[...components];const used=new Set<number>();
  for(const volume of volumes){
    const keyword=volume.isOil?'oil':volume.name.toLowerCase().match(/\b(honey|flour|milk|water)\b/)?.[1]||volume.name.toLowerCase();
    let index=result.findIndex((item,i)=>!used.has(i)&&`${item.name} ${item.searchTerm}`.toLowerCase().includes(volume.name.toLowerCase()));
    if(index<0)index=result.findIndex((item,i)=>!used.has(i)&&`${item.name} ${item.searchTerm}`.toLowerCase().includes(keyword));
    if(index<0)index=result.length;
    const previous=result[index];const grams=volume.grams;
    const units=volume.isOil?Object.fromEntries(categoryIds.map(id=>[id,id==='fat'?Number((volume.ml/5).toFixed(4)):0])):previous?.units||Object.fromEntries(categoryIds.map(id=>[id,0]));
    const fallback:Nutrients=previous&&previous.grams>0?Object.fromEntries(nutrientKeys.map(key=>[key,Number(((previous[key]||0)*grams/previous.grams).toFixed(1))])) as Nutrients:{energyKj:Number((grams*(volume.isOil?37:17)).toFixed(1)),proteinG:0,carbohydrateG:0,sugarsG:0,fatG:volume.isOil?grams:0,saturatedFatG:0,fibreG:0,sodiumMg:0};
    const reason=volume.isOil?`${volume.ml} mL per serving ÷ 5 mL per healthy fats and oils unit = ${units.fat} units. Australian tablespoon = 20 mL = 4 teaspoons.`:`${volume.ml} mL per serving × ingredient-specific density = ${grams} g. ${previous?.unitReason||'Food units are estimated separately.'}`;
    const corrected=enrichComponent({name:volume.name,searchTerm:previous?.searchTerm||volume.name,grams,units,unitReason:reason,...fallback});
    result[index]=corrected;used.add(index);
  }
  return result;
}

// metadata: date: 2026-09-28; model: GPT-6; prompt: Correct reviewed recipe oil units and nutrition deterministically from Australian volume measures and recipe yield.
// metadata: date: 2026-09-28; model: GPT-6; prompt: Extend reviewed volume corrections to known ingredient-specific densities beyond oil.
