import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultDatasetPath, FridaSource } from '../src/fooddata/frida.js';

const dataset = {
  version: '5.5',
  foods: [
    { id: '1', name: 'Rugbrød, fuldkorn', kcal: 219, protein: 6.4, carbs: 39, fat: 1.7 },
    { id: '2', name: 'Leverpostej', kcal: 280, protein: 11, carbs: 6, fat: 23 },
    { id: '3', name: 'Frikadelle, svinekød', kcal: 250, protein: 17, carbs: 8, fat: 16 },
  ],
};

describe('FridaSource', () => {
  const frida = new FridaSource({ dataset });

  it('reports availability and size', () => {
    expect(frida.available).toBe(true);
    expect(frida.size).toBe(3);
    expect(frida.version).toBe('5.5');
  });

  it('finds Danish generic foods by substring, best match first', () => {
    expect(frida.search('leverpostej')[0]?.name).toBe('Leverpostej');
    expect(frida.search('rugbrød')[0]?.name).toBe('Rugbrød, fuldkorn');
  });

  it('returns nothing for an unmatched query rather than guessing', () => {
    expect(frida.search('sushi')).toEqual([]);
  });

  it('looks up by prefixed id', () => {
    expect(frida.getById('frida:2')?.name).toBe('Leverpostej');
    expect(frida.getById('frida:999')).toBeUndefined();
  });

  it('degrades gracefully when no dataset is bundled', () => {
    const empty = new FridaSource({ path: '/nonexistent/frida.json' });
    expect(empty.available).toBe(false);
    expect(empty.size).toBe(0);
    expect(empty.search('rugbrød')).toEqual([]);
  });
});

describe('defaultDatasetPath', () => {
  it('resolves data/frida.json next to dist/, independent of the working directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'frida-'));
    try {
      mkdirSync(join(root, 'dist'));
      mkdirSync(join(root, 'data'));
      writeFileSync(join(root, 'data', 'frida.json'), JSON.stringify(dataset));
      const path = defaultDatasetPath(pathToFileURL(join(root, 'dist', 'stdio.js')).href);
      expect(path).toBe(join(root, 'data', 'frida.json'));
      expect(new FridaSource({ path }).size).toBe(3);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('finds the bundled dataset from the source tree', () => {
    expect(new FridaSource({ path: defaultDatasetPath() }).available).toBe(true);
  });
});
