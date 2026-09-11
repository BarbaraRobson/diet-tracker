'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AnalysisComponent, Category, Meal, MealTemplate, Nutrients, TrackerState } from '@/lib/types';
import { CSIRO_UNIT_RULES } from '@/lib/unit-rules';
import { scalePortion, type Portion } from '@/lib/portions';
import recipeBook from '@/data/recipe-book-reference.json';

type View = 'today'|'week'|'guide'|'transfer'|'settings';
type Draft = { id?:string; templateId?:string|null; name:string; date:string; time:string; description:string; source:string; units:Record<string,number>; nutrients:Nutrients; assumptions:string[]; components:AnalysisComponent[]; confidence:string|null; saveTemplate:boolean };
type ApiError = { error?:string };
type AnalysisPayload = ApiError & { name:string; description?:string; units:Record<string,number>; nutrition:Nutrients; assumptions?:string[]; components?:AnalysisComponent[]; confidence:string|null; clarifyingQuestions?:string[] };
type RecipeRecord = { id:string; name:string; category:'breakfast'|'lunch'|'dinner'; page:number; servingLabel:string; units:Record<string,number>; nutrients:Nutrients };
const recipes = recipeBook.recipes as RecipeRecord[];
const nutrientFields:Array<[keyof Nutrients,string,string]> = [['energyKj','Energy','kJ'],['proteinG','Protein','g'],['carbohydrateG','Carbohydrate','g'],['sugarsG','Sugars','g'],['fatG','Fat','g'],['saturatedFatG','Saturated fat','g'],['fibreG','Fibre','g'],['sodiumMg','Sodium','mg']];
const emptyNutrition: Nutrients = {energyKj:null,proteinG:null,carbohydrateG:null,sugarsG:null,fatG:null,saturatedFatG:null,fibreG:null,sodiumMg:null};

