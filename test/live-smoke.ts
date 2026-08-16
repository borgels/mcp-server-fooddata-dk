#!/usr/bin/env node
/**
 * Opt-in live smoke test against the real Open Food Facts API.
 * Not run by `npm test`. Usage: npm run smoke:live
 */
import { FridaSource } from '../src/fooddata/frida.js';
import { OffClient } from '../src/fooddata/off-client.js';

async function main(): Promise<void> {
  const off = new OffClient();
  const frida = new FridaSource();

  console.error(`Frida: ${frida.available ? `${frida.size} foods (v${frida.version})` : 'not bundled'}`);

  for (const query of ['rugbrød', 'leverpostej', 'skyr']) {
    const results = await off.search(query, { pageSize: 2 });
    console.error(`\n--- OFF search "${query}" → ${results.length} hit(s)`);
    for (const item of results) {
      console.error(`  ${item.name}${item.brand ? ` (${item.brand})` : ''} — ${item.per100g.kcal ?? '?'} kcal/100g, P${item.per100g.protein ?? '?'} C${item.per100g.carbs ?? '?'} F${item.per100g.fat ?? '?'}`);
    }
  }

  console.error('\n--- OFF barcode 5701246014718 (Kohberg Rugbrød)');
  const byBarcode = await off.getByBarcode('5701246014718');
  console.error(byBarcode ? `  ${byBarcode.name} — ${byBarcode.per100g.kcal} kcal/100g` : '  not found');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
