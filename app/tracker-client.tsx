'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AnalysisComponent, Category, Meal, MealTemplate, Nutrients, TrackerState } from '@/lib/types';
import { CSIRO_UNIT_RULES } from '@/lib/unit-rules';
import { scalePortion, type Portion } from '@/lib/portions';
import { weeklyNutritionGuidance, type NutritionGuidance } from '@/lib/nutrition-guidance';
import recipeBook from '@/data/recipe-book-reference.json';

type View = 'today'|'week'|'guide'|'transfer'|'settings';
type Draft = { id?:string; templateId?:string|null; name:string; date:string; time:string; description:string; source:string; units:Record<string,number>; nutrients:Nutrients; assumptions:string[]; components:AnalysisComponent[]; confidence:string|null; saveTemplate:boolean; saveRecipe:boolean; recipePhotoAnalysed:boolean; analysisId:string|null };
type ApiError = { error?:string };
type AnalysisPayload = ApiError & { analysisId:string; name:string; description?:string; units:Record<string,number>; nutrition:Nutrients; assumptions?:string[]; components?:AnalysisComponent[]; confidence:string|null; clarifyingQuestions?:string[] };
type RecipeReview = {name:string;yield:string;ingredients:Array<{id:string;quantity:string;name:string}>;saveRecipe:boolean};
type RecipeRecord = { id:string; name:string; category:'breakfast'|'lunch'|'dinner'; page:number; servingLabel:string; units:Record<string,number>; nutrients:Nutrients };
const recipes = recipeBook.recipes as RecipeRecord[];
const nutrientFields:Array<[keyof Nutrients,string,string]> = [['energyKj','Energy','kJ'],['proteinG','Protein','g'],['carbohydrateG','Carbohydrate','g'],['sugarsG','Sugars','g'],['fatG','Fat','g'],['saturatedFatG','Saturated fat','g'],['fibreG','Fibre','g'],['sodiumMg','Sodium','mg']];
const emptyNutrition: Nutrients = {energyKj:null,proteinG:null,carbohydrateG:null,sugarsG:null,fatG:null,saturatedFatG:null,fibreG:null,sodiumMg:null};