export default function TrackerClient({initialUserName}:{initialUserName:string}) {
  const [selectedDate,setSelectedDate]=useState(todayKey()); const [view,setView]=useState<View>('today');
  const [state,setState]=useState<TrackerState|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const [editorOpen,setEditorOpen]=useState(false); const [mode,setMode]=useState<'manual'|'ai'|'recipe'>('ai'); const [draft,setDraft]=useState<Draft>(()=>newDraft(todayKey()));
  const [selection,setSelection]=useState(0); const [scaled,setScaled]=useState(0);
  const [analysing,setAnalysing]=useState(false); const [saving,setSaving]=useState(false); const [notice,setNotice]=useState('');

  async function load(date=selectedDate) { setLoading(true); setError(''); try { const response=await fetch(`/api/state?date=${date}`,{cache:'no-store'}); const payload=await response.json() as TrackerState&ApiError; if(!response.ok)throw new Error(payload.error||'Could not load the tracker.'); setState(payload); } catch(e){setError(message(e));} finally{setLoading(false);} }
  useEffect(()=>{
    let cancelled=false;
    fetch(`/api/state?date=${selectedDate}`,{cache:'no-store'})
      .then(async(response)=>{const payload=await response.json() as TrackerState&ApiError;if(!response.ok)throw new Error(payload.error||'Could not load the tracker.');return payload;})
      .then((payload)=>{if(!cancelled){setState(payload);setLoading(false);}})
      .catch((cause)=>{if(!cancelled){setError(message(cause));setLoading(false);}});
    return()=>{cancelled=true;};
  },[selectedDate]);
  const dailyUnits=useMemo(()=>sumUnits(state?.meals||[]),[state?.meals]);

  function openNew() { setSelection((value)=>value+1); setDraft(newDraft(selectedDate)); setMode('ai'); setNotice(''); setEditorOpen(true); }
  function openRecipes() { setSelection((value)=>value+1); setDraft(newDraft(selectedDate)); setMode('recipe'); setNotice(''); setEditorOpen(true); }
  function openEdit(meal:Meal) { setSelection((value)=>value+1); setDraft({id:meal.id,templateId:meal.templateId,name:meal.name,date:meal.date,time:meal.time,description:meal.description,source:meal.source,units:{...meal.units},nutrients:pickNutrition(meal),assumptions:[...meal.assumptions],components:meal.components||[],confidence:meal.confidence,saveTemplate:false}); setMode('manual'); setNotice(''); setEditorOpen(true); }
  function applyTemplate(template:MealTemplate) { setSelection((value)=>value+1); setDraft({templateId:template.id,name:template.name,date:selectedDate,time:currentTime(),description:template.description,source:'template',units:{...template.units},nutrients:pickNutrition(template),assumptions:[...template.assumptions],components:template.components,confidence:template.confidence,saveTemplate:false}); setMode('manual'); setNotice('Using saved values. No AI analysis is needed.'); setEditorOpen(true); }
  function applyRecipe(recipe:RecipeRecord) { setSelection((value)=>value+1); setDraft({name:recipe.name,date:selectedDate,time:currentTime(),description:`Barbara's Recipe Book, page ${recipe.page} · ${recipe.servingLabel}.`,source:'recipe',units:{...recipe.units},nutrients:{...recipe.nutrients},assumptions:[],components:[],confidence:null,saveTemplate:false}); setMode('manual'); setNotice('Recipe-book values loaded for one serving. No AI analysis is needed.'); }

  async function analyse(form:FormData) {
    setAnalysing(true); setError(''); setNotice('Preparing photos and analysing the meal…');
    try {
      const outgoing=new FormData(); outgoing.set('description',String(form.get('description')||''));
      for(const key of ['mealPhotos','recipePhotos']) for(const item of form.getAll(key)) if(item instanceof File&&item.size) outgoing.append(key,await privacySafeImage(item),`${key}-${crypto.randomUUID()}.jpg`);
      const response=await fetch('/api/analyze',{method:'POST',body:outgoing}); const payload=await response.json() as AnalysisPayload; if(!response.ok)throw new Error(payload.error||'Analysis failed.');
      setSelection((value)=>value+1);
      setDraft((current)=>({...current,name:payload.name,description:payload.description||String(form.get('description')||''),source:'ai',units:payload.units,nutrients:payload.nutrition,assumptions:payload.assumptions||[],components:payload.components||[],confidence:payload.confidence,saveTemplate:true}));
      const questions=(payload.clarifyingQuestions||[]) as string[]; setNotice(questions.length?`Please review carefully: ${questions.join(' ')}`:'Analysis complete. Review and adjust every value before saving.'); setMode('manual');
    } catch(e){setError(message(e));setNotice('');} finally{setAnalysing(false);}
  }

  async function saveMeal(event:React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try { const response=await fetch('/api/meals',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...draft,nutrients:draft.nutrients})}); const payload=await response.json() as ApiError; if(!response.ok)throw new Error(payload.error||'Could not save the meal.'); setEditorOpen(false); setNotice('Meal saved and synced.'); await load(draft.date); if(draft.date!==selectedDate)setSelectedDate(draft.date); } catch(e){setError(message(e));} finally{setSaving(false);}
  }

  async function deleteMeal(id:string) { if(!confirm('Remove this meal?'))return; const response=await fetch(`/api/meals/${encodeURIComponent(id)}`,{method:'DELETE'}); if(response.ok){setEditorOpen(false);setNotice('Meal removed.');await load();}else setError('Could not remove the meal.'); }
  function changeDay(offset:number){const date=new Date(`${selectedDate}T12:00:00`);date.setDate(date.getDate()+offset);setSelectedDate(localKey(date));}

  return <main className="app-shell">
    <header className="topbar"><div><p className="eyebrow">Private and synced</p><h1>Diet Tracker</h1></div><a className="account" href="/signout-with-chatgpt?return_to=%2F">{state?.user.displayName||initialUserName}<span>Sign out</span></a></header>
    {error&&<div className="alert error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Dismiss">×</button></div>}
    {notice&&<div className="alert" role="status">{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss">×</button></div>}
    {view==='today'&&<>
      <section className="date-row" aria-label="Selected date"><button onClick={()=>changeDay(-1)} aria-label="Previous day">‹</button><input type="date" value={selectedDate} onChange={(e)=>setSelectedDate(e.target.value)} aria-label="Choose date"/><button onClick={()=>changeDay(1)} aria-label="Next day">›</button></section>
      <NutritionHero nutrition={state?.dailyNutrition||emptyNutrition} label="Today’s energy" subtitle={state?.meals.length?`${state.meals.length} meal${state.meals.length===1?'':'s'} recorded`:'No meals recorded yet'}/>
      <section className="progress-list">{(state?.categories||[]).map((category)=><ProgressCard key={category.id} category={category} value={dailyUnits[category.id]||0}/>)}</section>
      <NutritionStrip nutrition={state?.dailyNutrition||emptyNutrition}/>
      <section className="meal-panel"><div className="section-heading"><h2>Meals</h2><div className="meal-actions"><button className="secondary" onClick={openRecipes}>Recipe book</button><button className="secondary" onClick={()=>{openNew();setMode('manual');}}>Saved meals</button></div></div>
        {loading?<p className="empty">Loading your synced meals…</p>:state?.meals.length?<div className="meal-list">{state.meals.map((meal)=><button className="meal-card" key={meal.id} onClick={()=>openEdit(meal)}><span><strong>{meal.name}</strong><small>{meal.time}</small></span><span>{formatUnits(meal.units,state.categories)}</span><b>{meal.energyKj===null?'Not calculated':`${round(meal.energyKj)} kJ`}</b></button>)}</div>:<p className="empty">Describe a meal, photograph your plate, photograph a recipe, or enter units manually.</p>}
      </section>
      <button className="fab" onClick={openNew}><span>+</span> Add meal</button>
    </>}
    {view==='week'&&<WeekView state={state}/>} {view==='guide'&&<GuideView categories={state?.categories||[]}/>} {view==='transfer'&&<TransferView/>} {view==='settings'&&<SettingsView categories={state?.categories||[]} onSaved={()=>load()}/>} 
    <nav className="bottom-nav" aria-label="Main menu">{([['today','Today'],['week','7 day totals'],['guide','Unit guide'],['transfer','Import/export'],['settings','Settings']] as Array<[View,string]>).map(([key,label])=><button onClick={()=>setView(key)} className={view===key?'active':''} key={key}>{label}</button>)}</nav>
    {editorOpen&&<div className="modal-backdrop"><section className="editor" role="dialog" aria-modal="true" aria-labelledby="editor-title"><div className="editor-heading"><button className="back" onClick={()=>setEditorOpen(false)} aria-label="Close">‹</button><div><p className="eyebrow">{draft.id?'Edit entry':'New entry'}</p><h2 id="editor-title">{draft.id?'Edit meal':'Add a meal'}</h2></div></div>
      {!draft.id&&<div className="mode-tabs"><button className={mode==='ai'?'active':''} onClick={()=>setMode('ai')}>Describe or photograph</button><button className={mode==='recipe'?'active':''} onClick={()=>setMode('recipe')}>Recipe book</button><button className={mode==='manual'?'active':''} onClick={()=>setMode('manual')}>Manual or saved</button></div>}
      {mode==='ai'&&<AiForm analysing={analysing} onAnalyse={analyse}/>} 
      {mode==='recipe'&&<RecipePicker onSelect={applyRecipe}/>}
      {mode==='manual'&&<form className="meal-form" onSubmit={saveMeal}>
        {!draft.id&&state?.templates.length?<div className="saved-picker"><h3>Saved meals</h3><p>Reuse these calculations without AI.</p><div>{state.templates.map((template)=><button type="button" key={template.id} onClick={()=>applyTemplate(template)}><strong>{template.name}</strong><span>{template.energyKj===null?'No energy':`${round(template.energyKj)} kJ`}</span></button>)}</div></div>:null}
        <label className="field">Meal name<input required maxLength={120} value={draft.name} onChange={(e)=>setDraft({...draft,name:e.target.value})}/></label>
        <div className="two-fields"><label className="field">Date<input type="date" required value={draft.date} onChange={(e)=>setDraft({...draft,date:e.target.value})}/></label><label className="field">Time<input type="time" required value={draft.time} onChange={(e)=>setDraft({...draft,time:e.target.value})}/></label></div>
        <label className="field">Description<textarea maxLength={2000} value={draft.description} onChange={(e)=>setDraft({...draft,description:e.target.value})}/></label>
        {(draft.source==='recipe'||draft.source==='template')&&<PortionPicker key={selection} base={draft} recipe={draft.source==='recipe'} onApply={(portion,factor)=>{setDraft(current=>({...current,...portion,assumptions:[...current.assumptions.filter(note=>!note.startsWith('Portion multiplier:')),`Portion multiplier: ${factor}× the loaded serving. Ingredient calculation notes refer to that original serving.`]}));setScaled(value=>value+1);}}/>}
        <UnitBreakdown components={draft.components} units={draft.units} categories={state?.categories||[]}/>
        {draft.assumptions.length>0&&<div className="assumptions"><strong>AI assumptions to check</strong><ul>{draft.assumptions.map((item,index)=><li key={index}>{item}</li>)}</ul></div>}
        <h3>Food units</h3><p className="form-help">Enter decimals such as 0.25 or 1.2; the buttons adjust by half a unit.</p>{(state?.categories||[]).map((category)=><NumberField key={`${selection}-${scaled}-${category.id}`} label={category.name} value={draft.units[category.id]||0} step={.5} onChange={(value)=>setDraft({...draft,units:{...draft.units,[category.id]:value}})}/>) }
        <h3>Nutrition</h3><p className="form-help">AI and photograph values are estimates. Correct them when packaging or a recipe gives better information.</p><div className="nutrition-grid">{nutrientFields.map(([key,label,unit])=><label className="field compact" key={key}>{label}<span><input type="number" min="0" step="0.1" value={draft.nutrients[key]??''} onChange={(e)=>setDraft({...draft,nutrients:{...draft.nutrients,[key]:e.target.value===''?null:Number(e.target.value)}})}/><i>{unit}</i></span></label>)}</div>
        {!draft.id&&!draft.templateId&&<label className="check"><input type="checkbox" checked={draft.saveTemplate} onChange={(e)=>setDraft({...draft,saveTemplate:e.target.checked})}/>Save this calculation for quick re-use</label>}
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

function AiForm({analysing,onAnalyse}:{analysing:boolean;onAnalyse:(data:FormData)=>void}) { return <form className="ai-form" onSubmit={(event)=>{event.preventDefault();void onAnalyse(new FormData(event.currentTarget));}}><div className="ai-intro"><strong>AI meal estimate</strong><p>Add any combination of description, plated-meal photos and recipe photos. You will review the result before it is saved.</p></div><label className="field">Describe what you ate<textarea name="description" maxLength={2500} placeholder="For example: one bowl of chicken curry with about a cup of rice and a spoonful of yoghurt"/></label><label className="photo-field"><span><strong>Meal photo</strong><small>A plate, bowl, drink or packaged food</small></span><input name="mealPhotos" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple/></label><label className="photo-field"><span><strong>Recipe photo</strong><small>A recipe page, ingredient list, method or nutrition panel</small></span><input name="recipePhotos" type="file" accept="image/jpeg,image/png,image/webp" multiple/></label><p className="privacy-note">Photos are resized and stripped of embedded metadata before analysis. They are not saved with the meal.</p><button className="primary wide" disabled={analysing}>{analysing?'Analysing…':'Calculate units and nutrition'}</button></form>; }
function RecipePicker({onSelect}:{onSelect:(recipe:RecipeRecord)=>void}){const [query,setQuery]=useState('');const [category,setCategory]=useState<'all'|RecipeRecord['category']>('all');const matches=useMemo(()=>recipes.filter((recipe)=>(category==='all'||recipe.category===category)&&recipe.name.toLowerCase().includes(query.trim().toLowerCase())),[query,category]);return <section className="recipe-picker"><div className="recipe-intro"><strong>Barbara&apos;s Recipe Book</strong><p>Select one serving to load its published food units, kilojoules and protein. Other nutrients were not supplied in the book.</p></div><label className="field">Search recipes<input type="search" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="For example: salmon, oats or soup"/></label><div className="recipe-filters" aria-label="Recipe meal type">{(['all','breakfast','lunch','dinner'] as const).map((value)=><button type="button" key={value} className={category===value?'active':''} onClick={()=>setCategory(value)}>{value==='all'?'All':value[0].toUpperCase()+value.slice(1)}</button>)}</div><p className="recipe-count">{matches.length} recipe{matches.length===1?'':'s'}</p><div className="recipe-list">{matches.map((recipe)=><button type="button" key={recipe.id} onClick={()=>onSelect(recipe)}><span><strong>{recipe.name}</strong><small>{recipe.category} · page {recipe.page}</small></span><span><b>{round(recipe.nutrients.energyKj||0)} kJ</b><small>{format(recipe.nutrients.proteinG||0)} g protein</small></span></button>)}</div></section>}
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
function NutritionStrip({nutrition}:{nutrition:Nutrients}){return <section className="nutrition-strip">{nutrientFields.slice(1).map(([key,label,unit])=><div key={key}><span>{label}</span><strong>{nutrition[key]===null?'—':`${round(nutrition[key]!)} ${unit}`}</strong></div>)}</section>}
function ProgressCard({category,value,target=category.target}:{category:Category;value:number;target?:number}){const denominator=Math.max(target,value,1);const width=category.id==='indulgence'?Math.min(100,value*25):Math.min(100,value/denominator*100);return <article className="progress-card"><div><strong>{category.name}</strong><span>{format(value)}/{format(target)}</span></div><div className="bar" role="progressbar" aria-label={category.name} aria-valuenow={value} aria-valuemin={0} aria-valuemax={target||undefined}><i style={{width:`${width}%`}}/></div></article>}
function WeekView({state}:{state:TrackerState|null}){return <section className="view-page"><h2>7 day totals</h2><p className="range">{state?`${prettyDate(state.weeklyStart)} – ${prettyDate(state.weeklyEnd)}`:''}</p><NutritionHero nutrition={state?.weeklyNutrition||emptyNutrition} label="Seven-day energy" subtitle={state?.weeklyDaysRecorded?`${round((state.weeklyNutrition.energyKj||0)/state.weeklyDaysRecorded)} kJ average across ${state.weeklyDaysRecorded} recorded day${state.weeklyDaysRecorded===1?'':'s'}`:'No recorded days'}/><div className="progress-list">{state?.categories.map((category)=><ProgressCard key={category.id} category={category} value={state.weeklyUnits[category.id]||0} target={category.target*7}/>)}</div><NutritionStrip nutrition={state?.weeklyNutrition||emptyNutrition}/></section>}
function GuideView({categories}:{categories:Category[]}){return <section className="view-page"><h2>Unit guide</h2><details><summary>How CSIRO units are counted</summary><ul>{CSIRO_UNIT_RULES.map((rule)=><li key={rule}>{rule}</li>)}</ul></details><div className="guide-list">{categories.map((category)=><article key={category.id}><h3>{category.name}</h3><p><strong>1 unit equals:</strong></p><ul>{category.guide.split(/;|\n\n/).map((portion,index)=><li key={index}>{portion.trim()}</li>)}</ul></article>)}</div></section>}
function TransferView(){return <section className="view-page"><h2>Import/export</h2><div className="transfer-card"><p>This synced Site starts with a fresh record. Download a copy whenever you like.</p><a className="primary link" href="/api/export?format=csv">Save CSV</a><a className="secondary link" href="/api/export?format=json">Save JSON backup</a><small>Legacy local records are not imported into this Site.</small></div></section>}
function SettingsView({categories,onSaved}:{categories:Category[];onSaved:()=>void}){const [items,setItems]=useState<Category[]>(categories);const [busy,setBusy]=useState(false);async function save(){setBusy(true);const response=await fetch('/api/settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({categories:items})});setBusy(false);if(response.ok)onSaved();else alert('Could not save settings.');}function add(){const id=`category-${crypto.randomUUID().slice(0,8)}`;setItems([...items,{id,name:'New category',target:1,guide:'',sortOrder:items.length,locked:false}]);}return <section className="view-page"><div className="section-heading"><h2>Settings</h2><button className="secondary" onClick={add}>Add category</button></div><div className="settings-list">{items.map((item,index)=><article key={item.id}><div className="two-fields"><label className="field">Name<input value={item.name} onChange={(e)=>setItems(items.map((cat,i)=>i===index?{...cat,name:e.target.value}:cat))}/></label><label className="field">Target<input type="number" min="0" step="any" value={item.target} onChange={(e)=>setItems(items.map((cat,i)=>i===index?{...cat,target:Number(e.target.value)}:cat))}/></label></div><label className="field">1 unit guide<textarea value={item.guide} onChange={(e)=>setItems(items.map((cat,i)=>i===index?{...cat,guide:e.target.value}:cat))}/></label>{items.length>1&&<button className="text-danger" onClick={()=>setItems(items.filter((_,i)=>i!==index))}>Remove category</button>}</article>)}</div><button className="primary wide sticky-save" disabled={busy} onClick={save}>{busy?'Saving…':'Save settings'}</button><div className="privacy-card"><h3>Privacy</h3><p>Diet records are private to your signed-in account. Meal and recipe photos are sent for analysis but are not retained by Diet Tracker. AI nutrition results are estimates and are not medical advice.</p></div></section>}

function newDraft(date:string):Draft{return{name:'',date,time:currentTime(),description:'',source:'manual',units:{},nutrients:{...emptyNutrition},assumptions:[],components:[],confidence:null,saveTemplate:false}}
function pickNutrition(value:Nutrients):Nutrients{return Object.fromEntries(nutrientFields.map(([key])=>[key,value[key]])) as Nutrients;}
function sumUnits(meals:Meal[]){const totals:Record<string,number>={};for(const meal of meals)for(const [id,value] of Object.entries(meal.units))totals[id]=(totals[id]||0)+value;return totals;}
function formatUnits(units:Record<string,number>,categories:Category[]){const values=categories.filter((cat)=>(units[cat.id]||0)>0).map((cat)=>`${cat.name}: ${format(units[cat.id])}`);return values.join(' · ')||'No food units';}
function format(value:number){return value.toLocaleString('en-AU',{maximumFractionDigits:3});}
function round(value:number){return Math.round(value).toLocaleString('en-AU');}
function todayKey(){return localKey(new Date());} function localKey(date:Date){const copy=new Date(date.getTime()-date.getTimezoneOffset()*60000);return copy.toISOString().slice(0,10);} function currentTime(){return new Date().toLocaleTimeString('en-AU',{hour12:false,hour:'2-digit',minute:'2-digit'});} function prettyDate(key:string){return new Date(`${key}T12:00:00`).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'});} function message(error:unknown){return error instanceof Error?error.message:'Something went wrong.';}
async function privacySafeImage(file:File){const bitmap=await createImageBitmap(file);const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const context=canvas.getContext('2d');if(!context)throw new Error('This photo could not be prepared.');context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const blob=await new Promise<Blob|null>((resolve)=>canvas.toBlob(resolve,'image/jpeg',.84));if(!blob)throw new Error('This photo could not be prepared.');return new File([blob],'diet-photo.jpg',{type:'image/jpeg'});}

// metadata: GPT-5.6 Sol; time: 2026-09-11 13:56 Australia/Sydney; date: 2026-09-11; prompt: Implement the complete signed-in Diet Tracker Site, including meal and recipe-photo AI analysis and reusable nutrition snapshots.
// metadata: GPT-5.6 Sol; time: 2026-09-11 14:02 Australia/Sydney; date: 2026-09-11; prompt: Continue implementation after securely saving the dedicated OpenAI API key; validate and prepare the private Site.
// metadata: GPT-5.6 Sol; time: 2026-09-11 14:05 Australia/Sydney; date: 2026-09-11; prompt: Resolve strict response JSON typing exposed by the private Site validation.
// metadata: GPT-5.6 Sol; time: 2026-09-11 15:23 Australia/Sydney; date: 2026-09-11; prompt: Add Barbara's Recipe Book as a searchable meal source with one-serving values loaded without AI.
// metadata: GPT-5.6 Sol; time: 2026-09-11 15:35 Australia/Sydney; date: 2026-09-11; prompt: Remove validation-only trailing whitespace before publishing the recipe-book update.

// metadata: date: 2026-09-11; model: GPT (Codex; exact model version unavailable); prompt: Restore the detailed supplied CSIRO unit guide, align AI food-group counting, allow decimal units, and suggest UX improvements.

// metadata: date: 2026-09-11; model: GPT (Codex; exact version unavailable); prompt: Yes, publish the fixes and implement portion multipliers and ingredient-by-ingredient unit breakdowns.
