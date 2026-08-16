import { existsSync, readFileSync } from 'node:fs';
import { normalizeFridaFood, type FoodItem, type FridaFood } from './normalize.js';

/**
 * DTU Frida — the official Danish food composition database. It covers the
 * generic, unbranded, home-cooked foods Open Food Facts is weakest on
 * (rugbrød, leverpostej, frikadeller), because OFF is barcode/branded-centric.
 *
 * Frida has NO public API — the site is a single-page app over an
 * undocumented backend, which we deliberately do not reverse-engineer. The
 * dataset is instead shipped as a converted JSON file (see
 * scripts/convert-frida.ts) and refreshed manually when DTU publishes a new
 * version.
 *
 * The dataset is optional: if the file is absent the server still runs and
 * simply serves Open Food Facts results, reporting Frida as unavailable
 * rather than failing to start.
 */

export interface FridaDataset {
  version: string;
  foods: FridaFood[];
}

export class FridaSource {
  private readonly foods: FoodItem[];
  readonly version?: string;

  constructor(options: { path?: string; dataset?: FridaDataset } = {}) {
    const dataset = options.dataset ?? loadDataset(options.path ?? process.env.FRIDA_DATA_PATH ?? './data/frida.json');
    this.version = dataset?.version;
    this.foods = (dataset?.foods ?? []).map(normalizeFridaFood);
  }

  get available(): boolean {
    return this.foods.length > 0;
  }

  get size(): number {
    return this.foods.length;
  }

  search(query: string, limit = 10): FoodItem[] {
    const q = query.trim().toLowerCase();
    if (!q || !this.available) {
      return [];
    }
    const terms = q.split(/\s+/).filter(Boolean);
    return this.foods
      .map(food => {
        const name = food.name.toLowerCase();
        let score = 0;
        if (name === q) score += 100;
        if (name.startsWith(q)) score += 50;
        if (name.includes(q)) score += 25;
        for (const term of terms) {
          if (name.includes(term)) score += 5;
        }
        return { food, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length)
      .slice(0, limit)
      .map(x => x.food);
  }

  getById(id: string): FoodItem | undefined {
    return this.foods.find(food => food.id === id);
  }
}

function loadDataset(path: string): FridaDataset | undefined {
  if (!existsSync(path)) {
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as FridaDataset;
  } catch {
    // A corrupt bundled dataset shouldn't take the whole server down; OFF still works.
    return undefined;
  }
}
