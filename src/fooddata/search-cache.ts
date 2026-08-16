/**
 * Open Food Facts rate-limits reads to 15 req/min and searches to 10 req/min
 * per IP, so caching is a correctness requirement here, not an optimization.
 * Food data is not user-specific, so one cache is safely shared by everyone.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class SearchCache<T = unknown> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(
    private readonly ttlMs = 60 * 60 * 1000,
    private readonly maxEntries = 500,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    // Refresh recency so eviction approximates LRU.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) {
        this.entries.delete(oldest);
      }
    }
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  static keyFor(kind: string, params: Record<string, unknown>): string {
    return `${kind}:${JSON.stringify(params, Object.keys(params).sort())}`;
  }
}
