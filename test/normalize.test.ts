import { describe, expect, it } from 'vitest';
import { normalizeFridaFood, normalizeOffProduct } from '../src/fooddata/normalize.js';

describe('normalizeOffProduct', () => {
  // Shape taken from a real /api/v2/product response (Kohberg Rugbrød).
  const product = {
    code: '5701246014718',
    product_name: 'Rugbrød',
    brands: 'Kohberg',
    serving_size: '55 g',
    nutriments: {
      'energy-kcal_100g': 205,
      proteins_100g: 5.699999809265137,
      carbohydrates_100g: 38,
      fat_100g: 1.399999976158142,
      fiber_100g: 8.600000381469727,
      sugars_100g: 2.200000047683716,
      'saturated-fat_100g': 0.20000000298023224,
    },
  };

  it('maps per-100g nutrients and rounds OFF float noise', () => {
    const item = normalizeOffProduct(product)!;
    expect(item.id).toBe('off:5701246014718');
    expect(item.source).toBe('openfoodfacts');
    expect(item.name).toBe('Rugbrød');
    expect(item.brand).toBe('Kohberg');
    expect(item.barcode).toBe('5701246014718');
    expect(item.servingSize).toBe('55 g');
    // 5.699999809265137 must not leak through to the caller.
    expect(item.per100g).toMatchObject({ kcal: 205, protein: 5.7, carbs: 38, fat: 1.4, fiber: 8.6, sugars: 2.2, saturatedFat: 0.2 });
    expect(item.attribution).toContain('Open Food Facts');
  });

  it('handles brands as an array (search endpoint) as well as a string (product endpoint)', () => {
    expect(normalizeOffProduct({ ...product, brands: ['Kohberg', 'Other'] })?.brand).toBe('Kohberg');
    expect(normalizeOffProduct({ ...product, brands: 'Kohberg, Other' })?.brand).toBe('Kohberg');
    expect(normalizeOffProduct({ ...product, brands: undefined })?.brand).toBeUndefined();
  });

  it('prefers the Danish product name when present', () => {
    expect(normalizeOffProduct({ ...product, product_name_da: 'Fuldkornsrugbrød' })?.name).toBe('Fuldkornsrugbrød');
  });

  it('returns undefined for records too incomplete to be useful', () => {
    expect(normalizeOffProduct({ code: '123' })).toBeUndefined();
    expect(normalizeOffProduct({ product_name: 'No code' })).toBeUndefined();
  });

  it('tolerates missing/string nutrient values', () => {
    const item = normalizeOffProduct({ code: '1', product_name: 'x', nutriments: { 'energy-kcal_100g': '150', proteins_100g: 'n/a' } })!;
    expect(item.per100g.kcal).toBe(150);
    expect(item.per100g.protein).toBeUndefined();
  });
});

describe('normalizeFridaFood', () => {
  it('maps a Frida food and carries DTU attribution', () => {
    const item = normalizeFridaFood({ id: '0123', name: 'Leverpostej', kcal: 280, protein: 11, carbs: 6, fat: 23 });
    expect(item.id).toBe('frida:0123');
    expect(item.source).toBe('frida');
    expect(item.per100g).toMatchObject({ kcal: 280, protein: 11, carbs: 6, fat: 23 });
    expect(item.attribution).toContain('Technical University of Denmark');
  });
});
