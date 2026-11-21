# mcp-server-fooddata-dk

MCP server for **Danish food and nutrition data**. Combines
[Open Food Facts](https://world.openfoodfacts.org) (Danish branded/supermarket
products, barcode lookup) with the
[DTU Frida](https://frida.fooddata.dk) food composition database (generic Danish
foods like rugbrød, leverpostej, frikadeller).

Read-only, no user accounts, no credentials. Built as a companion to
`mcp-server-fatsecret`: FatSecret's free tier only carries US food data, so this
server supplies the real Danish numbers and the calling model logs the meal
there with the serving scaled to match.

This is an independent, unofficial project. It is not developed, endorsed or supported by Open Food Facts or DTU.

## Why two sources

They cover opposite gaps, and neither is sufficient alone:

| Source | Strong at | Weak at |
|---|---|---|
| **Open Food Facts** | Branded supermarket products, barcode scanning, ~9,400 Danish-tagged items | Generic/home-cooked foods; barcode coverage is patchy |
| **DTU Frida** | Generic and composite Danish foods, authoritative composition data | No branded products, no barcodes |

`fooddata_search` queries both and returns Frida first, since for a generic
Danish food DTU's figures are authoritative while OFF's nearest equivalent is a
branded approximation.

## Tools

| Tool | Purpose |
|---|---|
| `fooddata_search_capabilities` | Discovery — find the right tool |
| `fooddata_search` | Keyword search across both sources; per-100g macros with source attribution |
| `fooddata_get_by_barcode` | Open Food Facts barcode (EAN) lookup |
| `fooddata_get_food` | Full detail for one food by id (`off:<barcode>` or `frida:<id>`) |
| `fooddata_sources` | Which sources are available and their required attribution |

All values are **per 100 g/ml** — the only basis both sources reliably share.
The caller scales from there.

## Setup

No credentials needed. Open Food Facts requires only a descriptive
`User-Agent`, which defaults to this project's name and URL; set
`OFF_USER_AGENT` to include a real contact address if you run it at any volume.

```json
{
  "mcpServers": {
    "fooddata-dk": {
      "command": "npx",
      "args": ["-y", "mcp-server-fooddata-dk"],
      "env": { "OFF_USER_AGENT": "yourapp/1.0 (you@example.com)" }
    }
  }
}
```

### Adding the Frida dataset (optional)

Frida has **no public API** — its site is a single-page app over an
undocumented backend, which this project deliberately does not
reverse-engineer. The dataset is instead downloaded by hand and converted:

```
npm run frida:convert -- frida-export.csv ./data/frida.json --version 5.5
```

See [`data/README.md`](data/README.md). The server runs fine without it,
serving Open Food Facts only and reporting Frida as unavailable.

## Rate limits and caching

Open Food Facts allows **15 requests/min for product reads and 10/min for
searches**, per IP. Responses are cached in memory (1 h TTL, 500 entries),
including barcode *misses* — a barcode absent from OFF won't appear a minute
later. A 429 is reported as a clear rate-limit message rather than a bare
status code, and OFF's habit of serving an HTML error page during outages is
detected and reported as such.

## Attribution

Both licences require credit, and the server attaches it to every result:

- **Open Food Facts** — Open Database License (ODbL).
- **DTU Frida** — CC BY 4.0. *Frida Food Data (https://frida.fooddata.dk),
  National Food Institute, Technical University of Denmark.* The package
  bundles a JSON conversion of Frida 5.5 in `data/frida.json`; see
  [`data/README.md`](data/README.md).

## Optional HTTP server

`npm run dev:http` (and the published Docker image) serve `/mcp` over
Streamable HTTP, gated by `MCP_HTTP_TOKEN` (compared in constant time), plus an
unauthenticated `GET /healthz` endpoint reporting whether the Frida dataset
loaded. There is no per-user state and no identity forwarding.

| Variable | Default | Meaning |
|---|---|---|
| `MCP_HTTP_HOST` (or `HOST`) | `127.0.0.1` | Bind address. |
| `PORT` | `3000` | Listen port (1-65535). |
| `MCP_HTTP_TOKEN` | unset | Bearer token required on `/mcp`; at least 32 printable ASCII characters. Required when binding to a non-loopback address or with `MCP_ALLOW_ANY_ORIGIN=true`. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `MCP_HTTP_ALLOW_UNAUTHENTICATED` | `false` | Start without a token on a non-loopback bind anyway (only when access is restricted by other means). |
| `MCP_ALLOWED_ORIGINS` | localhost origins | Comma-separated exact `Origin` values allowed. Requests without `Origin` (server-to-server) are allowed. |
| `MCP_ALLOW_ANY_ORIGIN` | `false` | Allow any `Origin` (requires a token). |
| `MCP_ALLOWED_HOSTS` | see meaning | Comma-separated host names accepted in the `Host` header. By default a loopback bind only accepts localhost names and its bind address; other binds do not check `Host`. |
| `MCP_MAX_BODY_BYTES` | `10485760` | Maximum request body size. |
| `MCP_AUTH_FAILURE_LIMIT` | `20` | Failed authentication attempts per client address and window before further failures get HTTP 429; `0` disables. Requests with a valid token are never throttled. |
| `MCP_AUTH_FAILURE_WINDOW_MS` | `60000` | Window for the limit above. |

Invalid numeric or boolean values (including `OFF_TIMEOUT_MS`, 1-600000,
default 15000) stop the server at startup with a message naming the variable.

## Security model

- The server holds no upstream credentials; all callers share its outbound
  IP address and therefore Open Food Facts' per-IP rate limits.
- `MCP_HTTP_TOKEN` is a single shared secret that authenticates callers of
  the HTTP endpoint; it does not identify individual users. Per-user
  authentication and authorization belong in an identity-aware gateway or
  proxy in front of this server.
- Every tool is read-only over public reference data. Search terms and
  barcodes are sent to Open Food Facts.
- The HTTP server does not terminate TLS. Run it on loopback or a private
  network, behind a TLS-terminating proxy when traffic leaves the host.

## Verification

```
npm run typecheck && npm test && npm run build
npm run smoke:live   # hits the real Open Food Facts API
```

## License

The code is source-available under the [Functional Source License, Version 1.1, ALv2 Future License](LICENSE) (FSL-1.1-ALv2).

In plain words:

- **Allowed:** reading the code, running it, changing it, using it inside your own organisation (also commercially), using it for non-commercial education and research, and contributing changes back.
- **Not allowed:** making it, or something built from it, available to others as a commercial product or service that competes with it, for example a hosted service with the same functionality.
- **Becomes Apache-2.0:** each version is also licensed under the Apache License 2.0 from two years after it is released.
- **Earlier versions:** versions released before 0.3.0 were licensed under Apache-2.0 and remain so.

The terms in [LICENSE](LICENSE) are what apply; this summary does not replace them. See also [NOTICE](NOTICE).
