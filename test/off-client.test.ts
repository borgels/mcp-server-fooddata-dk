import { describe, expect, it, vi } from 'vitest';
import { OffClient } from '../src/fooddata/off-client.js';
import { FoodDataHttpError } from '../src/errors.js';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

const PRODUCT = {
  status: 1,
  product: {
    code: '5701246014718',
    product_name: 'Rugbrød',
    brands: 'Kohberg',
    nutriments: { 'energy-kcal_100g': 205, proteins_100g: 5.7 },
  },
};

describe('OffClient', () => {
  it('sends the required descriptive User-Agent', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(PRODUCT));
    const client = new OffClient({ userAgent: 'test-agent/1.0 (a@b.c)', fetchImpl: fetchMock });
    await client.getByBarcode('5701246014718');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('test-agent/1.0 (a@b.c)');
  });

  it('returns a normalized item for a known barcode', async () => {
    const client = new OffClient({ fetchImpl: vi.fn<typeof fetch>(async () => jsonResponse(PRODUCT)) });
    const item = await client.getByBarcode('5701246014718');
    expect(item?.name).toBe('Rugbrød');
    expect(item?.per100g.kcal).toBe(205);
  });

  it('treats an unknown barcode as a normal miss, not an error', async () => {
    const client = new OffClient({ fetchImpl: vi.fn<typeof fetch>(async () => jsonResponse({ status: 0, status_verbose: 'product not found' })) });
    await expect(client.getByBarcode('0000000000000')).resolves.toBeUndefined();
  });

  it('caches barcode hits AND misses so a repeat lookup costs no request', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ status: 0 }));
    const client = new OffClient({ fetchImpl: fetchMock });
    await client.getByBarcode('123456');
    await client.getByBarcode('123456');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('scopes search to Denmark by default, and can widen', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ hits: [] }));
    const client = new OffClient({ fetchImpl: fetchMock });

    await client.search('rugbrød');
    expect(decodeURIComponent(String(fetchMock.mock.calls[0]?.[0]))).toContain('countries_tags:"en:denmark"');

    await client.search('rugbrød', { danishOnly: false });
    expect(decodeURIComponent(String(fetchMock.mock.calls[1]?.[0]))).not.toContain('en:denmark');
  });

  it('maps search hits through normalization and drops unusable records', async () => {
    const client = new OffClient({
      fetchImpl: vi.fn<typeof fetch>(async () =>
        jsonResponse({
          hits: [
            { code: '1', product_name: 'Leverpostej', brands: ['Stryhns'], nutriments: { 'energy-kcal_100g': 280 } },
            { code: '2' }, // no name — must be dropped rather than surfaced as a blank food
          ],
        }),
      ),
    });
    const results = await client.search('leverpostej');
    expect(results).toHaveLength(1);
    expect(results[0]?.brand).toBe('Stryhns');
  });

  it('explains a 429 rather than surfacing a bare status code', async () => {
    const client = new OffClient({ fetchImpl: vi.fn<typeof fetch>(async () => new Response('rate limited', { status: 429 })) });
    await expect(client.getByBarcode('1')).rejects.toThrow(/rate limit/i);
  });

  it('reports OFF serving an HTML error page (it does this during outages) as a clear error', async () => {
    const client = new OffClient({
      fetchImpl: vi.fn<typeof fetch>(async () => new Response('<html>Page temporarily unavailable</html>', { status: 200, headers: { 'content-type': 'text/html' } })),
    });
    await expect(client.getByBarcode('1')).rejects.toBeInstanceOf(FoodDataHttpError);
  });
});
