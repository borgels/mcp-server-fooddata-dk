# Changelog

## 0.2.0 (2026-11-16)

HTTP transport hardening, upstream client hardening and dependency updates.

- The HTTP transport refuses to start on a non-loopback bind address, or with
  `MCP_ALLOW_ANY_ORIGIN=true`, unless `MCP_HTTP_TOKEN` is set.
  `MCP_HTTP_ALLOW_UNAUTHENTICATED=true` overrides this explicitly.
- `MCP_HTTP_TOKEN` must be at least 32 printable ASCII characters.
- `PORT`, `MCP_MAX_BODY_BYTES`, `OFF_TIMEOUT_MS` and boolean flags are
  validated at startup; invalid values stop the server instead of silently
  disabling a limit.
- Failed authentication is throttled per client address (HTTP 429 with
  `Retry-After`); valid tokens are never throttled. New variables
  `MCP_AUTH_FAILURE_LIMIT` (default 20, `0` disables) and
  `MCP_AUTH_FAILURE_WINDOW_MS` (default 60000).
- `Host` header check on loopback binds; new variable `MCP_ALLOWED_HOSTS`.
- HTTP 401 carries `WWW-Authenticate: Bearer`; invalid JSON gets HTTP 400
  (JSON-RPC parse error) instead of 500; oversized bodies get 413 before
  being read.
- New unauthenticated `GET /healthz`; graceful shutdown on SIGTERM/SIGINT.
- `/healthz` keeps its payload (`ok`, `frida`, `fridaFoods`) and now answers
  `GET`/`HEAD` only.
- Open Food Facts error responses are discarded unread, and error URLs no
  longer include the query string (search terms).
- The default Open Food Facts User-Agent carries the package version.
- Images are published only after CI passes, from `main` and `v*` tags, with
  SBOM and provenance attestations.
- The server reports the package version.
- Dependency updates (`@modelcontextprotocol/sdk` 1.32, `zod` 4.6) and
  overrides for patched transitive packages.

Upgrade notes: deployments that bind to `0.0.0.0` must set `MCP_HTTP_TOKEN`
(32+ characters) or the server exits at startup. Check that numeric variables
hold plain integers.

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
