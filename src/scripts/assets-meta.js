/// <reference path="./deps.d.ts"/>

/**
 * Usage:
 * ```sh
 * npm run assets-meta
 * yarn assets-meta
 * ```
 */

import fs from "fs";
import path from "path";
import stringify from "json-stringify-pretty-compact";

// relative urls for sucrase-node
import { ASSETS_META_JSON_FILENAME, DEV_EXPRESS_WEBSOCKET_PORT } from "./const";
import { hashText, info, warn } from "../npc-cli/service/generic";
import { geomorphService } from "../npc-cli/service/geomorph";

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const mediaDir = path.resolve(__dirname, "../../media");
const symbolsDir = path.resolve(mediaDir, "symbol");
const mapsDir = path.resolve(mediaDir, "map");
const outputFilename = path.resolve(staticAssetsDir, ASSETS_META_JSON_FILENAME);
const sendDevEventUrl = `http://localhost:${DEV_EXPRESS_WEBSOCKET_PORT}/send-dev-event`;

(function main() {
  const prev = fs.existsSync(outputFilename)
    ? /** @type {Geomorph.AssetsJson} */ (JSON.parse(fs.readFileSync(outputFilename).toString()))
    : null;

  const lastModified = Date.now();

  const { symbols, meta: symbolsMeta } = parseSymbols(prev, lastModified);
  const { maps, meta: mapsMeta } = parseMaps(prev, lastModified);
  
  const changedMaps = Object.keys(mapsMeta).filter(key => mapsMeta[key].contentHash !== prev?.meta[key].contentHash);
  const changedSymbols = Object.keys(symbolsMeta).filter(key => symbolsMeta[key].outputHash !== prev?.meta[key]?.outputHash);
  info({ changedSymbols, changedMaps });
  
  let meta = { ...symbolsMeta, ...mapsMeta };
  meta = { global: {
    lastModified: Math.max(...Object.values(meta).map(x => x.lastModified)),
    browserHash: hashText(geomorphService.computeLayoutInBrowser.toString()),
  }, ...meta };

  // detect geomorph layout update
  geomorphService.gmKeys.forEach(gmKey => {
    const { hullKey } = geomorphService.gmKeyToKeys(gmKey);
    const subKeys = symbols[hullKey].symbols.map(x => x.symbolKey);
    if (!meta[hullKey]) {
      return warn(`${hullKey}: hull symbol not found`);
    } else if ([hullKey, ...subKeys].some(key => prev?.meta[key].outputHash !== meta[key].outputHash)) {
      meta[gmKey] = { lastModified }; // updated
    } else { // not-updated or first-time-added
      meta[gmKey] = { lastModified: prev?.meta[gmKey]?.lastModified ?? lastModified };
    }
  });

  /** @type {Geomorph.AssetsJson} */
  const output = { meta, symbols, maps };
  fs.writeFileSync(outputFilename, stringify(output));

  fetch(sendDevEventUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "update-browser" }),
  }).catch((e) => {
    warn(`POST ${sendDevEventUrl} failed: ${e.cause.code}`);
  });
})();

/**
 * @param {null | Geomorph.AssetsJson} prev
 * @param {number} nextModified
 * @returns {Pick<Geomorph.AssetsJson, 'maps' | 'meta'>}
 */
function parseMaps(prev, nextModified) {
  const meta = /** @type {Geomorph.AssetsJson['meta']} */ ({});
  const maps = /** @type {Geomorph.AssetsJson['maps']} */ ({});
  const mapFilenames = fs.readdirSync(mapsDir).filter((x) => x.endsWith(".svg"));

  for (const filename of mapFilenames) {
    const filepath = path.resolve(mapsDir, filename);
    const contents = fs.readFileSync(filepath).toString();
    const mapKey = filename.slice(0, -".svg".length);
    const contentHash = hashText(contents);
    const prevMeta = prev?.meta[mapKey];
    maps[mapKey] = geomorphService.parseMap(mapKey, contents);
    meta[mapKey] = {
      lastModified: contentHash === prevMeta?.contentHash ? prevMeta.lastModified : nextModified,
      contentHash,
    };
  }

  return { maps, meta };
}

/**
 * @param {null | Geomorph.AssetsJson} prev
 * @param {number} nextModified
 * @returns {Pick<Geomorph.AssetsJson, 'symbols' | 'meta'>}
 */
function parseSymbols(prev, nextModified) {
  const meta = /** @type {Geomorph.AssetsJson['meta']} */ ({});
  const symbols = /** @type {Geomorph.AssetsJson['symbols']} */ ({});
  const symbolFilenames = fs.readdirSync(symbolsDir).filter((x) => x.endsWith(".svg"));

  for (const filename of symbolFilenames) {
    const filepath = path.resolve(symbolsDir, filename);
    const contents = fs.readFileSync(filepath).toString();
    const symbolKey = /** @type {Geomorph.SymbolKey} */ (filename.slice(0, -".svg".length));
    const contentHash = hashText(contents);
    const prevMeta = prev?.meta[symbolKey];

    // We transform even when contentHash same, because we're changing schema
    const parsed = geomorphService.parseSymbol(symbolKey, contents);
    const serialized = geomorphService.serializeSymbol(parsed);
    symbols[symbolKey] = serialized;
    const outputHash = hashText(JSON.stringify(serialized));
    meta[symbolKey] = {
      lastModified: outputHash === prevMeta?.outputHash ? prevMeta.lastModified : nextModified,
      contentHash,
      outputHash
    };
  }

  // extend hull symbols via inner symbols
  const hullKeys = geomorphService.hullKeys.filter(x => symbols[x]);
  for (const hullKey of hullKeys) {
    // 🚧 WIP
  }

  return { symbols, meta };
}
