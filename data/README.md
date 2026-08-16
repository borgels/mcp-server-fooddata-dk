# Bundled data

`frida.json` — the DTU Frida Danish food composition dataset, converted from
DTU's spreadsheet export.

It is **not committed by default** because it must be downloaded by hand: Frida
has no public API, and its site is a single-page app whose backend is
undocumented (we deliberately don't reverse-engineer it).

To refresh it when DTU publishes a new version:

1. Download `Frida_<version>_Dataset.xlsx` from DTU — either
   <https://frida.fooddata.dk/> (Download) or the DOI landing page at
   <https://data.dtu.dk/> (search "Danish Food Composition Database Frida").
2. Extract a flat CSV — the workbook can't be exported by hand, because
   `Data_Table` has four header rows and food ids live on a separate `Food`
   sheet that must be joined on the Danish food name:
   ```
   python scripts/frida-xlsx-to-csv.py Frida_5.5_Dataset.xlsx frida.csv
   ```
   (needs `pip install openpyxl` — the one non-Node prerequisite here, since
   Frida ships .xlsx/.ods only). The script verifies the column layout against
   the sheet's own English header row and aborts if DTU has reordered
   anything, rather than silently writing the wrong nutrient.
3. `npm run frida:convert -- frida.csv ./data/frida.json --version 5.5`
4. Check the printed column mapping and spot-check known foods before
   committing — e.g. rugbrød ≈ 200 kcal/100 g, havregryn ≈ 366, skyr 0.2 %
   ≈ 70 kcal with ~11 g protein.

Current bundle: **Frida 5.5, 1,381 foods.**

The server runs fine without this file — it simply serves Open Food Facts
results and reports Frida as unavailable via `fooddata_sources`.

**Attribution is required** whenever Frida data is displayed or used:

> Frida Food Data (https://frida.fooddata.dk), National Food Institute,
> Technical University of Denmark.

The server attaches this to every Frida-sourced result automatically.