export default function TrackerClient({initialUserName}:{initialUserName:string}) {
  const [selectedDate,setSelectedDate]=useState(todayKey()); const [view,setView]=useState<View>('today');
  const [state,setState]=useState<TrackerState|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const [editorOpen,setEditorOpen]=useState(false); const [mode,setMode]=useState<'manual'|'ai'|'recipe'|'saved'>('ai'); const [draft,setDraft]=useState<Draft>(()=>newDraft(todayKey()));
  const [selection,setSelection]=useState(0); const [scaled,setScaled]=useState(0);
  const [analysing,setAnalysing]=useState(false); const [saving,setSaving]=useState(false); const [notice,setNotice]=useState('');
  const [recipeReview,setRecipeReview]=useState<RecipeReview|null>(null);

  async function load(date=selectedDate) { setLoading(true); setError(''); try { const response=await fetch(`/api/state?date=${date}&today=${todayKey()}`,{cache:'no-store'}); const payload=await response.json() as TrackerState&ApiError; if(!response.ok)throw new Error(payload.error||'Could not load the tracker.'); setState(payload); } catch(e){setError(message(e));} finally{setLoading(false);} }
  useEffect(()=>{
    let cancelled=false;
    fetch(`/api/state?date=${selectedDate}&today=${todayKey()}`,{cache:'no-store'})
      .then(async(response)=>{const payload=await response.json() as TrackerState&ApiError;if(!response.ok)throw new Error(payload.error||'Could not load the tracker.');return payload;})
      .then((payload)=>{if(!cancelled){setState(payload);setLoading(false);}})
      .catch((cause)=>{if(!cancelled){setError(message(cause));setLoading(false);}});
    return()=>{cancelled=true;};
  },[selectedDate]);
  useEffect(()=>{
    let previousToday=todayKey();
    function checkDay(){const nextToday=todayKey();if(nextToday!==previousToday){setSelectedDate(current=>current===previousToday?nextToday:current);previousToday=nextToday;}}
    const timer=setInterval(checkDay,60000);
    document.addEventListener('visibilitychange',checkDay);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',checkDay);};
  },[]);
  const dailyUnits=useMemo(()=>sumUnits(state?.meals||[]),[state?.meals]);

  function openNew() { setSelection((value)=>value+1); setDraft(newDraft(selectedDate)); setRecipeReview(null); setMode('ai'); setNotice(''); setEditorOpen(true); }
  function openRecipes() { setSelection((value)=>value+1); setDraft(newDraft(selectedDate)); setMode('recipe'); setNotice(''); setEditorOpen(true); }
  function openSaved() { setSelection((value)=>value+1); setDraft(newDraft(selectedDate)); setMode('saved'); setNotice(''); setEditorOpen(true); }
  function openEdit(meal:Meal) { setSelection((value)=>value+1); setDraft({id:meal.id,templateId:meal.templateId,name:meal.name,date:meal.date,time:meal.time,description:meal.description,source:meal.source,units:{...meal.units},nutrients:pickNutrition(meal),assumptions:[...meal.assumptions],components:meal.components||[],confidence:meal.confidence,saveTemplate:false,saveRecipe:false,recipePhotoAnalysed:false,analysisId:null}); setMode('manual'); setNotice(''); setEditorOpen(true); }
  function applyTemplate(template:MealTemplate) { setSelection((value)=>value+1); setDraft({templateId:template.id,name:template.name,date:selectedDate,time:currentTime(),description:template.description,source:'template',units:{...template.units},nutrients:pickNutrition(template),assumptions:[...template.assumptions],components:template.components,confidence:template.confidence,saveTemplate:false,saveRecipe:false,recipePhotoAnalysed:false,analysisId:null}); setMode('manual'); setNotice('Using saved values. No AI analysis is needed.'); setEditorOpen(true); }
  function applyRecipe(recipe:RecipeRecord) { setSelection((value)=>value+1); setDraft({name:recipe.name,date:selectedDate,time:currentTime(),description:`Barbara's Recipe Book, page ${recipe.page} · ${recipe.servingLabel}.`,source:'recipe',units:{...recipe.units},nutrients:{...recipe.nutrients},assumptions:[],components:[],confidence:null,saveTemplate:false,saveRecipe:false,recipePhotoAnalysed:false,analysisId:null}); setMode('manual'); setNotice('Recipe-book values loaded for one serving. No AI analysis is needed.'); }
  function applyPersonalRecipe(recipe:MealTemplate) { setSelection(value=>value+1); setDraft({templateId:recipe.id,name:recipe.name,date:selectedDate,time:currentTime(),description:recipe.description,source:'recipe',units:{...recipe.units},nutrients:pickNutrition(recipe),assumptions:[...recipe.assumptions],components:recipe.components,confidence:recipe.confidence,saveTemplate:false,saveRecipe:false,recipePhotoAnalysed:false,analysisId:null}); setMode('manual'); setNotice('Your recipe values are loaded. Adjust the portion or nutrition before saving.'); }

  async function analyse(form:FormData,preserveDescription=false) {
    setAnalysing(true); setError(''); setNotice('Preparing photos and analysing the meal…');
    try {
      const outgoing=new FormData(); outgoing.set('description',String(form.get('description')||''));
      for(const key of ['mealPhotos','recipePhotos']) for(const item of form.getAll(key)) if(item instanceof File&&item.size) outgoing.append(key,await privacySafeImage(item),`${key}-${crypto.randomUUID()}.jpg`);
      const response=await fetch('/api/analyze',{method:'POST',body:outgoing}); const payload=await response.json() as AnalysisPayload; if(!response.ok)throw new Error(payload.error||'Analysis failed.');
      setSelection((value)=>value+1);
      const chosenName=String(form.get('name')||'').trim(); const submittedDescription=String(form.get('description')||'');
      const recipePhotoAnalysed=form.getAll('recipePhotos').some(item=>item instanceof File&&item.size>0);
      const saveRecipe=(recipePhotoAnalysed||form.get('reviewedRecipe')==='true')&&form.get('saveRecipe')==='on';
      setDraft((current)=>({...current,name:chosenName||payload.name,description:preserveDescription?submittedDescription:(payload.description||submittedDescription),source:'ai',units:payload.units,nutrients:payload.nutrition,assumptions:payload.assumptions||[],components:payload.components||[],confidence:payload.confidence,saveTemplate:preserveDescription?current.saveTemplate:!saveRecipe,saveRecipe:preserveDescription?current.saveRecipe:saveRecipe,recipePhotoAnalysed:preserveDescription?current.recipePhotoAnalysed:(recipePhotoAnalysed||form.get('reviewedRecipe')==='true'),analysisId:preserveDescription?current.analysisId:payload.analysisId}));
      const questions=(payload.clarifyingQuestions||[]) as string[]; setNotice(questions.length?`Please review carefully: ${questions.join(' ')}`:'Analysis complete. Review and adjust every value before saving.'); setMode('manual');
      return true;
    } catch(e){setError(message(e));setNotice('');return false;} finally{setAnalysing(false);}
  }

  async function extractRecipe(form:FormData){
    setAnalysing(true);setError('');setNotice('Reading recipe ingredients…');
    try{
      const outgoing=new FormData(); const url=String(form.get('recipeUrl')||'').trim();
      if(url)outgoing.set('url',url);
      else for(const item of form.getAll('recipePhotos'))if(item instanceof File&&item.size)outgoing.append('recipePhotos',await privacySafeImage(item),'recipe.jpg');
      const response=await fetch('/api/recipes/extract',{method:'POST',body:outgoing});
      const payload=await response.json() as ApiError&{name:string;yield:string;ingredients:Array<{quantity:string;name:string}>};
      if(!response.ok)throw new Error(payload.error||'Could not read the recipe.');
      setRecipeReview({name:String(form.get('name')||'').trim()||payload.name,yield:payload.yield,ingredients:payload.ingredients.map(item=>({...item,id:crypto.randomUUID()})),saveRecipe:form.get('saveRecipe')==='on'});
      setNotice('Check quantities and ingredients, then tap Done to calculate one serving.');
    }catch(cause){setError(message(cause));setNotice('');}finally{setAnalysing(false);}
  }

  async function finishRecipeReview(review=recipeReview){
    if(!review)return;
    const ingredients=review.ingredients.filter(item=>item.name.trim());
    if(!ingredients.length){setError('Add at least one ingredient.');return;}
    if(ingredients.some(item=>!item.quantity.trim())){setError('Add a quantity for every ingredient.');return;}
    const form=new FormData();form.set('name',review.name);form.set('reviewedRecipe','true');if(review.saveRecipe)form.set('saveRecipe','on');
    form.set('description',`Recipe: ${review.name}. Yield: ${review.yield||'not stated; estimate one serving'}; ingredients for the full recipe:\n${ingredients.map(item=>`${item.quantity.trim()} ${item.name.trim()}`).join('\n')}`);
    if(await analyse(form))setRecipeReview(null);
  }

  async function saveMeal(event:React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try { const response=await fetch('/api/meals',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...draft,nutrients:draft.nutrients})}); const payload=await response.json() as ApiError&{recipeId?:string|null}; if(!response.ok)throw new Error(payload.error||'Could not save the meal.'); setEditorOpen(false); setNotice(payload.recipeId?'Meal saved and recipe added to your recipe book.':'Meal saved and synced.'); await load(draft.date); if(draft.date!==selectedDate)setSelectedDate(draft.date); } catch(e){setError(message(e));} finally{setSaving(false);}
  }

  async function addSelectedTemplates(templateIds:string[]) {
    setSaving(true); setError('');
    try {
      const response=await fetch('/api/meals/from-templates',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({date:selectedDate,time:currentTime(),templateIds})});
      const payload=await response.json() as ApiError;
      if(!response.ok)throw new Error(payload.error||'Could not add the saved meals.');
      setEditorOpen(false); setNotice(`${templateIds.length} saved meal${templateIds.length===1?'':'s'} added.`); await load(selectedDate);
    } catch(e){setError(message(e));throw e;} finally{setSaving(false);}
  }

  function recalculateDescription(){const form=new FormData();form.set('name',draft.name);form.set('description',draft.description);void analyse(form,true);}

  async function deleteMeal(id:string) { if(!confirm(id===state?.autoBreakfastMealId?'Remove breakfast from this day? It will not be added again today.':'Remove this meal?'))return; const response=await fetch(`/api/meals/${encodeURIComponent(id)}`,{method:'DELETE'}); if(response.ok){setEditorOpen(false);setNotice('Meal removed.');await load();}else setError('Could not remove the meal.'); }
  async function doubleMeal(meal:Meal){
    if(saving)return;setSaving(true);setError('');
    try{const portion=scalePortion({units:meal.units,nutrients:pickNutrition(meal),components:meal.components||[]},2);const response=await fetch('/api/meals',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:meal.id,templateId:meal.templateId,name:meal.name,date:meal.date,time:meal.time,description:meal.description,source:meal.source,...portion,assumptions:[...meal.assumptions.filter(item=>!item.startsWith('Portion doubled')),`Portion doubled from the logged entry.`],confidence:meal.confidence})});const payload=await response.json() as ApiError;if(!response.ok)throw new Error(payload.error||'Could not double the meal.');setNotice(`${meal.name} doubled.`);await load();}catch(cause){setError(message(cause));}finally{setSaving(false);}
  }
  function changeDay(offset:number){const date=new Date(`${selectedDate}T12:00:00`);date.setDate(date.getDate()+offset);setSelectedDate(localKey(date));}

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark" aria-hidden="true">◒</span><div><p className="eyebrow">Your food journal</p><h1>Diet Tracker</h1></div></div><a className="account" href="/signout-with-chatgpt?return_to=%2F"><span className="account-name">{state?.user.displayName||initialUserName}</span><span>Sign out</span></a></header>
    {error&&<div className="alert error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Dismiss">×</button></div>}
    {notice&&<div className="alert" role="status">{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss">×</button></div>}
    {view==='today'&&<>
      <section className="day-toolbar"><div className="date-row" aria-label="Selected date"><button onClick={()=>changeDay(-1)} aria-label="Previous day">‹</button><input type="date" value={selectedDate} onChange={(e)=>setSelectedDate(e.target.value)} aria-label="Choose date"/><button onClick={()=>changeDay(1)} aria-label="Next day">›</button></div><button className="primary add-action" onClick={openNew}><span aria-hidden="true">+</span> Add meal</button></section>
      <div className="today-layout"><div className="daily-summary"><NutritionHero nutrition={state?.dailyNutrition||emptyNutrition} label={selectedDate===todayKey()?'Today’s energy':`${prettyDate(selectedDate)} energy`} subtitle={state?.meals.length?`${state.meals.length} meal${state.meals.length===1?'':'s'} recorded`:'No meals recorded yet'}/>
      <section className="progress-section" aria-label="Food group progress"><div className="section-heading"><h2>Food groups</h2><span className="section-note">Units / daily target</span></div><div className="progress-list">{(state?.categories||[]).map((category)=><ProgressCard key={category.id} category={category} value={dailyUnits[category.id]||0}/>)}</div></section>
      <details className="nutrition-details"><summary>Nutrition details</summary><NutritionStrip nutrition={state?.dailyNutrition||emptyNutrition}/></details></div>
      <section className="meal-panel"><div className="section-heading"><h2>Meals</h2><div className="meal-actions"><button className="secondary" onClick={openRecipes}>Recipe book</button><button className="secondary" onClick={openSaved}>Saved meals</button></div></div>
        {loading?<p className="empty">Loading your synced meals…</p>:state?.meals.length?<div className="meal-list">{state.meals.map((meal)=><SwipeMeal key={meal.id} meal={meal} disabled={saving} onEdit={()=>openEdit(meal)} onRemove={()=>deleteMeal(meal.id)} onDouble={()=>doubleMeal(meal)} categories={state.categories} auto={meal.id===state.autoBreakfastMealId}/>)}</div>:<p className="empty">Describe a meal, photograph your plate, photograph a recipe, or enter units manually.</p>}
      </section></div>
    </>}
    {view==='week'&&<WeekView state={state}/>} {view==='guide'&&<GuideView categories={state?.categories||[]}/>} {view==='transfer'&&<TransferView/>} {view==='settings'&&<SettingsView categories={state?.categories||[]} onSaved={()=>load()}/>}
    <nav className="bottom-nav" aria-label="Main menu">{([['today','Today'],['week','7 day totals'],['guide','Unit guide'],['transfer','Import/export'],['settings','Settings']] as Array<[View,string]>).map(([key,label])=><button onClick={()=>setView(key)} className={view===key?'active':''} key={key}>{label}</button>)}</nav>
    {editorOpen&&<div className="modal-backdrop"><section className="editor" role="dialog" aria-modal="true" aria-labelledby="editor-title"><div className="editor-heading"><div><p className="eyebrow">{draft.id?'Edit entry':'New entry'}</p><h2 id="editor-title">{draft.id?'Edit meal':'Add a meal'}</h2></div><button className="back" onClick={()=>setEditorOpen(false)} aria-label="Close">×</button></div>
      {!draft.id&&<div className="mode-tabs"><button className={mode==='ai'?'active':''} onClick={()=>setMode('ai')}>Describe or photograph</button><button className={mode==='saved'?'active':''} onClick={()=>setMode('saved')}>Saved meals</button><button className={mode==='recipe'?'active':''} onClick={()=>setMode('recipe')}>Recipe book</button><button className={mode==='manual'?'active':''} onClick={()=>setMode('manual')}>Manual</button></div>}
      {mode==='ai'&&(recipeReview?<IngredientReview review={recipeReview} onChange={setRecipeReview} onDone={finishRecipeReview} onBack={()=>setRecipeReview(null)} analysing={analysing}/>:<AiForm analysing={analysing} onAnalyse={analyse} onExtract={extractRecipe}/>)}
      {mode==='recipe'&&<RecipePicker personal={state?.templates.filter(template=>template.source==='recipe_photo')||[]} onSelect={applyRecipe} onPersonal={applyPersonalRecipe}/>}
      {mode==='saved'&&<SavedMealsManager templates={state?.templates||[]} categories={state?.categories||[]} onUse={applyTemplate} onAdd={addSelectedTemplates} onChanged={()=>load()} saving={saving}/>}
      {mode==='manual'&&<form className="meal-form" onSubmit={saveMeal}>
        <label className="field">Meal name<input required maxLength={120} value={draft.name} onChange={(e)=>setDraft({...draft,name:e.target.value})}/></label>
        <div className="two-fields"><label className="field">Date<input type="date" required value={draft.date} onChange={(e)=>setDraft({...draft,date:e.target.value})}/></label><label className="field">Time<input type="time" required value={draft.time} onChange={(e)=>setDraft({...draft,time:e.target.value})}/></label></div>
        <label className="field">Description<textarea maxLength={2000} value={draft.description} onChange={(e)=>setDraft({...draft,description:e.target.value})}/></label>
        {draft.source==='ai'&&<section className="recalculate"><button className="secondary" type="button" disabled={analysing||!draft.description.trim()} onClick={recalculateDescription}>{analysing?'Recalculating…':'Recalculate from description'}</button><p className="form-help">Updates the food units, nutrition and ingredient breakdown from the edited text. The original photos are unavailable because they are not stored.</p></section>}
        {(draft.source==='recipe'||draft.source==='template')&&<PortionPicker key={selection} base={draft} recipe={draft.source==='recipe'} onApply={(portion,factor)=>{setDraft(current=>({...current,...portion,assumptions:[...current.assumptions.filter(note=>!note.startsWith('Portion multiplier:')),`Portion multiplier: ${factor}× the loaded serving. Ingredient calculation notes refer to that original serving.`]}));setScaled(value=>value+1);}}/>}
        <UnitBreakdown components={draft.components} units={draft.units} categories={state?.categories||[]}/>
        {draft.assumptions.length>0&&<div className="assumptions"><strong>AI assumptions to check</strong><ul>{draft.assumptions.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
        <h3>Food units</h3><p className="form-help">Enter decimals such as 0.25 or 1.2; the buttons adjust by half a unit.</p>{(state?.categories||[]).map((category)=><NumberField key={`${selection}-${scaled}-${category.id}`} label={category.name} value={draft.units[category.id]||0} step={.5} onChange={(value)=>setDraft({...draft,units:{...draft.units,[category.id]:value}})}/>) }
        <h3>Nutrition</h3><p className="form-help">AI and photograph values are estimates. Correct them when packaging or a recipe gives better information.</p><div className="nutrition-grid">{nutrientFields.map(([key,label,unit])=><label className="field compact" key={key}>{label}<span><input type="number" min="0" step="0.1" value={draft.nutrients[key]??''} onChange={(e)=>setDraft({...draft,nutrients:{...draft.nutrients,[key]:e.target.value===''?null:Number(e.target.value)}})}/><i>{unit}</i></span></label>)}</div>
        {!draft.id&&!draft.templateId&&draft.recipePhotoAnalysed&&<label className="check"><input type="checkbox" checked={draft.saveRecipe} onChange={(e)=>setDraft({...draft,saveRecipe:e.target.checked,saveTemplate:!e.target.checked})}/>Add this analysed portion and all its nutrition to my recipe book</label>}
        {!draft.id&&!draft.templateId&&!draft.saveRecipe&&<label className="check"><input type="checkbox" checked={draft.saveTemplate} onChange={(e)=>setDraft({...draft,saveTemplate:e.target.checked})}/>Save this calculation for quick re-use</label>}
        <div className="form-actions">{draft.id&&<button className="danger" type="button" onClick={()=>deleteMeal(draft.id!)}>Remove</button>}<button className="primary" disabled={saving}>{saving?'Saving…':'Save meal'}</button></div>
      </form>}
    </section></div>}
  </main>;
}

function PortionPicker({base,recipe,onApply}:{base:Portion;recipe:boolean;onApply:(portion:Portion,factor:number)=>void}){
  const [original]=useState<Portion>(()=>({units:{...base.units},nutrients:{...base.nutrients},components:base.components}));
  const [factor,setFactor]=useState('1'); const [applied,setApplied]=useState(1);
  const number=Number(factor.replace(',','.')); const valid=Number.isFinite(number)&&number>0&&number<=100;
  function apply(value:number){onApply(scalePortion(original,value),value);setFactor(String(value));setApplied(value);}
  return <section className="portion-picker"><h3>{recipe?'Recipe servings':'Saved-meal portion'}</h3><p className="form-help">{recipe?'1 = one published recipe serving.':'1 = the portion in the saved meal.'} Scaling replaces the units and nutrition below; make any manual corrections afterwards.</p><div className="portion-controls"><label className="field">Portion multiplier<input inputMode="decimal" value={factor} onChange={event=>{if(/^\d*(?:[.,]\d*)?$/.test(event.target.value))setFactor(event.target.value)}}/></label><button className="secondary" type="button" disabled={!valid} onClick={()=>apply(number)}>Apply portion</button></div><div className="recipe-filters">{[.5,1,1.5,2].map(value=><button type="button" key={value} onClick={()=>apply(value)}>{value}×</button>)}</div><p className="form-help" role="status">Applied: {format(applied)}× the original portion. Ingredient amounts scale too; calculation notes describe the original portion.</p></section>;
}
function UnitBreakdown({components,units,categories}:{components:AnalysisComponent[];units:Record<string,number>;categories:Category[]}){
  const available=components.filter(item=>item.units);
  if(!available.length)return null;
  const changed=categories.some(category=>Math.abs((units[category.id]||0)-available.reduce((sum,item)=>sum+(item.units?.[category.id]||0),0))>.001);
  return <details className="unit-breakdown" open><summary>Ingredient unit breakdown</summary><p className="form-help">Estimated amounts and CSIRO food-group units. Legumes can contribute to two groups.</p>{available.map((item,index)=><article key={index}><strong>{item.name} · {format(item.grams)} g</strong><p>{formatUnits(item.units||{},categories)}</p><small>{item.unitReason}</small></article>)}{changed&&<p className="form-help" role="status">Your edited meal totals differ from this ingredient estimate. The totals below are what will be saved.</p>}</details>;
}

function AiForm({analysing,onAnalyse,onExtract}:{analysing:boolean;onAnalyse:(data:FormData)=>void;onExtract:(data:FormData)=>void}) {
  const [hasRecipePhoto,setHasRecipePhoto]=useState(false);
  const [recipeUrl,setRecipeUrl]=useState('');
  return <form className="ai-form" onSubmit={(event)=>{event.preventDefault();const data=new FormData(event.currentTarget);void (hasRecipePhoto||recipeUrl.trim()?onExtract(data):onAnalyse(data));}}>
    <div className="ai-intro"><strong>AI meal estimate</strong><p>Describe a meal, or add a recipe URL or photo. You can correct recipe ingredients before calculation.</p></div>
    <label className="field">Meal name <span className="optional">optional</span><input name="name" maxLength={120} placeholder="For example: chicken curry"/></label>
    <label className="field">Describe what you ate<textarea name="description" maxLength={2500} placeholder="For example: one bowl of chicken curry with about a cup of rice and a spoonful of yoghurt"/></label>
    <label className="photo-field"><span><strong>Meal photo</strong><small>A plate, bowl, drink or packaged food</small></span><input name="mealPhotos" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple/></label>
    <label className="field">Recipe URL <span className="optional">optional</span><input name="recipeUrl" type="url" placeholder="https://example.com/recipe" value={recipeUrl} onChange={event=>setRecipeUrl(event.target.value)} disabled={hasRecipePhoto}/></label>
    <label className="photo-field"><span><strong>Recipe photo</strong><small>A recipe page or ingredient list</small></span><input name="recipePhotos" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={Boolean(recipeUrl.trim())} onChange={event=>setHasRecipePhoto(Boolean(event.currentTarget.files?.length))}/></label>
    {(hasRecipePhoto||recipeUrl.trim())&&<label className="check"><input type="checkbox" name="saveRecipe"/>Add this recipe to my recipe book</label>}
    <p className="privacy-note">Recipes use Australian cups (250 mL) and tablespoons (20 mL) unless specified otherwise. Photos are resized and stripped of embedded metadata before analysis; the images are not stored.</p>
    <button className="primary wide" disabled={analysing}>{analysing?'Working…':hasRecipePhoto||recipeUrl.trim()?'Review ingredients':'Calculate units and nutrition'}</button>
  </form>;
}

function IngredientReview({review,onChange,onDone,onBack,analysing}:{review:RecipeReview;onChange:(value:RecipeReview)=>void;onDone:(value:RecipeReview)=>void;onBack:()=>void;analysing:boolean}){
  const [blank,setBlank]=useState({quantity:'',name:''});
  function update(id:string,key:'quantity'|'name',value:string){onChange({...review,ingredients:review.ingredients.map(item=>item.id===id?{...item,[key]:value}:item)});}
  function add(){if(!blank.name.trim())return;onChange({...review,ingredients:[...review.ingredients,{id:crypto.randomUUID(),quantity:blank.quantity,name:blank.name}]});setBlank({quantity:'',name:''});}
  function remove(id:string){onChange({...review,ingredients:review.ingredients.filter(item=>item.id!==id)});}
  return <section className="ingredient-review"><div className="ai-intro"><strong>Review ingredients</strong><p>Tap a quantity or name to edit. Swipe left to remove an ingredient. Add one in the blank row, then tap Done.</p></div>
    <label className="field">Recipe name<input value={review.name} maxLength={120} onChange={event=>onChange({...review,name:event.target.value})}/></label>
    <label className="field">Recipe yield<input value={review.yield} maxLength={120} placeholder="e.g. 4 servings" onChange={event=>onChange({...review,yield:event.target.value})}/></label>
    <div className="ingredient-head"><span>Quantity</span><span>Ingredient</span></div>
    <div className="ingredient-list">{review.ingredients.map(item=><IngredientRow key={item.id} item={item} onUpdate={(key,value)=>update(item.id,key,value)} onRemove={()=>remove(item.id)}/>)}
      <div className="ingredient-fields ingredient-new"><input aria-label="New ingredient quantity" placeholder="Amount" value={blank.quantity} onChange={event=>setBlank({...blank,quantity:event.target.value})}/><input aria-label="New ingredient name" placeholder="Add ingredient" value={blank.name} onChange={event=>setBlank({...blank,name:event.target.value})} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();add();}}}/><button type="button" aria-label="Add ingredient" onClick={add} disabled={!blank.name.trim()}>+</button></div>
    </div><p className="form-help">Australian cup = 250 mL; tablespoon = 20 mL unless the recipe says otherwise. Calculation is for one serving.</p>
    <div className="form-actions"><button type="button" className="secondary" onClick={onBack}>Back</button><button type="button" className="primary" disabled={analysing||(!review.ingredients.length&&!blank.name.trim())} onClick={()=>onDone(blank.name.trim()?{...review,ingredients:[...review.ingredients,{id:crypto.randomUUID(),...blank}]}:review)}>{analysing?'Calculating…':'Done'}</button></div>
  </section>;
}

