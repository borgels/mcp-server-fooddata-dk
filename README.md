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

This is an independent, unofficial project, not affiliated with Open Food Facts
or DTU.

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
- **DTU Frida** — *Frida Food Data (https://frida.fooddata.dk), National Food
  Institute, Technical University of Denmark.*

## Optional HTTP server

`npm run dev:http` (and the published Docker image) serve `/mcp` over
Streamable HTTP, gated by `MCP_HTTP_TOKEN`, plus a `/healthz` endpoint
reporting whether the Frida dataset loaded. There is no per-user state, so
unlike the personal connectors this one needs no identity forwarding.

## Verification

```
npm run typecheck && npm test && npm run build
npm run smoke:live   # hits the real Open Food Facts API
```

## License

Apache-2.0
