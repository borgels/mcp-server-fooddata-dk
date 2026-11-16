import { ConfigError } from '../config-env.js';
import { FridaSource } from '../fooddata/frida.js';
import { OffClient } from '../fooddata/off-client.js';
import { createServer as createMcpServer } from '../server.js';
import { configWarnings, getHttpConfig, type HttpConfig } from './http-helpers.js';
import { startHttpServer } from './http-server.js';

async function main(): Promise<void> {
  let config: HttpConfig;
  try {
    config = getHttpConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`Danish food data MCP HTTP server not started: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  // Shared across requests: the OFF client (and its cache) and the in-memory
  // Frida dataset. This server has no per-user state, so there is nothing to
  // bind per request. Creating the client here also validates its
  // configuration once at startup.
  let off: OffClient;
  let frida: FridaSource;
  try {
    off = new OffClient();
    frida = new FridaSource();
  } catch (error) {
    console.error(
      `Danish food data MCP HTTP server not started: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }

  for (const warning of configWarnings(config)) {
    console.error(warning);
  }

  const running = await startHttpServer(config, {
    createMcpServer: () => createMcpServer({ off, frida }),
    healthPayload: () => ({ ok: true, frida: frida.available, fridaFoods: frida.size }),
  });
  console.error(
    `Danish food data MCP HTTP server listening on http://${config.host}:${running.port} (/mcp) — Frida ${frida.available ? `loaded (${frida.size} foods)` : 'not bundled'}`,
  );

  const shutdown = (signal: string) => {
    console.error(`Received ${signal}, shutting down`);
    void running.close().then(() => process.exit(0));
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
