/**
 * One shape for both sources, so callers don't care where a food came from.
 *
 * Everything is per 100 g/ml, which is the only basis both Open Food Facts and
 * DTU Frida reliably share — the caller scales from there.
 */

export type FoodSource = 'openfoodfacts' | 'frida';

export interface Nutrients {
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugars?: number;
  saturatedFat?: number;
  salt?: number;
}

export interface FoodItem {
  /** Stable, source-prefixed id, e.g. "off:5701246014718" or "frida:0123". */
  id: string;
  source: FoodSource;
  name: string;
  brand?: string;
  barcode?: string;
  /** Per 100 g (or 100 ml for liquids). */
  per100g: Nutrients;
  servingSize?: string;
  /** Required licence attribution for this item's source. */
  attribution: string;
}

export const OFF_ATTRIBUTION =
  'Open Food Facts, licensed under the Open Database License (ODbL) — https://world.openfoodfacts.org';

export const FRIDA_ATTRIBUTION =
  'Frida Food Data (https://frida.fooddata.dk), National Food Institute, Technical University of Denmark';

/** OFF returns numbers as number|string depending on endpoint and field. */
function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return round(value);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? round(parsed) : undefined;
  }
  return undefined;
}

/** OFF stores full float precision (e.g. 1.399999976158142); 2 decimals is plenty for food. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * `brands` is a comma-joined string on /api/v2/product but an array on
 * search.openfoodfacts.org — normalize both to a single display string.
 */
function brandOf(brands: unknown): string | undefined {
  if (Array.isArray(brands)) {
    const first = brands.find(b => typeof b === 'string' && b.trim());
    return typeof first === 'string' ? first.trim() : undefined;
  }
  if (typeof brands === 'string' && brands.trim()) {
    return brands.split(',')[0]?.trim();
  }
  return undefined;
}

export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_da?: string;
  brands?: unknown;
  serving_size?: string;
  nutriments?: Record<string, unknown>;
  [key: string]: unknown;
}

export function normalizeOffProduct(product: OffProduct): FoodItem | undefined {
  const code = typeof product.code === 'string' ? product.code : undefined;
  const name = product.product_name_da?.trim() || product.product_name?.trim();
  if (!code || !name) {
    return undefined;
  }
  const n = product.nutriments ?? {};
  return {
    id: `off:${code}`,
    source: 'openfoodfacts',
    name,
    brand: brandOf(product.brands),
    barcode: code,
    per100g: {
      kcal: num(n['energy-kcal_100g']) ?? num(n['energy-kcal']),
      protein: num(n['proteins_100g']),
      carbs: num(n['carbohydrates_100g']),
      fat: num(n['fat_100g']),
      fiber: num(n['fiber_100g']),
      sugars: num(n['sugars_100g']),
      saturatedFat: num(n['saturated-fat_100g']),
      salt: num(n['salt_100g']),
    },
    servingSize: typeof product.serving_size === 'string' ? product.serving_size : undefined,
    attribution: OFF_ATTRIBUTION,
  };
}

export interface FridaFood {
  id: string;
  name: string;
  nameEn?: string;
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugars?: number;
  saturatedFat?: number;
  salt?: number;
}

export function normalizeFridaFood(food: FridaFood): FoodItem {
  return {
    id: `frida:${food.id}`,
    source: 'frida',
    name: food.name,
    per100g: {
      kcal: food.kcal,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      fiber: food.fiber,
      sugars: food.sugars,
      saturatedFat: food.saturatedFat,
      salt: food.salt,
    },
    attribution: FRIDA_ATTRIBUTION,
  };
}
