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
import util from "util";
import getopts from 'getopts';
import stringify from "json-stringify-pretty-compact";

// relative urls for sucrase-node
import { ASSETS_JSON_FILENAME, DEV_EXPRESS_WEBSOCKET_PORT, GEOMORPHS_JSON_FILENAME, SPRITE_SHEET_JSON_FILENAME } from "./const";
import { hashText, info, keyedItemsToLookup, warn, debug, error } from "../npc-cli/service/generic";
import { geomorphService } from "../npc-cli/service/geomorph";
import { SymbolGraphClass } from "../npc-cli/graph/symbol-graph";

const opts = getopts(process.argv, { boolean: ['all'] });

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const mediaDir = path.resolve(__dirname, "../../media");
const mapsDir = path.resolve(mediaDir, "map");
const symbolsDir = path.resolve(mediaDir, "symbol");
const assetsFilepath = path.resolve(staticAssetsDir, ASSETS_JSON_FILENAME);
const geomorphsFilepath = path.resolve(staticAssetsDir, GEOMORPHS_JSON_FILENAME);
const spriteSheetFilepath = path.resolve(staticAssetsDir, SPRITE_SHEET_JSON_FILENAME);
const assetsScriptFilepath = __filename;
const geomorphServicePath = path.resolve(__dirname, '../npc-cli/service', 'geomorph.js');
const sendDevEventUrl = `http://localhost:${DEV_EXPRESS_WEBSOCKET_PORT}/send-dev-event`;

(function main() {
  
  /** @type {Geomorph.AssetsJson} */
  const assetsJson = { meta: {}, symbols: /** @type {*} */ ({}), maps: {} };

  /** @type {Geomorph.AssetsJson | null} Previous `assetsJson` */
  const prevAssets = fs.existsSync(assetsFilepath) ? JSON.parse(fs.readFileSync(assetsFilepath).toString()) : null;
  
  // Source SVGs
  let symbolFilenames = fs.readdirSync(symbolsDir).filter((x) => x.endsWith(".svg"));

  const updateAll = !!opts.all || !prevAssets || (
    [assetsScriptFilepath, geomorphServicePath].some(x => fs.statSync(x).atimeMs > Date.now() - 2000)
  );

  if (updateAll) {
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

  // Compute assets.json
  parseSymbols(assetsJson, symbolFilenames);
  parseMaps(assetsJson);
  info({ changed: Object.keys(assetsJson.meta).filter(key =>  assetsJson.meta[key].outputHash !== prevAssets?.meta[key]?.outputHash) });
  const assets = geomorphService.deserializeAssets(assetsJson);
  fs.writeFileSync(assetsFilepath, stringify(assetsJson));
  
  const symbolGraph = SymbolGraphClass.from(assetsJson.symbols);
  const symbolsStratified = symbolGraph.stratify();
  debug(util.inspect({ symbolsStratified }, false, 5))

  // Traverse stratified symbols from leaves to co-leaves,
  // creating FlatSymbols via flattenSymbol and instantiateFlatSymbol
  const flattened = /** @type {Record<Geomorph.SymbolKey, Geomorph.FlatSymbol>} */ ({});
  symbolsStratified.forEach(level => level.forEach(({ id: symbolKey }) =>
    geomorphService.flattenSymbol(assets.symbols[symbolKey], flattened)
  ));
  // debug("stateroom--036--2x4", util.inspect(flattened["stateroom--036--2x4"], false, 5));

  // Compute geomorphs.json
  const newLayouts = geomorphService.gmKeys.map(gmKey => {
    const hullKey = geomorphService.toHullKey[gmKey];
    const flatSymbol = flattened[hullKey];
    return geomorphService.createLayout(gmKey, flatSymbol, assets);
  });

  const layout = keyedItemsToLookup(newLayouts);

  /** @type {Geomorph.SpriteSheetMeta | null} */
  const currSheet = fs.existsSync(spriteSheetFilepath) ? JSON.parse(fs.readFileSync(spriteSheetFilepath).toString()) : null;
  if (currSheet === null) {
    warn(`sprite-sheet not found: geomorphs.sheet will be empty`);
  }

  /** @type {Geomorph.Geomorphs} */
  const geomorphs = {
    // 🔔 prefer `stringify` to `JSON.stringify` because corresponds to file contents
    mapsHash: hashText(stringify(assetsJson.maps)),
    layoutsHash: hashText(stringify(layout)), // don't bother serializing
    sheetsHash: currSheet ? hashText(stringify(currSheet)) : 0,
    map: assetsJson.maps,
    layout,
    sheet: currSheet ?? { obstacle: {}, obstaclesHeight: 0, obstaclesWidth: 0 },
  };
  fs.writeFileSync(geomorphsFilepath, stringify(geomorphService.serializeGeomorphs(geomorphs)));

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
    meta[mapKey] = { outputHash: hashText(stringify(maps[mapKey])) };
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
    // console.log({ symbolKey }, typeof serialized)
    meta[symbolKey] = { outputHash: hashText(stringify(serialized)) };
  }

  validateSubSymbolDimension(symbols);
}

/**
 * @param {Geomorph.AssetsJson['symbols']} symbols 
 */
function validateSubSymbolDimension(symbols) {
  Object.values(symbols).forEach(({ key: parentKey, symbols: subSymbols }) => {
    subSymbols.forEach(({ symbolKey, width, height }) => {
      try {
        const expected = { width: symbols[symbolKey].width, height: symbols[symbolKey].height };
        const observed = { width, height };
        if (expected.width !== width || expected.height !== height) {
          warn(`${parentKey}: ${symbolKey}: unexpected symbol dimension`, { expected, observed });
        }
      } catch (e) {
        debug(`parent ${parentKey}: sub-symbol: ${symbolKey}`);
        throw e;
      }
    })
  });
}
