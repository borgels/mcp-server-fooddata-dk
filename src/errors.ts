export class FoodDataHttpError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(input: { status: number; url: string; fallbackMessage?: string }) {
    super([`Food data request failed with HTTP ${input.status}`, input.fallbackMessage].filter(Boolean).join(' | '));
    this.name = 'FoodDataHttpError';
    this.status = input.status;
    // Origin and path only: the query string carries the user's search terms.
    this.url = urlWithoutQuery(input.url);
  }
}

function urlWithoutQuery(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return '[invalid URL]';
  }
}

export function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
