# Bundled data

`frida.json` — the DTU Frida Danish food composition dataset, converted from
DTU's spreadsheet export.

It is **not committed by default** because it must be downloaded by hand: Frida
has no public API, and its site is a single-page app whose backend is
undocumented (we deliberately don't reverse-engineer it).

To add or refresh it:

1. Download the spreadsheet from <https://frida.fooddata.dk/> (Download →
   spreadsheet) and export/save it as CSV.
2. `npm run frida:convert -- <that-file>.csv ./data/frida.json --version 5.5`
3. Check the printed column mapping and spot-check a couple of known foods
   (rugbrød, leverpostej) before committing.

The server runs fine without this file — it simply serves Open Food Facts
results and reports Frida as unavailable via `fooddata_sources`.

**Attribution is required** whenever Frida data is displayed or used:

> Frida Food Data (https://frida.fooddata.dk), National Food Institute,
> Technical University of Denmark.

The server attaches this to every Frida-sourced result automatically.