function IngredientRow({item,onUpdate,onRemove}:{item:{quantity:string;name:string};onUpdate:(key:'quantity'|'name',value:string)=>void;onRemove:()=>void}){
  const [start,setStart]=useState<{x:number;y:number}|null>(null);
  return <div className="ingredient-swipe" onTouchStart={event=>setStart({x:event.touches[0].clientX,y:event.touches[0].clientY})} onTouchEnd={event=>{if(!start)return;const dx=event.changedTouches[0].clientX-start.x;const dy=event.changedTouches[0].clientY-start.y;if(dx < -75&&Math.abs(dx)>Math.abs(dy)*1.4)onRemove();setStart(null);}}><div className="ingredient-fields"><input aria-label={`Quantity for ${item.name}`} value={item.quantity} onChange={event=>onUpdate('quantity',event.target.value)}/><input aria-label="Ingredient name" value={item.name} onChange={event=>onUpdate('name',event.target.value)}/><button type="button" className="ingredient-delete" aria-label={`Remove ${item.name}`} onClick={onRemove}>×</button></div></div>;
}

function SwipeMeal({meal,categories,auto,onEdit,onRemove,onDouble,disabled}:{meal:Meal;categories:Category[];auto:boolean;onEdit:()=>void;onRemove:()=>Promise<void>;onDouble:()=>Promise<void>;disabled:boolean}){
  const [offset,setOffset]=useState(0);const [start,setStart]=useState<{x:number;y:number}|null>(null);
  return <div className="meal-swipe" onTouchStart={event=>setStart({x:event.touches[0].clientX,y:event.touches[0].clientY})} onTouchEnd={event=>{if(!start)return;const dx=event.changedTouches[0].clientX-start.x;const dy=event.changedTouches[0].clientY-start.y;if(!disabled&&Math.abs(dx)>90&&Math.abs(dx)>Math.abs(dy)*1.4){setOffset(dx<0?-96:96);void (dx<0?onRemove():onDouble()).finally(()=>setOffset(0));}setStart(null);}}><div className="swipe-actions"><button type="button" disabled={disabled} onClick={()=>{setOffset(0);void onDouble();}}>Double</button><button type="button" disabled={disabled} onClick={()=>{setOffset(0);void onRemove();}}>Remove</button></div><button className="meal-card" style={{transform:`translateX(${offset}px)`}} onClick={()=>offset?setOffset(0):onEdit()}><span><strong>{meal.name}</strong><small>{meal.time}</small></span><span>{auto&&<em className="auto-label">Added automatically · </em>}{formatUnits(meal.units,categories)}</span><b>{meal.energyKj===null?'Not calculated':`${round(meal.energyKj)} kJ`}</b></button></div>;
}

