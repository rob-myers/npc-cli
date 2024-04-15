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
import { worldScale } from "../npc-cli/service/const";
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
  const prev = fs.existsSync(assetsFilename)
    ? /** @type {Geomorph.AssetsJson} */ (JSON.parse(fs.readFileSync(assetsFilename).toString()))
    : null;
  
  const schemaChanged = !!opts.all || (prev
    ? [assetsFilename, geomorphsFilename].some(x => fs.statSync(x).atimeMs > Date.now() - 2000)
    : true);

  // main computation
  const { symbols, meta: symbolsMeta } = parseSymbols(prev, schemaChanged);
  const { maps, meta: mapsMeta } = parseMaps(prev);
  const meta = { ...symbolsMeta, ...mapsMeta };
  
  info({
    changedSymbols: Object.keys(symbolsMeta).filter(key => symbolsMeta[key].outputHash !== prev?.meta[key]?.outputHash),
    changedMaps: Object.keys(mapsMeta).filter(key => mapsMeta[key].outputHash !== prev?.meta[key]?.outputHash),
  });
  
  /** @type {Geomorph.AssetsJson} */
  const assetsJson = { meta, symbols, maps };
  const assets = geomorphService.deserializeAssets(assetsJson);
  fs.writeFileSync(assetsFilename, stringify(assetsJson));
  
  const layout = keyedItemsToLookup(geomorphService.gmKeys.map(gmKey =>
    geomorphService.computeLayout(gmKey, assets)
  ));

  /** @type {Geomorph.Geomorphs} */
  const geomorphs = {
    mapsHash: hashText(JSON.stringify(maps)),
    layoutsHash: hashText(JSON.stringify(layout)),
    map: maps,
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
 * @param {null | Geomorph.AssetsJson} _prev
 * @returns {Pick<Geomorph.AssetsJson, 'maps' | 'meta'>}
 */
function parseMaps(_prev) {
  const meta = /** @type {Geomorph.AssetsJson['meta']} */ ({});
  const maps = /** @type {Geomorph.AssetsJson['maps']} */ ({});
  const mapFilenames = fs.readdirSync(mapsDir).filter((x) => x.endsWith(".svg"));

  for (const filename of mapFilenames) {
    const filepath = path.resolve(mapsDir, filename);
    const contents = fs.readFileSync(filepath).toString();
    const mapKey = filename.slice(0, -".svg".length);
    maps[mapKey] = geomorphService.parseMap(mapKey, contents);
    meta[mapKey] = { outputHash: hashText(JSON.stringify(maps[mapKey])) };
  }

  return { maps, meta };
}

/**
 * @param {null | Geomorph.AssetsJson} prev
 * @param {boolean} schemaChanged
 * @returns {Pick<Geomorph.AssetsJson, 'symbols' | 'meta'>}
 */
function parseSymbols(prev, schemaChanged) {
  const meta = /** @type {Geomorph.AssetsJson['meta']} */ ({});
  const symbols = /** @type {Geomorph.AssetsJson['symbols']} */ ({});
  let symbolFilenames = fs.readdirSync(symbolsDir).filter((x) => x.endsWith(".svg"));

  if (prev && !schemaChanged) {// Avoid re-computation
    symbolFilenames = symbolFilenames.filter(filename => {
      const symbolKey = /** @type {Geomorph.SymbolKey} */ (filename.slice(0, -".svg".length));
      [symbols[symbolKey], meta[symbolKey]] = [prev.symbols[symbolKey], prev.meta[symbolKey]];
      return fs.statSync(path.resolve(symbolsDir, filename)).atimeMs > Date.now() - 2000;
    });
    info(`updating symbols: ${JSON.stringify(symbolFilenames)}`);
  } else {
    info(`updating all symbols`);
  }

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

  return { symbols, meta };
}

/**
 * 
 * @param {Geomorph.AssetsJson['symbols']} symbols 
 */
function validateSubSymbolDimension(symbols) {
  Object.values(symbols).forEach(({ key: parentKey, symbols: subSymbols }) => {
    subSymbols.forEach(({ symbolKey, width, height }) => {
      const expected = { width: symbols[symbolKey].width, height: symbols[symbolKey].height };
      if (expected.width !== width || expected.height !== height) {
        warn(`${parentKey}: ${symbolKey}: unexpected symbol dimension`, { expected, observed: { width, height} });
      }
    });
  });
}