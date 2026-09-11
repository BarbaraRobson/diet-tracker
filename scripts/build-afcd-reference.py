"""Build the compact AFCD nutrition reference bundled with Diet Tracker."""

import json
import math
import pathlib
import re
import sys

import pandas as pd


def numeric(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return 0.0
    try:
        return round(float(value), 4)
    except (TypeError, ValueError):
        return 0.0


def normalized_name(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: build-afcd-reference.py <nutrient-profiles.xlsx> <output.json>")

    source = pathlib.Path(sys.argv[1])
    output = pathlib.Path(sys.argv[2])
    frame = pd.read_excel(source, sheet_name="All solids & liquids per 100 g", header=2)

    columns = {
        "key": "Public Food Key",
        "name": "Food Name",
        "energyKj": "Energy with dietary fibre, equated \n(kJ)",
        "proteinG": "Protein \n(g)",
        "carbohydrateG": "Available carbohydrate, with sugar alcohols \n(g)",
        "sugarsG": "Total sugars (g)",
        "fatG": "Fat, total \n(g)",
        "saturatedFatG": "Total saturated fatty acids, equated \n(g)",
        "fibreG": "Total dietary fibre \n(g)",
        "sodiumMg": "Sodium (Na) \n(mg)",
    }

    foods = []
    for _, row in frame.iterrows():
        key = normalized_name(row.get(columns["key"]))
        name = normalized_name(row.get(columns["name"]))
        if not key or not name:
            continue
        item = {"key": key, "name": name}
        for target, source_column in columns.items():
            if target not in {"key", "name"}:
                item[target] = numeric(row.get(source_column))
        foods.append(item)

    payload = {
        "source": {
            "name": "Australian Food Composition Database Release 3",
            "publisher": "Food Standards Australia New Zealand",
            "url": "https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/data-files",
            "basis": "values per 100 g",
        },
        "foods": foods,
        "_metadata": {
            "model": "GPT-5.6 Sol",
            "time": "2026-09-11 13:39 Australia/Sydney",
            "date": "2026-09-11",
            "prompt": "Convert Diet Tracker to a private signed-in Site with synced data and AI analysis of meal descriptions, meal photos, and recipe photos.",
        },
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {len(foods)} foods to {output}")


if __name__ == "__main__":
    main()

# metadata: GPT-5.6 Sol; time: 2026-09-11 13:39 Australia/Sydney; date: 2026-09-11; prompt: Convert Diet Tracker to a private signed-in Site with synced data and AI analysis of meal descriptions, meal photos, and recipe photos.
