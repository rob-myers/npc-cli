/// <reference path="./deps.d.ts"/>

/**
 * Generates:
 * - assets.json
 * - geomorphs.json
 * 
 * Usage:
 * ```sh
 * npm run assets
 * yarn assets
 * yarn assets-fast
 * ```
 */

import fs from "fs";
import path from "path";
import stringify from "json-stringify-pretty-compact";

// relative urls for sucrase-node
import { ASSETS_JSON_FILENAME, DEV_EXPRESS_WEBSOCKET_PORT, GEOMORPHS_JSON_FILENAME } from "./const";
import { hashText, info, keyedItemsToLookup, warn } from "../npc-cli/service/generic";
import { geomorphService } from "../npc-cli/service/geomorph";

import getopts from 'getopts';
const opts = getopts(process.argv, { boolean: ['all'] });

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const mediaDir = path.resolve(__dirname, "../../media");
const symbolsDir = path.resolve(mediaDir, "symbol");
const mapsDir = path.resolve(mediaDir, "map");
/** Assets metadata JSON output */
const assetsFilename = path.resolve(staticAssetsDir, ASSETS_JSON_FILENAME);
/** Geomorphs layout JSON output */
const geomorphsFilename = path.resolve(staticAssetsDir, GEOMORPHS_JSON_FILENAME);
const sendDevEventUrl = `http://localhost:${DEV_EXPRESS_WEBSOCKET_PORT}/send-dev-event`;

// 🚧 dependency graph

(function main() {
  
  const assetsJson = /** @type {Geomorph.AssetsJson} */ ({ meta: {}, symbols: {}, maps: {} });

  /** @type {Geomorph.AssetsJson | null} Previous assetsJson */
  const prevAssets = fs.existsSync(assetsFilename) ? JSON.parse(fs.readFileSync(assetsFilename).toString()) : null;
  
  const schemaChanged = !!opts.all || !prevAssets || (
    [assetsFilename, geomorphsFilename].some(x => fs.statSync(x).atimeMs > Date.now() - 2000)
  );

  let symbolFilenames = fs.readdirSync(symbolsDir).filter((x) => x.endsWith(".svg"));

  if (!prevAssets || schemaChanged) {
    info(`updating all symbols`);
  } else {// Avoid re-computing
    symbolFilenames = symbolFilenames.filter(filename => {
      const symbolKey = /** @type {Geomorph.SymbolKey} */ (filename.slice(0, -".svg".length));
      assetsJson.symbols[symbolKey] = prevAssets.symbols[symbolKey];
      assetsJson.meta[symbolKey] = prevAssets.meta[symbolKey];
      return fs.statSync(path.resolve(symbolsDir, filename)).atimeMs > Date.now() - 2000;
    });
    info(`updating symbols: ${JSON.stringify(symbolFilenames)}`);
  }

  // Main computation
  parseSymbols(assetsJson, symbolFilenames);
  parseMaps(assetsJson);
  
  info({ changedSymbolsMaps: Object.keys(assetsJson.meta).filter(key =>  assetsJson.meta[key].outputHash !== prevAssets?.meta[key]?.outputHash) });
  
  const assets = geomorphService.deserializeAssets(assetsJson);
  fs.writeFileSync(assetsFilename, stringify(assetsJson));
  
  const layout = keyedItemsToLookup(geomorphService.gmKeys.map(gmKey =>
    geomorphService.computeLayout(gmKey, assets)
  ));

  /** @type {Geomorph.Geomorphs} */
  const geomorphs = {
    mapsHash: hashText(JSON.stringify(assetsJson.maps)),
    layoutsHash: hashText(JSON.stringify(layout)),
    map: assetsJson.maps,
    layout,
  };
  fs.writeFileSync(geomorphsFilename, stringify(geomorphService.serializeGeomorphs(geomorphs)));

  fetch(sendDevEventUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "update-browser" }),
  }).catch((e) => {
    warn(`POST ${sendDevEventUrl} failed: ${e.cause.code}`);
  });
})();

/**
 * @param {Geomorph.AssetsJson} output
 */
function parseMaps({ meta, maps }) {
  const mapFilenames = fs.readdirSync(mapsDir).filter((x) => x.endsWith(".svg"));

  for (const filename of mapFilenames) {
    const filepath = path.resolve(mapsDir, filename);
    const contents = fs.readFileSync(filepath).toString();
    const mapKey = filename.slice(0, -".svg".length);
    maps[mapKey] = geomorphService.parseMap(mapKey, contents);
    meta[mapKey] = { outputHash: hashText(JSON.stringify(maps[mapKey])) };
  }
}

/**
 * @param {Geomorph.AssetsJson} output
 * @param {string[]} symbolFilenames
 */
function parseSymbols({ symbols, meta }, symbolFilenames) {
  for (const filename of symbolFilenames) {
    const filepath = path.resolve(symbolsDir, filename);
    const contents = fs.readFileSync(filepath).toString();
    const symbolKey = /** @type {Geomorph.SymbolKey} */ (filename.slice(0, -".svg".length));

    const parsed = geomorphService.parseSymbol(symbolKey, contents);
    const serialized = geomorphService.serializeSymbol(parsed);
    symbols[symbolKey] = serialized;
    meta[symbolKey] = { outputHash: hashText(JSON.stringify(serialized)) };
  }

  validateSubSymbolDimension(symbols);
}

/**
 * 
 * @param {Geomorph.AssetsJson['symbols']} symbols 
 */
function validateSubSymbolDimension(symbols) {
  Object.values(symbols).forEach(({ key: parentKey, symbols: subSymbols }) => 
    subSymbols.forEach(({ symbolKey, width, height }) => {
      const expected = { width: symbols[symbolKey].width, height: symbols[symbolKey].height };
      const observed = { width, height };
      if (expected.width !== width || expected.height !== height) {
        warn(`${parentKey}: ${symbolKey}: unexpected symbol dimension`, { expected, observed });
      }
    })
  );
}