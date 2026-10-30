#!/usr/bin/env python3
"""Copy data/prices.json into js/prices.js so prices also work when the site is opened
straight from disk (file://), where browsers block fetch(). Run after editing prices.json:
    python3 tools/sync_prices.py
"""
import json, pathlib
site = pathlib.Path(__file__).resolve().parent.parent
data = json.loads((site/'data/prices.json').read_text())
for k, v in data.items():
    if v is not None and not (isinstance(v, (int, float)) and v >= 0):
        raise SystemExit(f"prices.json: {k} must be null or a number >= 0 (got {v!r})")
(site/'js/prices.js').write_text("/* AUTO-GENERATED from data/prices.json by tools/sync_prices.py. Do not edit here. */\nwindow.WWS_PRICES_FALLBACK = " + json.dumps(data, indent=2) + ";\n")
print("js/prices.js updated from data/prices.json:", sum(v is not None for v in data.values()), "of", len(data), "SKUs priced")