function SavedMealsManager({templates,categories,onUse,onAdd,onChanged,saving}:{templates:MealTemplate[];categories:Category[];onUse:(template:MealTemplate)=>void;onAdd:(ids:string[])=>Promise<void>;onChanged:()=>void;saving:boolean}){
  const [query,setQuery]=useState(''); const [editing,setEditing]=useState<MealTemplate|null>(null); const [busy,setBusy]=useState(false); const [problem,setProblem]=useState(''); const [selected,setSelected]=useState<string[]>([]);
  const matches=useMemo(()=>{const term=query.trim().toLowerCase();return templates.filter(item=>!term||`${item.name} ${item.description}`.toLowerCase().includes(term));},[templates,query]);
  async function addSelected(){setBusy(true);setProblem('');try{await onAdd(selected);}catch(error){setProblem(message(error));}finally{setBusy(false);}}
  function toggle(id:string){setSelected(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);}
  async function save(){if(!editing)return;setBusy(true);setProblem('');try{const response=await fetch(`/api/templates/${encodeURIComponent(editing.id)}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(editing)});const payload=await response.json() as ApiError;if(!response.ok)throw new Error(payload.error||'Could not save this meal.');setEditing(null);onChanged();}catch(error){setProblem(message(error));}finally{setBusy(false);}}
  async function remove(template:MealTemplate){if(!confirm(`Delete saved meal “${template.name}”?`))return;setBusy(true);setProblem('');try{const response=await fetch(`/api/templates/${encodeURIComponent(template.id)}`,{method:'DELETE'});const payload=await response.json() as ApiError;if(!response.ok)throw new Error(payload.error||'Could not delete this meal.');if(editing?.id===template.id)setEditing(null);onChanged();}catch(error){setProblem(message(error));}finally{setBusy(false);}}
  if(editing)return <section className="saved-picker saved-editor"><div className="section-heading"><h3>Edit saved meal</h3><button type="button" className="secondary" onClick={()=>setEditing(null)}>Cancel</button></div>{problem&&<p className="inline-error" role="alert">{problem}</p>}<label className="field">Meal name<input required maxLength={120} value={editing.name} onChange={event=>setEditing({...editing,name:event.target.value})}/></label><label className="field">Description<textarea maxLength={2000} value={editing.description} onChange={event=>setEditing({...editing,description:event.target.value})}/></label><h4>Food units</h4>{categories.map(category=><NumberField key={category.id} label={category.name} value={editing.units[category.id]||0} step={.5} onChange={value=>setEditing({...editing,units:{...editing.units,[category.id]:value}})}/>)}<h4>Nutrition</h4><div className="nutrition-grid">{nutrientFields.map(([key,label,unit])=><label className="field compact" key={key}>{label}<span><input type="number" min="0" step="any" value={editing[key]??''} onChange={event=>setEditing({...editing,[key]:event.target.value===''?null:Number(event.target.value)})}/><i>{unit}</i></span></label>)}</div><div className="form-actions"><button type="button" className="danger" disabled={busy} onClick={()=>remove(editing)}>Delete</button><button type="button" className="primary" disabled={busy||!editing.name.trim()} onClick={save}>{busy?'Saving…':'Save changes'}</button></div></section>;
  return <section className="saved-picker"><h3>Saved meals</h3><p>Select several to add together, or use one to adjust its portion first.</p><label className="field saved-search">Search saved meals<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search by name or description"/></label>{problem&&<p className="inline-error" role="alert">{problem}</p>}<div>{matches.map(template=><article className="saved-row" key={template.id}><label className="saved-select"><input type="checkbox" checked={selected.includes(template.id)} onChange={()=>toggle(template.id)} aria-label={`Select ${template.name}`}/><span><strong>{template.name}</strong><small>{template.energyKj===null?'No energy':`${round(template.energyKj)} kJ`}</small></span></label><button type="button" className="saved-edit" onClick={()=>onUse(template)} aria-label={`Use and adjust ${template.name}`}>Use</button><button type="button" className="saved-edit" aria-label={`Edit ${template.name}`} onClick={()=>setEditing({...template,units:{...template.units}})}>Edit</button><button type="button" className="saved-delete" aria-label={`Delete ${template.name}`} disabled={busy||saving} onClick={()=>remove(template)}>Delete</button></article>)}</div>{!matches.length&&<p className="empty">{templates.length?'No saved meals match your search.':'No saved meals yet.'}</p>}<button type="button" className="primary wide saved-add" disabled={!selected.length||busy||saving} onClick={addSelected}>{busy||saving?'Saving…':`Save ${selected.length||''} selected meal${selected.length===1?'':'s'} to this day`}</button></section>;
}
function RecipePicker({personal,onSelect,onPersonal}:{personal:MealTemplate[];onSelect:(recipe:RecipeRecord)=>void;onPersonal:(recipe:MealTemplate)=>void}){
  const [query,setQuery]=useState(''); const [category,setCategory]=useState<'all'|'mine'|RecipeRecord['category']>('all');
  const term=query.trim().toLowerCase();
  const personalMatches=personal.filter(recipe=>(category==='all'||category==='mine')&&`${recipe.name} ${recipe.description}`.toLowerCase().includes(term));
  const bookMatches=recipes.filter(recipe=>(category==='all'||category===recipe.category)&&recipe.name.toLowerCase().includes(term));
  return <section className="recipe-picker">
    <div className="recipe-intro"><strong>Recipe book</strong><p>Your photo recipes include all reviewed nutrition and food units for the analysed portion. The published book has kilojoules and protein only.</p></div>
    <label className="field">Search recipes<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="For example: salmon, oats or soup"/></label>
    <div className="recipe-filters" aria-label="Recipe filter">{(['all','mine','breakfast','lunch','dinner'] as const).map(value=><button type="button" key={value} className={category===value?'active':''} onClick={()=>setCategory(value)}>{value==='all'?'All':value==='mine'?'My recipes':value[0].toUpperCase()+value.slice(1)}</button>)}</div>
    <p className="recipe-count">{personalMatches.length+bookMatches.length} recipe{personalMatches.length+bookMatches.length===1?'':'s'}</p>
    <div className="recipe-list">
      {personalMatches.map(recipe=><button type="button" key={recipe.id} onClick={()=>onPersonal(recipe)}><span><strong>{recipe.name}</strong><small>My recipe · analysed portion</small></span><span><b>{recipe.energyKj===null?'—':`${round(recipe.energyKj)} kJ`}</b><small>{recipe.proteinG===null?'—':`${round(recipe.proteinG)} g protein`}</small></span></button>)}
      {bookMatches.map(recipe=><button type="button" key={recipe.id} onClick={()=>onSelect(recipe)}><span><strong>{recipe.name}</strong><small>{recipe.category} · page {recipe.page}</small></span><span><b>{round(recipe.nutrients.energyKj||0)} kJ</b><small>{format(recipe.nutrients.proteinG||0)} g protein</small></span></button>)}
    </div>
    {!personalMatches.length&&!bookMatches.length&&<p className="empty">No recipes match your search.</p>}
  </section>;
}
function NumberField({label,value,step,onChange}:{label:string;value:number;step:number;onChange:(value:number)=>void}){
  const [text,setText]=useState(String(value));
  function change(text:string){
    if(!/^\d*(?:[.,]\d*)?$/.test(text))return;
    setText(text);
    const next=Number(text.replace(',','.'));
    if(Number.isFinite(next))onChange(next);
  }
  function nudge(amount:number){const next=Math.max(0,Number((value+amount).toFixed(6)));setText(String(next));onChange(next);}
  return <label className="unit-field"><strong>{label}</strong><span><button type="button" aria-label={`Decrease ${label}`} onClick={()=>nudge(-step)}>−</button><input aria-label={label} inputMode="decimal" value={text} onChange={(e)=>change(e.target.value)} onBlur={()=>setText(String(value))}/><button type="button" aria-label={`Increase ${label}`} onClick={()=>nudge(step)}>+</button></span></label>
}
function NutritionHero({nutrition,label,subtitle}:{nutrition:Nutrients;label:string;subtitle:string}){return <section className="energy-card"><p>{label}</p><strong>{nutrition.energyKj===null?'—':`${round(nutrition.energyKj)} kJ`}</strong><span>{subtitle}</span></section>}
function NutritionStrip({nutrition,guidance}:{nutrition:Nutrients;guidance?:NutritionGuidance}){return <section className={`nutrition-strip${guidance?' guided':''}`}>{nutrientFields.slice(1).map(([key,label,unit])=>{const indicator=guidance?.[key];return <div key={key} className={indicator?`nutrition-${indicator.status}`:undefined} title={indicator?.description} aria-label={indicator?`${label}: ${nutrition[key]===null?'not calculated':`${round(nutrition[key]!)} ${unit}`}. ${indicator.status==='good'?'In range':indicator.status==='near'?'Close to range':indicator.status==='outside'?'Outside range':'Not assessed'}. ${indicator.description}`:undefined}><span>{label}</span><strong>{nutrition[key]===null?'—':`${round(nutrition[key]!)} ${unit}`}</strong></div>})}</section>}
function ProgressCard({category,value,target=category.target}:{category:Category;value:number;target?:number}){
  const indulgence=category.id==='indulgence';
  const vegetables=category.id==='veg';
  const denominator=Math.max(target,value)||1;
  const within=indulgence?0:(vegetables?value:Math.min(value,target))/denominator*100;
  const excess=indulgence||vegetables?0:Math.max(0,value-target)/denominator*100;
  const indulgenceWidth=indulgence?value/denominator*100:0;
  return <article className="progress-card"><div><strong>{category.name}</strong><span>{format(value)}/{format(target)}</span></div><div className="bar" role="progressbar" aria-label={category.name} aria-valuenow={value} aria-valuemin={0} aria-valuemax={denominator} aria-valuetext={`${format(value)} units; target ${format(target)}${value>target?`; ${format(value-target)} above target`:''}`}><i className="bar-within" style={{width:`${within}%`}}/><i className="bar-excess" style={{width:`${excess}%`}}/><i className="bar-indulgence" style={{width:`${indulgenceWidth}%`}}/></div></article>;
}
function WeekView({state}:{state:TrackerState|null}){const guidance=weeklyNutritionGuidance(state?.weeklyNutrition||emptyNutrition,state?.weeklyDaysRecorded||0);return <section className="view-page"><h2>7 day totals</h2><p className="range">{state?`${prettyDate(state.weeklyStart)} – ${prettyDate(state.weeklyEnd)}`:''}</p><NutritionHero nutrition={state?.weeklyNutrition||emptyNutrition} label="Seven-day energy" subtitle={state?.weeklyDaysRecorded?`${round((state.weeklyNutrition.energyKj||0)/state.weeklyDaysRecorded)} kJ average across ${state.weeklyDaysRecorded} recorded day${state.weeklyDaysRecorded===1?'':'s'}`:'No recorded days'}/><div className="progress-list">{state?.categories.map((category)=><ProgressCard key={category.id} category={category} value={state.weeklyUnits[category.id]||0} target={category.target*7}/>)}</div><NutritionStrip nutrition={state?.weeklyNutrition||emptyNutrition} guidance={guidance}/><div className="nutrition-legend" aria-label="Nutrition guidance key"><span><i className="key-good"/>In range</span><span><i className="key-near"/>Close</span><span><i className="key-outside"/>Outside</span><span><i className="key-unrated"/>Not assessed</span></div><details className="guidance-details"><summary>How these comparisons work</summary><p>Colours appear only when meals are recorded on all seven days. They are indicative comparisons, not a verdict on diet quality; an incomplete food log or AI-estimated nutrition can mislead.</p><ul><li>Protein: green at ≥84 g/day (1.2 g/kg for an active 70 kg adult); amber 70–&lt;84 g/day; red below 70 g/day. Higher protein is not marked red.</li><li>Carbohydrate: 45–65% and fat: 20–35% of energy from the three macronutrients (17 kJ/g for protein and carbohydrate; 37 kJ/g for fat). Amber is within five percentage points of either boundary. These population ranges may not fit every weight-loss or exercise plan.</li><li>Fibre: green at ≥28 g/day; amber at 25–&lt;28 g/day. Sodium: green at ≤2,000 mg/day; amber up to 2,300 mg/day. Saturated fat: green below 10% of logged energy; amber below 12%.</li><li>Total sugars stay grey: the guideline is for <em>free sugars</em>, which this tracker cannot separate from sugars naturally present in foods.</li></ul><p className="guidance-sources">Reference values: <a href="https://www.eatforhealth.gov.au/nutrient-reference-values/chronic-disease/summary" target="_blank" rel="noreferrer">Australian macronutrient and fibre targets</a>, <a href="https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/sodium" target="_blank" rel="noreferrer">sodium</a>, <a href="https://www.sportsdietitians.com.au/wp-content/uploads/2020/10/Masters-Athletes-updated-v2-1.pdf" target="_blank" rel="noreferrer">active older-adult protein</a>, and <a href="https://www.who.int/news/item/17-07-2023-who-updates-guidelines-on-fats-and-carbohydrates" target="_blank" rel="noreferrer">saturated fat</a>.</p></details></section>}
function GuideView({categories}:{categories:Category[]}){return <section className="view-page"><h2>Unit guide</h2><details><summary>How CSIRO units are counted</summary><ul>{CSIRO_UNIT_RULES.map((rule)=><li key={rule}>{rule}</li>)}</ul></details><div className="guide-list">{categories.map((category)=><article key={category.id}><h3>{category.name}</h3><p><strong>1 unit equals:</strong></p><ul>{category.guide.split(/;|\n\n/).map((portion,index)=><li key={index}>{portion.trim()}</li>)}</ul></article>)}</div></section>}
function TransferView(){return <section className="view-page"><h2>Import/export</h2><div className="transfer-card"><p>This synced Site starts with a fresh record. Download a copy whenever you like.</p><a className="primary link" href="/api/export?format=csv">Save CSV</a><a className="secondary link" href="/api/export?format=json">Save JSON backup</a><small>Legacy local records are not imported into this Site.</small></div></section>}
function SettingsView({categories,onSaved}:{categories:Category[];onSaved:()=>void}){const [items,setItems]=useState<Category[]>(categories);const [busy,setBusy]=useState(false);async function save(){setBusy(true);const response=await fetch('/api/settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({categories:items})});setBusy(false);if(response.ok)onSaved();else alert('Could not save settings.');}function add(){const id=`category-${crypto.randomUUID().slice(0,8)}`;setItems([...items,{id,name:'New category',target:1,guide:'',sortOrder:items.length,locked:false}]);}return <section className="view-page"><div className="section-heading"><h2>Settings</h2><button className="secondary" onClick={add}>Add category</button></div><div className="settings-list">{items.map((item,index)=><article key={item.id}><div className="two-fields"><label className="field">Name<input value={item.name} onChange={(e)=>setItems(items.map((cat,i)=>i===index?{...cat,name:e.target.value}:cat))}/></label><label className="field">Target<input type="number" min="0" step="any" value={item.target} onChange={(e)=>setItems(items.map((cat,i)=>i===index?{...cat,target:Number(e.target.value)}:cat))}/></label></div><label className="field">1 unit guide<textarea value={item.guide} onChange={(e)=>setItems(items.map((cat,i)=>i===index?{...cat,guide:e.target.value}:cat))}/></label>{items.length>1&&<button className="text-danger" onClick={()=>setItems(items.filter((_,i)=>i!==index))}>Remove category</button>}</article>)}</div><button className="primary wide sticky-save" disabled={busy} onClick={save}>{busy?'Saving…':'Save settings'}</button><div className="privacy-card"><h3>Privacy</h3><p>Diet records are private to your signed-in account. Meal and recipe photos are sent for analysis but are not retained by Diet Tracker. AI nutrition results are estimates and are not medical advice.</p></div></section>}

function newDraft(date:string):Draft{return{name:'',date,time:currentTime(),description:'',source:'manual',units:{},nutrients:{...emptyNutrition},assumptions:[],components:[],confidence:null,saveTemplate:false,saveRecipe:false,recipePhotoAnalysed:false,analysisId:null}}
function pickNutrition(value:Nutrients):Nutrients{return Object.fromEntries(nutrientFields.map(([key])=>[key,value[key]])) as Nutrients;}
function sumUnits(meals:Meal[]){const totals:Record<string,number>={};for(const meal of meals)for(const [id,value] of Object.entries(meal.units))totals[id]=(totals[id]||0)+value;return totals;}
function formatUnits(units:Record<string,number>,categories:Category[]){const values=categories.filter((cat)=>(units[cat.id]||0)>0).map((cat)=>`${cat.name}: ${format(units[cat.id])}`);return values.join(' · ')||'No food units';}
function format(value:number){return value.toLocaleString('en-AU',{maximumFractionDigits:3});}
function round(value:number){return Math.round(value).toLocaleString('en-AU');}
function todayKey(){return localKey(new Date());} function localKey(date:Date){const copy=new Date(date.getTime()-date.getTimezoneOffset()*60000);return copy.toISOString().slice(0,10);} function currentTime(){return new Date().toLocaleTimeString('en-AU',{hour12:false,hour:'2-digit',minute:'2-digit'});} function prettyDate(key:string){return new Date(`${key}T12:00:00`).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'});} function message(error:unknown){return error instanceof Error?error.message:'Something went wrong.';}
async function privacySafeImage(file:File){const bitmap=await createImageBitmap(file);const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const context=canvas.getContext('2d');if(!context)throw new Error('This photo could not be prepared.');context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const blob=await new Promise<Blob|null>((resolve)=>canvas.toBlob(resolve,'image/jpeg',.84));if(!blob)throw new Error('This photo could not be prepared.');return new File([blob],'diet-photo.jpg',{type:'image/jpeg'});}

// metadata: date: 2026-09-12; model: GPT (Codex; exact version unavailable); prompt: Let AI-added meals be named, manage saved meals, and round serving-scaled nutrition to integers.
// metadata: date: 2026-09-12; model: GPT (Codex; exact version unavailable); prompt: Recalculate AI meal units and nutrition after its description is edited.
// metadata: date: 2026-09-26; model: GPT-6; prompt: Make the diet tracker site look more professional and aesthetically appealing and improve the UX. Make sure you don’t lose any of the user data.
// metadata: date: 2026-09-26; model: GPT-6; prompt: Start each new day with Usual breakfast while allowing its removal, and allow adding multiple saved foods at once.
// metadata: date: 2026-09-27; model: GPT-6; prompt: When adding a meal from a recipe photo, provide a checkbox to add the recipe to the recipe book and save all nutritional information with it.

// metadata: GPT-5.6 Sol; time: 2026-09-11 13:56 Australia/Sydney; date: 2026-09-11; prompt: Implement the complete signed-in Diet Tracker Site, including meal and recipe-photo AI analysis and reusable nutrition snapshots.
// metadata: GPT-5.6 Sol; time: 2026-09-11 14:02 Australia/Sydney; date: 2026-09-11; prompt: Continue implementation after securely saving the dedicated OpenAI API key; validate and prepare the private Site.
// metadata: GPT-5.6 Sol; time: 2026-09-11 14:05 Australia/Sydney; date: 2026-09-11; prompt: Resolve strict response JSON typing exposed by the private Site validation.
// metadata: GPT-5.6 Sol; time: 2026-09-11 15:23 Australia/Sydney; date: 2026-09-11; prompt: Add Barbara's Recipe Book as a searchable meal source with one-serving values loaded without AI.
// metadata: GPT-5.6 Sol; time: 2026-09-11 15:35 Australia/Sydney; date: 2026-09-11; prompt: Remove validation-only trailing whitespace before publishing the recipe-book update.

// metadata: date: 2026-09-11; model: GPT (Codex; exact model version unavailable); prompt: Restore the detailed supplied CSIRO unit guide, align AI food-group counting, allow decimal units, and suggest UX improvements.

// metadata: date: 2026-09-11; model: GPT (Codex; exact version unavailable); prompt: Yes, publish the fixes and implement portion multipliers and ingredient-by-ingredient unit breakdowns.

// metadata: date: 2026-09-11; model: GPT (Codex; exact version unavailable); prompt: Colour unit bars teal up to target, red only for excess, keep vegetables teal, and give indulgences a contrasting colour.
// metadata: date: 2026-09-27; model: GPT-6; prompt: Add recipes from URL or photo with editable ingredients before Australian-measure nutrition analysis; swipe left to remove a meal and right to double it.
// metadata: date: 2026-09-27; model: GPT-6; prompt: Add subtle fixed green/amber/red seven-day nutritional guideline lines, with active 70 kg protein and macro-ratio checks.
