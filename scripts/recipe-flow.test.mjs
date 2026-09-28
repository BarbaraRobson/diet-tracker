import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server=await createServer({configFile:false,server:{middlewareMode:true},resolve:{alias:{'@':process.cwd()}},plugins:[{
  name:'recipe-route-fixtures',enforce:'pre',
  resolveId(id){if(id==='@/lib/api'||id.endsWith('/lib/api'))return '\0fixture-api';if(id==='@/db/ensure'||id.endsWith('/db/ensure'))return '\0fixture-ensure';if(id==='@/db/index'||id.endsWith('/db/index'))return '\0fixture-db';},
  load(id){if(id==='\0fixture-api')return `export const requireApiUser=async()=>({user:{userId:'test'}});export const rejectCrossOriginMutation=()=>null;export const errorResponse=(message,status=400)=>Response.json({error:message},{status});`;
    if(id==='\0fixture-ensure')return 'export const ensureUserDefaults=async()=>{};';
    if(id==='\0fixture-db')return `export const getD1=()=>globalThis.__recipeTestDB;export const getOpenAIConfig=()=>({apiKey:'test',model:'test-model'});`;
  },
}]});

try {
  const measures=await server.ssrLoadModule('/lib/recipe-measures.ts');
  test('Australian spoons and ingredient density',()=>{
    assert.equal(measures.volumeMl('1 tbsp'),20);
    assert.equal(measures.volumeMl('4 tsp'),20);
    assert.equal(measures.volumeMl('1/2 cup'),125);
    assert.equal(measures.volumeMl('1 tbsp (15 mL)'),15);
    assert.equal(measures.volumeMl('1 litre'),1000);
    assert.equal(measures.volumeMassG('1 tbsp','olive oil'),18.2);
    assert.equal(measures.volumeMassG('1 tbsp','honey'),28.6);
    assert.equal(measures.volumeMassG('1 tbsp','flour'),10);
    assert.equal(measures.volumeMassG('1 tbsp','unknown ingredient'),null);
    assert.deepEqual(measures.oilPerServing({name:'Test',yield:'Serves 4',ingredients:[{quantity:'1 tbsp',name:'olive oil'}]}),[{name:'olive oil',ml:5,units:1}]);
    assert.deepEqual(measures.oilPerServing({name:'Test',yield:'Serves 1',ingredients:[{quantity:'1 tbsp',name:'olive oil'}]}),[{name:'olive oil',ml:20,units:4}]);
    const reviewed=new FormData();reviewed.set('reviewedRecipe','true');reviewed.set('recipe','{"name":"Test"}');const outgoing=new FormData();
    measures.copyReviewedRecipeFields(reviewed,outgoing);
    assert.equal(outgoing.get('reviewedRecipe'),'true');assert.equal(outgoing.get('recipe'),'{"name":"Test"}');
  });

  const { POST:analyse }=await server.ssrLoadModule('/app/api/analyze/route.ts');
  const { POST:save }=await server.ssrLoadModule('/app/api/meals/route.ts');
  test('reviewed recipe analysis saves both day entry and recipe snapshot',async()=>{
    const analyses=new Map();const inserts=[];
    globalThis.__recipeTestDB={
      prepare(sql){return {bind(...args){return {
        first:async()=>sql.includes('COUNT(*)')?{count:0}:sql.includes('FROM ai_analyses')?analyses.get(args[0])||null:null,
        all:async()=>({results:sql.includes('FROM categories')?[{id:'fat',name:'Healthy Fats & Oils',target:3,guide:'1 tsp oil',sort_order:0}]:[]}),
        run:async()=>{if(sql.startsWith('INSERT INTO ai_analyses'))analyses.set(args[0],{input_kind:args[3],status:args[4]});},
        sql,args,
      };}};},
      batch:async(statements)=>{inserts.push(...statements);},
    };
    const originalFetch=globalThis.fetch;
    globalThis.fetch=async()=>Response.json({output_text:JSON.stringify({name:'Test salad',description:'Test salad',confidence:'medium',assumptions:[],clarifyingQuestions:[],components:[
      {name:'olive oil',searchTerm:'olive oil',grams:13.6,dietUnits:{fat:3},unitReason:'incorrect US spoon',energyKj:503,proteinG:0,carbohydrateG:0,sugarsG:0,fatG:13.6,saturatedFatG:2,fibreG:0,sodiumMg:0},
      {name:'honey',searchTerm:'honey',grams:5,dietUnits:{fat:0},unitReason:'used water density',energyKj:65,proteinG:0,carbohydrateG:16,sugarsG:16,fatG:0,saturatedFatG:0,fibreG:0,sodiumMg:0},
      {name:'tomato',searchTerm:'tomato',grams:50,dietUnits:{fat:0},unitReason:'one serving',energyKj:35,proteinG:.3,carbohydrateG:1.5,sugarsG:1.2,fatG:0,saturatedFatG:0,fibreG:.5,sodiumMg:2},
    ]})});
    try {
      const form=new FormData();form.set('reviewedRecipe','true');form.set('description','Test salad');form.set('recipe',JSON.stringify({name:'Test salad',yield:'Serves 4',ingredients:[{quantity:'1 tbsp',name:'olive oil'},{quantity:'1 tbsp',name:'honey'},{quantity:'200 g',name:'tomato'}]}));
      const analysisResponse=await analyse(new Request('https://diet.test/api/analyze',{method:'POST',body:form}));
      assert.equal(analysisResponse.status,200);
      const analysis=await analysisResponse.json();
      assert.equal(analysis.units.fat,1);
      assert.equal(analysis.components[0].grams,4.55);
      assert.equal(analysis.components[1].grams,7.15);
      assert.match(analysis.components[0].unitReason,/20 mL = 4 teaspoons/);
      assert.equal(analyses.get(analysis.analysisId).input_kind,'reviewed_recipe');
      const saveResponse=await save(new Request('https://diet.test/api/meals',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:analysis.name,date:'2026-09-28',time:'12:00',description:analysis.description,source:'ai',units:analysis.units,nutrients:analysis.nutrition,components:analysis.components,analysisId:analysis.analysisId,saveRecipe:true})}));
      assert.equal(saveResponse.status,200);
      const saved=await saveResponse.json();assert.ok(saved.id);assert.ok(saved.recipeId);
      assert.ok(inserts.some(item=>item.sql.startsWith('INSERT INTO meals ')));
      assert.ok(inserts.some(item=>item.sql.startsWith('INSERT INTO meal_templates ')));
      assert.ok(inserts.some(item=>item.sql.startsWith('INSERT INTO template_units ')&&item.args[2]===1));
    } finally {globalThis.fetch=originalFetch;delete globalThis.__recipeTestDB;}
  });
} finally {await server.close();}

// metadata: date: 2026-09-28; model: GPT-6; prompt: Test recipe review save to day and book plus Australian tablespoon, teaspoon, oil units, and ingredient-specific density conversions.
// metadata: date: 2026-09-28; model: GPT-6; prompt: Cover browser-to-analysis review marker propagation and density-specific recipe conversion.
