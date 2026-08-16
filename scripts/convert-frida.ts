#!/usr/bin/env node
/**
 * Converts a DTU Frida export into the bundled data/frida.json this server reads.
 *
 * Frida has no public API, so the dataset is downloaded by hand from
 * https://frida.fooddata.dk/ (Download → spreadsheet), exported to CSV, and
 * converted here. Re-run when DTU publishes a new version.
 *
 *   npm run frida:convert -- <input.csv> [output.json] [--version 5.5]
 *
 * Column names in Frida's export are not stable across versions and exist in
 * both Danish and English, so this matches headers loosely and reports what it
 * mapped. ALWAYS check the printed mapping against a couple of known foods
 * before trusting the output.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

interface FridaFood {
  id: string;
  name: string;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugars?: number;
  saturatedFat?: number;
  salt?: number;
}

/** Candidate header fragments per field, lowercased; first match wins. */
const COLUMN_HINTS: Record<keyof Omit<FridaFood, 'id' | 'name'>, string[]> = {
  kcal: ['energy (kcal)', 'energi (kcal)', 'kcal'],
  protein: ['protein'],
  carbs: ['carbohydrate', 'kulhydrat'],
  fat: ['fat, total', 'fedt, total', 'fat', 'fedt'],
  fiber: ['dietary fibre', 'fibre', 'kostfibre', 'fiber'],
  sugars: ['sugar', 'sukker'],
  saturatedFat: ['saturated', 'mættede'],
  salt: ['salt', 'nacl'],
};

const ID_HINTS = ['fooditem id', 'food id', 'id', 'fødevarenummer'];
const NAME_HINTS = ['food name', 'fødevarenavn', 'navn', 'name'];

function main(): void {
  const args = process.argv.slice(2);
  const versionFlag = args.indexOf('--version');
  const version = versionFlag === -1 ? 'unknown' : (args[versionFlag + 1] ?? 'unknown');
  const positional = args.filter((a, i) => !a.startsWith('--') && i !== versionFlag + 1);
  const input = positional[0];
  const output = positional[1] ?? './data/frida.json';

  if (!input) {
    console.error('Usage: npm run frida:convert -- <input.csv> [output.json] [--version 5.5]');
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(input, 'utf8'));
  const header = rows[0];
  if (!header) {
    console.error('Empty CSV.');
    process.exit(1);
  }

  const idCol = findColumn(header, ID_HINTS);
  const nameCol = findColumn(header, NAME_HINTS);
  if (idCol === undefined || nameCol === undefined) {
    console.error(`Could not find id/name columns. Headers seen:\n  ${header.join('\n  ')}`);
    process.exit(1);
  }

  const mapping: Partial<Record<keyof FridaFood, number>> = { id: idCol, name: nameCol };
  for (const [field, hints] of Object.entries(COLUMN_HINTS) as Array<[keyof typeof COLUMN_HINTS, string[]]>) {
    const col = findColumn(header, hints);
    if (col !== undefined) mapping[field] = col;
  }

  console.error('Column mapping (verify this looks right):');
  for (const [field, col] of Object.entries(mapping)) {
    console.error(`  ${field.padEnd(13)} <- "${header[col as number]}"`);
  }
  const missing = Object.keys(COLUMN_HINTS).filter(f => !(f in mapping));
  if (missing.length) console.error(`  (not found, will be omitted: ${missing.join(', ')})`);

  const foods: FridaFood[] = [];
  for (const row of rows.slice(1)) {
    const id = row[idCol]?.trim();
    const name = row[nameCol]?.trim();
    if (!id || !name) continue;
    const food: FridaFood = { id, name };
    for (const [field, col] of Object.entries(mapping)) {
      if (field === 'id' || field === 'name') continue;
      const value = parseNumber(row[col as number]);
      if (value !== undefined) (food as Record<string, unknown>)[field] = value;
    }
    foods.push(food);
  }

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify({ version, foods }, null, 2)}\n`, 'utf8');
  console.error(`\nWrote ${foods.length} foods to ${output} (version ${version}).`);
  console.error('Spot-check a few known foods (rugbrød, leverpostej) before committing.');
}

function findColumn(header: string[], hints: string[]): number | undefined {
  const lower = header.map(h => h.trim().toLowerCase());
  for (const hint of hints) {
    const exact = lower.indexOf(hint);
    if (exact !== -1) return exact;
  }
  for (const hint of hints) {
    const partial = lower.findIndex(h => h.includes(hint));
    if (partial !== -1) return partial;
  }
  return undefined;
}

/** Frida exports use Danish decimal commas; values may also be blank or "-". */
function parseNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!cleaned || cleaned === '-') return undefined;
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : undefined;
}

/** Minimal RFC4180-ish CSV reader (quotes, embedded separators/newlines). Auto-detects , or ; */
function parseCsv(text: string): string[][] {
  const sep = (text.split('\n')[0]?.match(/;/g)?.length ?? 0) > (text.split('\n')[0]?.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === sep) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => r.some(c => c.trim()));
}

main();
