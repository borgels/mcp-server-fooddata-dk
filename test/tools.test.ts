import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { FridaSource } from '../src/fooddata/frida.js';
import { OffClient } from '../src/fooddata/off-client.js';
import { createServer } from '../src/server.js';

const frida = new FridaSource({
  dataset: { version: '5.5', foods: [{ id: '2', name: 'Leverpostej', kcal: 280, protein: 11, carbs: 6, fat: 23 }] },
});

function offReturning(payload: unknown) {
  return new OffClient({
    fetchImpl: vi.fn<typeof fetch>(async () => new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })),
  });
}

async function connect(off: OffClient, fridaSource = frida) {
  const server = createServer({ off, frida: fridaSource });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: 't', version: '0' });
  await Promise.all([server.connect(serverTransport), mcp.connect(clientTransport)]);
  return mcp;
}

function parse(result: unknown) {
  return JSON.parse(((result as { content: Array<{ text: string }> }).content)[0]?.text ?? '{}');
}

describe('fooddata tools', () => {
  it('search merges Frida and Open Food Facts, Frida first, with attribution', async () => {
    const mcp = await connect(offReturning({ hits: [{ code: '1', product_name: 'Leverpostej Stryhns', brands: ['Stryhns'], nutriments: { 'energy-kcal_100g': 280 } }] }));
    const out = parse(await mcp.callTool({ name: 'fooddata_search', arguments: { query: 'leverpostej' } }));

    expect(out.count).toBe(2);
    // Frida is authoritative for generic Danish foods, so it must rank first.
    expect(out.results[0].source).toBe('frida');
    expect(out.results[1].source).toBe('openfoodfacts');
    expect(out.notes.join(' ')).toContain('Technical University of Denmark');
    expect(out.notes.join(' ')).toContain('Open Food Facts');
  });

  it('search reports an empty result with a usable hint instead of failing', async () => {
    const mcp = await connect(offReturning({ hits: [] }));
    const out = parse(await mcp.callTool({ name: 'fooddata_search', arguments: { query: 'nonexistentfood' } }));
    expect(out.count).toBe(0);
    expect(out.notes.join(' ')).toMatch(/danishOnly=false/);
  });

  it('barcode lookup returns a fallback hint when the product is unknown', async () => {
    const mcp = await connect(offReturning({ status: 0 }));
    const out = parse(await mcp.callTool({ name: 'fooddata_get_by_barcode', arguments: { barcode: '0000000000000' } }));
    expect(out.found).toBe(false);
    expect(out.hint).toMatch(/fooddata_search/);
  });

  it('get_food resolves a frida id without touching the network', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const mcp = await connect(new OffClient({ fetchImpl: fetchMock }));
    const out = parse(await mcp.callTool({ name: 'fooddata_get_food', arguments: { id: 'frida:2' } }));
    expect(out.found).toBe(true);
    expect(out.result.name).toBe('Leverpostej');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('get_food rejects an unrecognized id format', async () => {
    const mcp = await connect(offReturning({}));
    const result = await mcp.callTool({ name: 'fooddata_get_food', arguments: { id: 'bogus:1' } });
    expect(result.isError).toBe(true);
  });

  it('sources reports Frida as unavailable when no dataset is bundled', async () => {
    const mcp = await connect(offReturning({}), new FridaSource({ path: '/nonexistent.json' }));
    const out = parse(await mcp.callTool({ name: 'fooddata_sources', arguments: {} }));
    const fridaSource = out.sources.find((s: { id: string }) => s.id === 'frida');
    expect(fridaSource.available).toBe(false);
    expect(fridaSource.note).toMatch(/FRIDA_DATA_PATH/);
  });
});
