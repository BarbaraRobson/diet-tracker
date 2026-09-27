import type { Nutrients } from './types';

export type GuidanceStatus = 'good' | 'near' | 'outside' | 'unrated';
export type Guidance = { status: GuidanceStatus; description: string };
export type NutritionGuidance = Partial<Record<keyof Nutrients, Guidance>>;

const unrated = (description:string):Guidance => ({status:'unrated',description});
const result = (good:boolean,near:boolean,description:string):Guidance => ({status:good?'good':near?'near':'outside',description});
const between = (value:number,min:number,max:number) => value>=min&&value<=max;

/** Fixed, indicative comparisons for a complete seven-day food log; no AI scoring. */
export function weeklyNutritionGuidance(nutrition:Nutrients,recordedDays:number):NutritionGuidance {
  const keys:Array<keyof Nutrients>=['proteinG','carbohydrateG','sugarsG','fatG','saturatedFatG','fibreG','sodiumMg'];
  if(recordedDays!==7)return Object.fromEntries(keys.map(key=>[key,unrated('A complete seven days of logged meals is needed for this comparison.')])) as NutritionGuidance;
  const available=(key:keyof Nutrients)=>nutrition[key]!==null&&Number.isFinite(nutrition[key])&&nutrition[key]!>=0;
  const guidance: NutritionGuidance={sugarsG:unrated('Total sugars include naturally occurring sugars; the free-sugars guideline cannot be assessed from this figure.')};
  if(available('proteinG')) {
    const daily=nutrition.proteinG!/7;
    guidance.proteinG=result(daily>=84,daily>=70,`${Math.round(daily)} g/day average. Indicative minimum: 84 g/day (1.2 g/kg for an active 70 kg adult). Higher intake is not scored as a failure.`);
  }
  if(available('fibreG')) {
    const daily=nutrition.fibreG!/7;
    guidance.fibreG=result(daily>=28,daily>=25,`${daily.toFixed(1)} g/day average. Women's adequate intake: 25 g/day; suggested dietary target: 28 g/day.`);
  }
  if(available('sodiumMg')) {
    const daily=nutrition.sodiumMg!/7;
    guidance.sodiumMg=result(daily<=2000,daily<=2300,`${Math.round(daily)} mg/day average. Suggested dietary target: no more than 2,000 mg/day; amber extends to 2,300 mg/day.`);
  }
  if(available('energyKj')&&nutrition.energyKj!>0&&available('saturatedFatG')) {
    const share=100*nutrition.saturatedFatG!*37/nutrition.energyKj!;
    guidance.saturatedFatG=result(share<10,share<12,`${share.toFixed(1)}% of logged energy from saturated fat. Aim below 10%; amber from 10% to under 12%.`);
  }
  if(available('proteinG')&&available('carbohydrateG')&&available('fatG')) {
    const macroEnergy=17*(nutrition.proteinG!+nutrition.carbohydrateG!)+37*nutrition.fatG!;
    if(macroEnergy>0) {
      const carb=100*17*nutrition.carbohydrateG!/macroEnergy;
      const fat=100*37*nutrition.fatG!/macroEnergy;
      guidance.carbohydrateG=result(between(carb,45,65),between(carb,40,70),`${carb.toFixed(1)}% of protein + carbohydrate + fat energy. Australian reference range: 45–65%; amber within 5 percentage points.`);
      guidance.fatG=result(between(fat,20,35),between(fat,15,40),`${fat.toFixed(1)}% of protein + carbohydrate + fat energy. Australian reference range: 20–35%; amber within 5 percentage points.`);
    }
  }
  for(const key of keys)guidance[key]??=unrated('Not enough nutrition data to assess this figure.');
  return guidance;
}

// metadata: date: 2026-09-27; model: GPT-6; prompt: Add fixed, source-grounded green/amber/red seven-day nutrition indicators for an active 70 kg woman in her 50s without AI calls.
