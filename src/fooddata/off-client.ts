import { FoodDataHttpError } from '../errors.js';
import { normalizeOffProduct, type FoodItem, type OffProduct } from './normalize.js';
import { SearchCache } from './search-cache.js';

export interface OffClientOptions {
  userAgent?: string;
  productBaseUrl?: string;
  searchBaseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  cache?: SearchCache<unknown>;
}

const FIELDS = 'code,product_name,product_name_da,brands,serving_size,countries_tags,nutriments';

/**
 * Open Food Facts client.
 *
 * Two hosts on purpose: barcode lookups go to the classic /api/v2 host, while
 * keyword search uses search.openfoodfacts.org ("search-a-licious"), which is
 * faster and returns exact result counts. A descriptive User-Agent is
 * mandatory per OFF's API terms.
 */
export class OffClient {
  private readonly userAgent: string;
  private readonly productBaseUrl: string;
  private readonly searchBaseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly cache: SearchCache<unknown>;

  constructor(options: OffClientOptions = {}) {
    this.userAgent =
      options.userAgent ??
      process.env.OFF_USER_AGENT ??
      'mcp-server-fooddata-dk/0.1.0 (https://github.com/borgels/mcp-server-fooddata-dk)';
    this.productBaseUrl = options.productBaseUrl ?? process.env.OFF_PRODUCT_BASE_URL ?? 'https://world.openfoodfacts.org';
    this.searchBaseUrl = options.searchBaseUrl ?? process.env.OFF_SEARCH_BASE_URL ?? 'https://search.openfoodfacts.org';
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? Number(process.env.OFF_TIMEOUT_MS ?? 15_000);
    this.cache = options.cache ?? new SearchCache();
  }

  /** Barcode lookup. Returns undefined when OFF simply has no such product (a normal outcome, not an error). */
  async getByBarcode(barcode: string): Promise<FoodItem | undefined> {
    const key = SearchCache.keyFor('barcode', { barcode });
    const cached = this.cache.get(key) as FoodItem | undefined | null;
    if (cached !== undefined) {
      return cached ?? undefined;
    }

    const url = `${this.productBaseUrl}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;
    const body = await this.getJson<{ status?: number; product?: OffProduct }>(url);
    const item = body.status === 1 && body.product ? normalizeOffProduct(body.product) : undefined;
    // Cache misses too — a barcode that isn't in OFF won't appear a minute later.
    this.cache.set(key, item ?? null);
    return item;
  }

  /**
   * Keyword search. `danishOnly` restricts to products tagged with Denmark,
   * which is usually what you want here but excludes imported goods that
   * simply lack the tag — callers can widen if a search comes back empty.
   */
  async search(query: string, options: { pageSize?: number; danishOnly?: boolean } = {}): Promise<FoodItem[]> {
    const pageSize = options.pageSize ?? 10;
    const danishOnly = options.danishOnly ?? true;
    const key = SearchCache.keyFor('search', { query, pageSize, danishOnly });
    const cached = this.cache.get(key) as FoodItem[] | undefined;
    if (cached) {
      return cached;
    }

    const url = new URL('/search', this.searchBaseUrl);
    url.searchParams.set('q', danishOnly ? `countries_tags:"en:denmark" ${query}` : query);
    url.searchParams.set('page_size', String(pageSize));
    url.searchParams.set('fields', FIELDS);

    const body = await this.getJson<{ hits?: OffProduct[] }>(url.toString());
    const items = (body.hits ?? []).map(normalizeOffProduct).filter((i): i is FoodItem => i !== undefined);
    this.cache.set(key, items);
    return items;
  }

  private async getJson<T>(url: string): Promise<T> {
    const res = await this.fetchImpl(url, {
      headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      throw new FoodDataHttpError({
        status: res.status,
        url,
        fallbackMessage:
          res.status === 429
            ? 'Open Food Facts rate limit hit (15 req/min for products, 10 req/min for search). Try again shortly.'
            : 'Open Food Facts request failed.',
      });
    }
    const json = (await res.json().catch(() => null)) as T | null;
    if (json === null) {
      throw new FoodDataHttpError({ status: res.status, url, fallbackMessage: 'Open Food Facts returned a non-JSON response (it serves an HTML error page during outages).' });
    }
    return json;
  }
}
