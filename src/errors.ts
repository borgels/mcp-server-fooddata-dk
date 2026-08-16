export class FoodDataHttpError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(input: { status: number; url: string; fallbackMessage?: string }) {
    super([`Food data request failed with HTTP ${input.status}`, input.fallbackMessage].filter(Boolean).join(' | '));
    this.name = 'FoodDataHttpError';
    this.status = input.status;
    this.url = input.url;
  }
}

export function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
