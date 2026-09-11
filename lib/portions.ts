import type { AnalysisComponent, Nutrients } from './types';
import { NUTRIENT_KEYS } from './defaults';
export type Portion = { units: Record<string,number>; nutrients: Nutrients; components: AnalysisComponent[] };
export function scalePortion(base:Portion, factor:number):Portion {
  if(!Number.isFinite(factor)||factor<=0||factor>100)throw new Error('Choose a portion greater than 0 and no more than 100.');
  const scale=(n:number)=>Number((n*factor).toFixed(6));
  const units=(values:Record<string,number>)=>Object.fromEntries(Object.entries(values).map(([key,value])=>[key,scale(value)]));
  const nutrients=(values:Nutrients)=>Object.fromEntries(NUTRIENT_KEYS.map(key=>[key,values[key]===null?null:scale(values[key]!)])) as Nutrients;
  return { units:units(base.units), nutrients:nutrients(base.nutrients), components:base.components.map(item=>({...item,...nutrients(item),grams:scale(item.grams),units:item.units?units(item.units):undefined})) };
}

// metadata: date: 2026-09-11; model: GPT (Codex; exact version unavailable); prompt: Yes, publish the fixes and implement portion multipliers and ingredient-by-ingredient unit breakdowns.
