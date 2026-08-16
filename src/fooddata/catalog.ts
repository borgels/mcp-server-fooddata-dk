export interface Capability {
  id: string;
  title: string;
  description: string;
  keywords: string[];
}

export const READ_ANNOTATIONS = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;

export const CAPABILITIES: Capability[] = [
  {
    id: 'fooddata_search',
    title: 'Search Danish food data',
    description:
      'Keyword search across Open Food Facts (Danish branded/supermarket products) and DTU Frida (generic Danish foods). Returns per-100g macros with source attribution.',
    keywords: ['search', 'food', 'mad', 'nutrition', 'næringsindhold', 'macros', 'kalorier', 'danish'],
  },
  {
    id: 'fooddata_get_by_barcode',
    title: 'Look up a product by barcode',
    description: 'Open Food Facts barcode (EAN) lookup for a packaged product.',
    keywords: ['barcode', 'ean', 'stregkode', 'scan', 'product'],
  },
  {
    id: 'fooddata_get_food',
    title: 'Get one food by id',
    description: 'Full detail for a single food previously returned by fooddata_search, by its id (off:<barcode> or frida:<id>).',
    keywords: ['detail', 'get', 'food', 'nutrition'],
  },
  {
    id: 'fooddata_sources',
    title: 'Data source status',
    description: 'Which data sources are available (Frida is optional) and their required attribution.',
    keywords: ['sources', 'attribution', 'status', 'frida', 'openfoodfacts'],
  },
];

export function searchCapabilities(query: string, limit = 20): Capability[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return CAPABILITIES.slice(0, limit);
  }
  const terms = q.split(/\s+/).filter(Boolean);
  return CAPABILITIES.map(c => ({
    c,
    score: terms.reduce((s, t) => s + ([c.id, c.title, c.description, ...c.keywords].join(' ').toLowerCase().includes(t) ? 1 : 0), 0),
  }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.c);
}
