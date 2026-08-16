# Changelog

## 0.1.0

Initial release.

- Open Food Facts integration: keyword search (Denmark-scoped by default, can
  be widened) and barcode lookup, with a descriptive User-Agent, in-memory
  caching to respect OFF's 15/min and 10/min rate limits, and clear handling of
  429s and OFF's HTML outage pages.
- Optional DTU Frida dataset for generic Danish foods, bundled as converted
  JSON with a dependency-free CSV converter (`npm run frida:convert`). The
  server degrades gracefully to Open Food Facts only when it isn't present.
- Unified per-100g result shape across both sources, with required licence
  attribution attached to every result.
- Read-only: no credentials, no user identity, no write path.
