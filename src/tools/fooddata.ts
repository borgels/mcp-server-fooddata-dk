import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { CAPABILITIES, READ_ANNOTATIONS, searchCapabilities } from '../fooddata/catalog.js';
import type { FridaSource } from '../fooddata/frida.js';
import { FRIDA_ATTRIBUTION, OFF_ATTRIBUTION, type FoodItem } from '../fooddata/normalize.js';
import type { OffClient } from '../fooddata/off-client.js';

/**
 * All tools here are read-only lookups over public data — no user identity, no
 * tokens, no write policy. Deliberately no natural-language meal parsing: the
 * calling model already does that better than a hand-rolled parser would.
 */
export function registerFoodDataTools(server: McpServer, off: OffClient, frida: FridaSource): void {
  server.registerTool(
    'fooddata_search_capabilities',
    {
      title: 'Search Food Data Capabilities',
      description: 'Find the right food-data tool. Use first if unsure what is available.',
      inputSchema: { query: z.string().trim().default(''), limit: z.number().int().min(1).max(50).default(20) },
      annotations: READ_ANNOTATIONS,
    },
    async input => json(searchCapabilities(input.query, input.limit)),
  );

  server.registerTool(
    'fooddata_search',
    {
      title: 'Search Danish Food Data',
      description:
        'Search Danish food/nutrition data by keyword across Open Food Facts (branded/supermarket products) and DTU Frida (generic Danish foods like rugbrød or leverpostej). Returns per-100g calories and macros with source attribution. Use this to get real Danish nutrition values before logging a meal elsewhere.',
      inputSchema: {
        query: z.string().min(1).describe('Food name, Danish or English, e.g. "rugbrød" or "leverpostej".'),
        limit: z.number().int().min(1).max(25).default(10),
        danishOnly: z
          .boolean()
          .default(true)
          .describe('Restrict Open Food Facts results to products tagged as sold in Denmark. Set false to widen if a search returns nothing.'),
      },
      annotations: READ_ANNOTATIONS,
    },
    async input => {
      // Frida first: for generic Danish foods it's the authoritative source,
      // whereas OFF's equivalents are branded approximations.
      const fridaHits = frida.search(input.query, input.limit);
      const remaining = Math.max(0, input.limit - fridaHits.length);
      const offHits = remaining > 0 ? await off.search(input.query, { pageSize: remaining, danishOnly: input.danishOnly }) : [];
      const results = [...fridaHits, ...offHits];

      return json({
        query: input.query,
        count: results.length,
        results,
        notes: buildNotes(results, frida),
      });
    },
  );

  server.registerTool(
    'fooddata_get_by_barcode',
    {
      title: 'Look Up Food by Barcode',
      description: 'Look up a packaged product by its barcode (EAN) in Open Food Facts. Danish barcode coverage is good but incomplete — if nothing is found, fall back to fooddata_search by name.',
      inputSchema: { barcode: z.string().min(6).regex(/^\d+$/, 'digits only') },
      annotations: READ_ANNOTATIONS,
    },
    async input => {
      const item = await off.getByBarcode(input.barcode);
      if (!item) {
        return json({
          found: false,
          barcode: input.barcode,
          hint: 'Not in Open Food Facts. Try fooddata_search with the product name instead.',
        });
      }
      return json({ found: true, result: item, attribution: OFF_ATTRIBUTION });
    },
  );

  server.registerTool(
    'fooddata_get_food',
    {
      title: 'Get One Food by Id',
      description: 'Full detail for a single food by the id returned from fooddata_search ("off:<barcode>" or "frida:<id>").',
      inputSchema: { id: z.string().min(1) },
      annotations: READ_ANNOTATIONS,
    },
    async input => {
      if (input.id.startsWith('frida:')) {
        const item = frida.getById(input.id);
        return item ? json({ found: true, result: item }) : json({ found: false, id: input.id });
      }
      if (input.id.startsWith('off:')) {
        const item = await off.getByBarcode(input.id.slice('off:'.length));
        return item ? json({ found: true, result: item }) : json({ found: false, id: input.id });
      }
      throw new Error(`Unrecognized food id "${input.id}" — expected "off:<barcode>" or "frida:<id>".`);
    },
  );

  server.registerTool(
    'fooddata_sources',
    {
      title: 'Food Data Sources',
      description: 'Which data sources this server has available, and the attribution their licences require.',
      inputSchema: {},
      annotations: READ_ANNOTATIONS,
    },
    async () =>
      json({
        sources: [
          { id: 'openfoodfacts', available: true, coverage: 'Danish branded/supermarket products, barcode lookup', attribution: OFF_ATTRIBUTION },
          {
            id: 'frida',
            available: frida.available,
            version: frida.version,
            foods: frida.size,
            coverage: 'Generic/composite Danish foods (rugbrød, leverpostej, frikadeller)',
            attribution: FRIDA_ATTRIBUTION,
            ...(frida.available ? {} : { note: 'Frida dataset not bundled — set FRIDA_DATA_PATH or add data/frida.json. Open Food Facts still works.' }),
          },
        ],
        capabilities: CAPABILITIES.map(c => c.id),
      }),
  );
}

function buildNotes(results: FoodItem[], frida: FridaSource): string[] {
  const notes: string[] = [];
  if (results.some(r => r.source === 'openfoodfacts')) notes.push(OFF_ATTRIBUTION);
  if (results.some(r => r.source === 'frida')) notes.push(FRIDA_ATTRIBUTION);
  if (!frida.available) {
    notes.push('Frida dataset not loaded — generic Danish foods may be missing; results are Open Food Facts only.');
  }
  if (results.length === 0) {
    notes.push('No matches. Try a different spelling, the English name, or danishOnly=false to include untagged/imported products.');
  }
  return notes;
}

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}
