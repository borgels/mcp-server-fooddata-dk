import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FridaSource } from './fooddata/frida.js';
import { OffClient, type OffClientOptions } from './fooddata/off-client.js';
import { registerFoodDataTools } from './tools/fooddata.js';
import { PACKAGE_VERSION } from './version.js';

export interface CreateServerOptions {
  off?: OffClient;
  offOptions?: OffClientOptions;
  frida?: FridaSource;
}

export function createServer(options: CreateServerOptions = {}): McpServer {
  const server = new McpServer({ name: 'fooddata-dk', version: PACKAGE_VERSION });
  const off = options.off ?? new OffClient(options.offOptions);
  const frida = options.frida ?? new FridaSource();
  registerFoodDataTools(server, off, frida);
  return server;
}
