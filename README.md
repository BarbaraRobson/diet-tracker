# Diet Tracker

Diet Tracker is a private OpenAI Site for recording CSIRO diet units and nutritional information. Records are scoped to the signed-in ChatGPT user and synchronised through the Site's D1 database.

## Features

- Daily and seven-day food-unit totals
- Kilojoules, protein, carbohydrate, sugars, fat, saturated fat, fibre and sodium
- Meal entry by description, plated-meal photo, recipe photo, or any combination
- AI estimates that the user reviews before saving
- Australian Food Composition Database Release 3 matching for identified food components
- Saved meal calculations that can be reused without another AI request
- Searchable selection from Barbara's Recipe Book without another AI request
- CSV and JSON exports

Meal and recipe photos are resized in the browser and stripped of embedded metadata before analysis. The Site sends them to the OpenAI Responses API with storage disabled and does not save the photos in its own database. Nutrition values remain estimates and are not medical advice.

## Local development

Requirements: Node.js 22.13 or later and pnpm.

1. Copy `.env.example` to `.env.local` and add a project-scoped `OPENAI_API_KEY`.
2. Run `pnpm install`.
3. Run `pnpm run dev`.
4. Open `http://localhost:3000`.

Local development uses the Sites sign-in simulator and a local D1 database. Production authentication, database binding and environment variables are supplied by Sites.

## Validation and deployment

- `pnpm run lint`
- `pnpm exec tsc --noEmit`
- `pnpm run build`
- `pnpm run db:generate`

The production API key must be stored as a secret named `OPENAI_API_KEY` in the Site environment. Never commit `.env.local`, `.dev.vars`, credentials or meal photographs.

## Data sources

`data/afcd-reference.json` is a compact reference generated from Food Standards Australia New Zealand's Australian Food Composition Database Release 3 food details and nutrient profiles. Regenerate it with `scripts/build-afcd-reference.py` and the two official spreadsheets supplied as arguments.

`data/recipe-book-reference.json` contains one-serving meal names, categories and food units from Barbara's Recipe Book. Published kilojoules and protein are retained. Carbohydrate, sugars, fat, saturated fat, fibre and sodium are calculated locally from the original ingredient quantities using AFCD Release 3 and scaled to each recipe's published energy. The file includes calculation provenance and confidence, but deliberately excludes ingredients, methods, photographs, the account email and copyright footer. Regenerate it with `scripts/build-recipe-reference.py SOURCE_PDF OUTPUT_JSON data/afcd-reference.json`.

<!-- metadata: GPT-5 Codex; time: 2026-06-28 11:15 Australia/Sydney; date: 2026-06-28; prompt: Add a README explaining how to install the app on a phone. -->
<!-- metadata: GPT-5.6 Sol; time: 2026-09-11 14:14 Australia/Sydney; date: 2026-09-11; prompt: Document the private signed-in Diet Tracker Site, its AI/photo privacy model, validation, deployment and AFCD provenance. -->
<!-- metadata: GPT-5.6 Sol; time: 2026-09-11 15:29 Australia/Sydney; date: 2026-09-11; prompt: Document Barbara's Recipe Book as a private, minimal selectable data source. -->
<!-- metadata: GPT-6.1 Sol; time: 2026-10-10 Australia/Sydney; date: 2026-10-10; prompt: Update the recipe book to include nutritional info for each recipe, based on the original recipes in the PDF. -->
