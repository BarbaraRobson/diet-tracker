"""Extract selectable one-serving records from Barbara's Recipe Book PDF."""

from __future__ import annotations

import argparse
import hashlib
import json
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


def recipe_record(reader: PdfReader, entry: dict[str, object], end_page: int) -> dict[str, object]:
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
    return {
        "id": f"recipe-{start_page}-{slug(title)}",
        "name": title,
        "category": category,
        "page": start_page,
        "servingLabel": "1 serving",
        "units": units,
        "nutrients": {
            "energyKj": float(nutrition_match.group(2)),
            "proteinG": float(nutrition_match.group(3)),
            "carbohydrateG": None,
            "sugarsG": None,
            "fatG": None,
            "saturatedFatG": None,
            "fibreG": None,
            "sodiumMg": None,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source_pdf", type=Path)
    parser.add_argument("output_json", type=Path)
    args = parser.parse_args()
    reader = PdfReader(args.source_pdf)
    entries = index_entries(reader)
    if len(entries) < 100 or {str(entry["category"]) for entry in entries} != set(CATEGORY_NAMES.values()):
        raise ValueError(f"Recipe index is incomplete: found {len(entries)} entries")
    recipes = [
        recipe_record(reader, entry, int(entries[index + 1]["page"]) - 1 if index + 1 < len(entries) else 145)
        for index, entry in enumerate(entries)
    ]
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
            "model": "GPT-5.6 Sol",
            "prompt": "Add Barbara's Recipe Book as a selectable private meal data source in Diet Tracker.",
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
