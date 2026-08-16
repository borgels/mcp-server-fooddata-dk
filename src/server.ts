import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FridaSource } from './fooddata/frida.js';
import { OffClient, type OffClientOptions } from './fooddata/off-client.js';
import { registerFoodDataTools } from './tools/fooddata.js';

export interface CreateServerOptions {
  off?: OffClient;
  offOptions?: OffClientOptions;
  frida?: FridaSource;
}

export function createServer(options: CreateServerOptions = {}): McpServer {
  const server = new McpServer({ name: 'fooddata-dk', version: '0.1.0' });
  const off = options.off ?? new OffClient(options.offOptions);
  const frida = options.frida ?? new FridaSource();
  registerFoodDataTools(server, off, frida);
  return server;
}
