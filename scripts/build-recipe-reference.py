"""Extract selectable one-serving records from Barbara's Recipe Book PDF."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader


CATEGORY_NAMES = {"Breakfast": "breakfast", "Lunch": "lunch", "Dinner": "dinner"}
UNIT_PATTERNS = {
    "protein": r"Meat\s*&\s*Protein",
    "grain": r"Bread\s*&\s*Cereals",
    "veg": r"Vegetables",
    "fruit": r"Fruit",
    "dairy": r"Dairy",
    "fat": r"Healthy\s*Fats\s*&\s*Oils",
    "indulgence": r"Indulgences?",
}
NUTRIENT_KEYS = (
    "energyKj", "proteinG", "carbohydrateG", "sugarsG", "fatG",
    "saturatedFatG", "fibreG", "sodiumMg",
)
MATCH_STOP_WORDS = {
    "a", "all", "and", "any", "approx", "cooked", "fresh", "from", "in",
    "of", "or", "prepared", "style", "the", "to", "with", "without",
}


def compact(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def recipe_page_text(value: str) -> str:
    return re.sub(
        r"This document is authorised for use by Barbara Robson.*?Barbara's Recipe Book\s*\|\s*(?:Breakfast|Lunch|Dinner)\s*\d+",
        " ",
        value,
        flags=re.IGNORECASE | re.DOTALL,
    )


def slug(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-")[:90]


def normalized(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", ascii_value.lower()).strip()


def match_terms(value: str) -> list[str]:
    values: list[str] = []
    for word in normalized(value).split():
        if len(word) <= 1 or word in MATCH_STOP_WORDS:
            continue
        if word.endswith("ies") and len(word) > 4:
            word = word[:-3] + "y"
        elif word.endswith("oes") and len(word) > 4:
            word = word[:-2]
        elif word.endswith("s") and not word.endswith("ss") and len(word) > 3:
            word = word[:-1]
        values.append(word)
    return values


def match_score(query: str, candidate: str) -> float:
    query_value, candidate_value = normalized(query), normalized(candidate)
    if not query_value:
        return 0
    if query_value == candidate_value:
        return 1
    if candidate_value.startswith(query_value + " "):
        return min(0.97, 0.86 + len(query_value) / max(len(candidate_value), 1) * 0.11)
    if query_value in candidate_value:
        return min(0.94, 0.78 + len(query_value) / max(len(candidate_value), 1) * 0.16)
    query_terms = match_terms(query_value)
    candidate_terms = set(match_terms(candidate_value))
    intersection = len([term for term in query_terms if term in candidate_terms])
    if not intersection:
        return 0
    recall = intersection / len(query_terms)
    precision = intersection / max(len(candidate_terms), 1)
    return recall * 0.72 + precision * 0.28


def ingredient_queries(description: str) -> list[str]:
    primary = description.split(",", 1)[0]
    values = [description, primary]
    aliases = {
        "brown rice & quinoa": "rice quinoa cooked",
        "burgen bread": "bread mixed grain",
        "chobani low-fat greek yoghurt": "yoghurt greek reduced fat",
        "coconut milk, reduced-fat": "coconut milk reduced fat",
        "firm tofu": "tofu firm",
        "beef liquid stock": "stock liquid commercial",
        "cannellini beans": "bean cannellini canned drained",
        "chicken liquid stock": "stock liquid commercial",
        "dried paprika": "paprika dry powder",
        "eggs": "egg chicken whole raw",
        "frozen mango": "mango raw",
        "frozen mixed berries": "berry mixture frozen",
        "frozen broad beans": "broad bean frozen",
        "green beans": "bean green raw",
        "latte, low-fat milk": "coffee latte low fat milk",
        "mixed grain bread": "bread mixed grain",
        "mixed grain bread roll": "bread roll mixed grain",
        "mushrooms": "mushroom common fresh raw",
        "olive oil spray": "oil olive",
        "soy milk": "soy beverage reduced fat",
        "shredded coconut": "coconut flesh dried",
        "snowpeas": "snow pea fresh raw",
        "strawberries": "strawberry raw",
        "sweetcorn, canned": "corn kernel canned",
        "sweet chilli sauce": "sauce sweet chilli commercial",
        "tomatoes": "tomato red raw",
        "vanilla essence": "vanilla artificial",
        "vegetable liquid stock": "stock liquid commercial",
        "walnuts": "nut walnut raw unsalted",
        "white fish": "fish white flesh raw",
        "wholegrain wrap": "flat bread wheat",
    }
    key = normalized(primary)
    if key in aliases:
        values.insert(0, aliases[key])
    return list(dict.fromkeys(value for value in values if value))


def match_food(description: str, foods: list[dict[str, object]]) -> tuple[dict[str, object] | None, float]:
    best_food, best_score = None, 0.0
    description_value = normalized(description)
    for query in ingredient_queries(description):
        query_value = normalized(query)
        for food in foods:
            score = match_score(query_value, str(food["name"]))
            food_value = normalized(str(food["name"]))
            for marker in ("low fat", "reduced fat", "raw", "canned", "dried", "wholemeal"):
                if marker in description_value:
                    score += 0.025 if marker in food_value else -0.015
            if score > best_score:
                best_food, best_score = food, score
    return (best_food, min(best_score, 1.0)) if best_score >= 0.58 else (None, best_score)


def ingredient_mass(value: float, unit: str, description: str) -> float:
    if unit.lower() == "g":
        return value
    name = normalized(description)
    if any(word in name for word in ("oil", "mayonnaise")):
        return value * 0.91
    if any(word in name for word in ("honey", "syrup", "molasses")):
        return value * 1.4
    if any(word in name for word in ("milk", "yoghurt", "cream")):
        return value * 1.03
    return value


def recipe_ingredients(text: str, title: str) -> list[tuple[str, float]]:
    before_method = text.split(" Method ", 1)[0]
    start = before_method.lower().find(title.lower())
    if start >= 0:
        before_method = before_method[start + len(title):]
    before_method = re.sub(rf"^\s*{re.escape(title)}(?:\s*\([^)]*\))?\s*,?\s*makes?\s+\d+\s+servings?\s*", "", before_method, flags=re.IGNORECASE)
    if "Other ingredients" in before_method:
        before_method = before_method.split("Other ingredients", 1)[1]
    before_method = re.sub(r"^\s*Extra Ingredients,?\s*1 serving\s*", "", before_method, flags=re.IGNORECASE)
    ingredients: list[tuple[str, float]] = []
    cursor = 0
    for match in re.finditer(r"\(([0-9]+(?:\.[0-9]+)?)(g|ml)\)", before_method, flags=re.IGNORECASE):
        description = compact(before_method[cursor:match.start()]).strip(" ,.;")
        cursor = match.end()
        if description:
            value = float(match.group(1))
            ingredients.append((description, ingredient_mass(value, match.group(2), description)))
    return ingredients


def serving_count(text: str) -> float:
    matches = re.findall(r"makes?\s+([0-9]+(?:\.[0-9]+)?)\s+serv(?:e|es|ing|ings)", text, flags=re.IGNORECASE)
    return float(matches[-1]) if matches else 1.0


def estimated_nutrition(
    text: str,
    title: str,
    foods: list[dict[str, object]],
    published_energy: float,
    published_protein: float,
    inherited_recipe: dict[str, object] | None = None,
) -> tuple[dict[str, float], dict[str, object]]:
    ingredients = recipe_ingredients(text, title)
    servings = serving_count(text)
    totals = {key: 0.0 for key in NUTRIENT_KEYS}
    if inherited_recipe:
        for key in NUTRIENT_KEYS:
            totals[key] = float(inherited_recipe["nutrients"][key])
    matched_mass = 0.0
    matched: list[dict[str, object]] = []
    unmatched: list[str] = []
    for description, mass in ingredients:
        food, score = match_food(description, foods)
        if not food:
            unmatched.append(description.split(",", 1)[0])
            continue
        matched_mass += mass
        factor = mass / 100 / servings
        for key in NUTRIENT_KEYS:
            totals[key] += float(food[key]) * factor
        matched.append({"ingredient": description.split(",", 1)[0], "foodKey": food["key"], "score": round(score, 3)})
    total_mass = sum(mass for _, mass in ingredients)
    coverage = matched_mass / total_mass if total_mass else 0
    raw_energy = totals["energyKj"]
    raw_protein = totals["proteinG"]
    energy_ratio = published_energy / raw_energy if raw_energy else 1
    calculated_non_protein_energy = max(1.0, totals["carbohydrateG"] * 17 + totals["fatG"] * 37)
    published_non_protein_energy = max(0.0, published_energy - published_protein * 17)
    scale = min(4.0, max(0.1, published_non_protein_energy / calculated_non_protein_energy))
    estimates = {
        key: round(max(0, totals[key] * scale), 1)
        for key in NUTRIENT_KEYS
        if key not in ("energyKj", "proteinG")
    }
    protein_ratio = published_protein / raw_protein if raw_protein else math.inf
    confidence = "high" if coverage >= 0.95 and 0.75 <= energy_ratio <= 1.3 and 0.7 <= protein_ratio <= 1.35 else "medium"
    provenance = {
        "method": "Ingredient quantities from the source PDF matched locally to AFCD Release 3; missing nutrients scaled to the recipe's published energy.",
        "confidence": confidence,
        "ingredientCount": len(ingredients),
        "matchedIngredientCount": len(matched),
        "matchedMassPercent": round(coverage * 100, 1),
        "rawCalculatedEnergyKj": round(raw_energy, 1),
        "rawCalculatedProteinG": round(raw_protein, 1),
        "energyScale": round(scale, 3),
        "unmatchedIngredientCount": len(dict.fromkeys(unmatched)),
        "inheritedRecipe": inherited_recipe["name"] if inherited_recipe else None,
    }
    return estimates, provenance


def index_entries(reader: PdfReader) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    for page_index in range(144, 149):
        for raw_line in (reader.pages[page_index].extract_text() or "").splitlines():
            line = compact(raw_line)
            match = re.match(r"^(.*\S)\s+\((Breakfast|Lunch|Dinner)\)\s+(\d{1,3})$", line)
            if match:
                entries.append({
                    "category": CATEGORY_NAMES[match.group(2)],
                    "contentsTitle": match.group(1),
                    "page": int(match.group(3)),
                })
    return sorted(entries, key=lambda entry: int(entry["page"]))


def canonical_title(reader: PdfReader, page_number: int, category: str, fallback: str) -> str:
    lines = [compact(line) for line in (reader.pages[page_number - 1].extract_text() or "").splitlines() if compact(line)]
    if lines and lines[0].lower() == f"{category} meals":
        lines.pop(0)
    if not lines:
        return fallback
    title = lines[0]
    cursor = 1
    while title.count("(") > title.count(")") and cursor < len(lines):
        title = compact(f"{title} {lines[cursor]}")
        cursor += 1
    return title


def recipe_record(
    reader: PdfReader,
    entry: dict[str, object],
    end_page: int,
    foods: list[dict[str, object]],
    prior_recipes: list[dict[str, object]],
) -> dict[str, object]:
    start_page = int(entry["page"])
    category = str(entry["category"])
    title = canonical_title(reader, start_page, category, str(entry["contentsTitle"]))
    text = compact(" ".join(recipe_page_text(reader.pages[index].extract_text() or "") for index in range(start_page - 1, end_page)))
    nutrition_match = re.search(
        r"Each serve(?:\s+of\s+.+?)?\s+provides:\s*(.*?)\s*([0-9]+(?:\.[0-9]+)?)\s*kilojoules,\s*([0-9]+(?:\.[0-9]+)?)g\s*protein",
        text,
        flags=re.IGNORECASE,
    )
    if not nutrition_match:
        raise ValueError(f"Nutrition summary not found for page {start_page}: {title}")
    unit_text = nutrition_match.group(1)
    units: dict[str, float] = {}
    for unit_id, label_pattern in UNIT_PATTERNS.items():
        match = re.search(rf"([0-9]+(?:\.[0-9]+)?)\s+{label_pattern}", unit_text, flags=re.IGNORECASE)
        units[unit_id] = float(match.group(1)) if match else 0.0
    published_energy = float(nutrition_match.group(2))
    published_protein = float(nutrition_match.group(3))
    inherited_recipe = None
    if "Other ingredients" in text:
        reference = normalized(text.split(title, 1)[-1].split("Other ingredients", 1)[0])
        inherited_recipe = next((recipe for recipe in reversed(prior_recipes) if normalized(str(recipe["name"])) in reference), None)
    estimates, provenance = estimated_nutrition(text, title, foods, published_energy, published_protein, inherited_recipe)
    return {
        "id": f"recipe-{start_page}-{slug(title)}",
        "name": title,
        "category": category,
        "page": start_page,
        "servingLabel": "1 serving",
        "units": units,
        "nutrients": {
            "energyKj": published_energy,
            "proteinG": published_protein,
            **estimates,
        },
        "nutritionProvenance": provenance,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_pdf", type=Path)
    parser.add_argument("output_json", type=Path)
    parser.add_argument("afcd_reference", type=Path)
    args = parser.parse_args()
    reader = PdfReader(args.source_pdf)
    foods = json.loads(args.afcd_reference.read_text(encoding="utf-8"))["foods"]
    entries = index_entries(reader)
    if len(entries) < 100 or {str(entry["category"]) for entry in entries} != set(CATEGORY_NAMES.values()):
        raise ValueError(f"Recipe index is incomplete: found {len(entries)} entries")
    recipes: list[dict[str, object]] = []
    for index, entry in enumerate(entries):
        end_page = int(entries[index + 1]["page"]) - 1 if index + 1 < len(entries) else 145
        recipes.append(recipe_record(reader, entry, end_page, foods, recipes))
    if len({recipe["id"] for recipe in recipes}) != len(recipes):
        raise ValueError("Recipe IDs are not unique")
    source_hash = hashlib.sha256(args.source_pdf.read_bytes()).hexdigest()
    output = {
        "_metadata": {
            "title": "Barbara's Recipe Book",
            "sourceFile": args.source_pdf.name,
            "sourceSha256": source_hash,
            "sourcePages": len(reader.pages),
            "recipeCount": len(recipes),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "generator": "scripts/build-recipe-reference.py",
            "nutritionSource": "Ingredient quantities in the source PDF and Australian Food Composition Database Release 3",
            "nutritionMethod": "Published energy and protein retained; other nutrients calculated locally from AFCD matches and scaled to published energy.",
            "model": "GPT-6.1 Sol",
            "prompt": "Update the recipe book to include nutritional info for each recipe, based on the original recipes in the PDF.",
        },
        "recipes": recipes,
    }
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    counts = {category: sum(recipe["category"] == category for recipe in recipes) for category in CATEGORY_NAMES.values()}
    print(json.dumps({"recipes": len(recipes), "categories": counts, "sourceSha256": source_hash}))


if __name__ == "__main__":
    main()

# metadata: GPT-5.6 Sol; time: 2026-09-11 15:08 Australia/Sydney; date: 2026-09-11; prompt: Add Barbara's Recipe Book as a selectable private meal data source in Diet Tracker.
# metadata: GPT-5.6 Sol; time: 2026-09-11 15:12 Australia/Sydney; date: 2026-09-11; prompt: Correct recipe extraction by using the detailed alphabetical index as the canonical page map.
# metadata: GPT-5.6 Sol; time: 2026-09-11 15:14 Australia/Sydney; date: 2026-09-11; prompt: Validate against the current recipe book rather than an older remembered recipe count.
# metadata: GPT-5.6 Sol; time: 2026-09-11 15:17 Australia/Sydney; date: 2026-09-11; prompt: Exclude PDF page footers when parsing nutrition summaries that continue onto another page.
# metadata: GPT-5.6 Sol; time: 2026-09-11 15:29 Australia/Sydney; date: 2026-09-11; prompt: Add generation provenance to the recipe reference data.
# metadata: GPT-6.1 Sol; time: 2026-10-10 Australia/Sydney; date: 2026-10-10; prompt: Update the recipe book to include nutritional info for each recipe, based on the original recipes in the PDF.
# metadata: GPT-6.1 Sol; time: 2026-10-10 20:15 Australia/Sydney; date: 2026-10-10; prompt: Improve AFCD matching for plural and common recipe ingredient names after validating all 118 recipes.
# metadata: GPT-6.1 Sol; time: 2026-10-10 20:19 Australia/Sydney; date: 2026-10-10; prompt: Preserve nutrition when a meal reuses an earlier recipe and correct section-label parsing for composite recipes.
# metadata: GPT-6.1 Sol; time: 2026-10-10 20:23 Australia/Sydney; date: 2026-10-10; prompt: Keep calculation diagnostics while excluding ingredient names from the published recipe reference.
# metadata: GPT-6.1 Sol; time: 2026-10-10 20:29 Australia/Sydney; date: 2026-10-10; prompt: Calibrate calculated carbohydrate and fat to the published energy after accounting for published protein energy.
# metadata: GPT-6.1 Sol; time: 2026-10-10 20:33 Australia/Sydney; date: 2026-10-10; prompt: Permit full residual-energy calibration for recipes whose branded or composite ingredients do not directly match AFCD entries.
