/// <reference path="./deps.d.ts"/>

/**
 * Usage:
 * ```sh
 * npm run assets-meta [-- --force]
 * yarn assets-meta [--force]
 * ```
 *
 * We need to --force update on schema change.
 */

import fs from "fs";
import path from "path";
import stringify from "json-stringify-pretty-compact";
import getOpts from "getopts";

// relative urls for sucrase-node
import { ASSETS_META_JSON_FILENAME, DEV_EXPRESS_WEBSOCKET_PORT } from "./const";
import { hashText, info, keys, warn } from "../npc-cli/service/generic";
import { Mat } from "../npc-cli/geom";
import { geomorphService } from "../npc-cli/service/geomorph";

const { force: forceUpdate } = getOpts(process.argv, { boolean: ["force"] });

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const mediaDir = path.resolve(__dirname, "../../media");
const symbolsDir = path.resolve(staticAssetsDir, "symbol");
const mapsDir = path.resolve(mediaDir, "map");
const outputFilename = path.resolve(staticAssetsDir, ASSETS_META_JSON_FILENAME);
const sendDevEventUrl = `http://localhost:${DEV_EXPRESS_WEBSOCKET_PORT}/send-dev-event`;
const tmpMat1 = new Mat();

(function main() {
  const prev = fs.existsSync(outputFilename)
    ? /** @type {Geomorph.AssetsJson} */ (JSON.parse(fs.readFileSync(outputFilename).toString()))
    : null;

  const lastModified = Date.now();

  const { symbols, meta: symbolsMeta } = parseSymbols(prev, lastModified, forceUpdate);
  const { maps, meta: mapsMeta } = parseMaps(prev, lastModified, forceUpdate);
  
  const changedMaps = Object.keys(mapsMeta).filter(key => mapsMeta[key].contentHash !== prev?.meta[key].contentHash);
  const changedSymbols = Object.keys(symbolsMeta).filter(key => symbolsMeta[key].outputHash !== prev?.meta[key].outputHash);
  info({ changedSymbols, changedMaps });
  
  const meta = { ...symbolsMeta, ...mapsMeta };

  // fix lastModified when forceUpdate
  forceUpdate && prev && Object.keys(meta).forEach((key) => (
    prev.meta[key].contentHash === meta[key].contentHash
    && prev.meta[key].outputHash === meta[key].outputHash
  ) &&
    (meta[key].lastModified = prev.meta[key].lastModified)
  );

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
 * @param {boolean} [forceUpdate]
 * @returns {Pick<Geomorph.AssetsJson, 'maps' | 'meta'>}
 */
function parseMaps(prev, nextModified, forceUpdate) {
  forceUpdate && (prev = null);
  const prevMeta = prev?.meta;
  const meta = /** @type {Geomorph.AssetsJson['meta']} */ ({});
  const maps = /** @type {Geomorph.AssetsJson['maps']} */ ({});
  const mapFilenames = fs.readdirSync(mapsDir).filter((x) => x.endsWith(".svg"));
  const changedKeys = /** @type {string[]} */ ([]);

  for (const filename of mapFilenames) {
    const filepath = path.resolve(mapsDir, filename);
    const contents = fs.readFileSync(filepath).toString();
    const mapKey = filename.slice(0, -".svg".length);
    const prevHash = prevMeta?.[mapKey]?.contentHash;
    const contentHash = hashText(contents);

    if (!prev || prevHash !== contentHash) {
      const parsed = geomorphService.parseMap(mapKey, contents);
      maps[mapKey] = parsed;
      meta[mapKey] = { lastModified: nextModified, contentHash };
      changedKeys.push(mapKey);
    } else {
      maps[mapKey] = prev.maps[mapKey];
      meta[mapKey] = prev.meta[mapKey];
    }
  }

  return { maps, meta };
}

/**
 * @param {null | Geomorph.AssetsJson} prev
 * @param {number} nextModified
 * @param {boolean} [forceUpdate]
 * @returns {Pick<Geomorph.AssetsJson, 'symbols' | 'meta'>}
 */
function parseSymbols(prev, nextModified, forceUpdate) {
  forceUpdate && (prev = null);
  const meta = /** @type {Geomorph.AssetsJson['meta']} */ ({});
  const symbols = /** @type {Geomorph.AssetsJson['symbols']} */ ({});
  const symbolFilenames = fs.readdirSync(symbolsDir).filter((x) => x.endsWith(".svg"));

  for (const filename of symbolFilenames) {
    const filepath = path.resolve(symbolsDir, filename);
    const contents = fs.readFileSync(filepath).toString();
    const symbolKey = /** @type {Geomorph.SymbolKey} */ (filename.slice(0, -".svg".length));
    const prevHash = prev?.meta[symbolKey]?.contentHash;
    const contentHash = hashText(contents);

    if (!prev || prevHash !== contentHash) {
      const parsed = geomorphService.parseSymbol(symbolKey, contents);
      const serialized = geomorphService.serializeSymbol(parsed);
      symbols[symbolKey] = serialized;
      const outputHash = hashText(JSON.stringify(serialized));
      meta[symbolKey] = { lastModified: nextModified, contentHash, outputHash };
    } else {
      symbols[symbolKey] = prev.symbols[symbolKey];
      meta[symbolKey] = prev.meta[symbolKey];
    }
  }

  // extend hull symbols via inner symbols
  const hullKeys = geomorphService.hullKeys.filter(x => symbols[x]);
  for (const hullKey of hullKeys) {
    const { wallSegs, symbols: innerSymbols } = symbols[hullKey];
    innerSymbols.forEach(({ symbolKey, transform }) => {
      tmpMat1.feedFromArray(transform);
      symbols[symbolKey].wallSegs.forEach(([u, v]) =>
      wallSegs.push([tmpMat1.transformPoint({...u}), tmpMat1.transformPoint({...v})]));
    });
  }

  return { symbols, meta };
}
