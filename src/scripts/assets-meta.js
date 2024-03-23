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
import { ASSETS_META_JSON_FILENAME, DEV_EXPRESS_WEBSOCKET_PORT, GEOMORPHS_JSON_FILENAME } from "./const";
import { hashText, info, warn } from "../npc-cli/service/generic";
import { geomorphService } from "../npc-cli/service/geomorph";

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const mediaDir = path.resolve(__dirname, "../../media");
const symbolsDir = path.resolve(mediaDir, "symbol");
const mapsDir = path.resolve(mediaDir, "map");

/** Assets metadata JSON output */
const assetsMetaFilename = path.resolve(staticAssetsDir, ASSETS_META_JSON_FILENAME);
/** Geomorphs layout JSON output */
const geomorphsFilename = path.resolve(staticAssetsDir, GEOMORPHS_JSON_FILENAME);

const sendDevEventUrl = `http://localhost:${DEV_EXPRESS_WEBSOCKET_PORT}/send-dev-event`;

(function main() {

  const prev = fs.existsSync(assetsMetaFilename)
    ? /** @type {Geomorph.AssetsJson} */ (JSON.parse(fs.readFileSync(assetsMetaFilename).toString()))
    : null;

  const { symbols, meta: symbolsMeta } = parseSymbols(prev);
  const { maps, meta: mapsMeta } = parseMaps(prev);
  const meta = { ...symbolsMeta, ...mapsMeta };
  
  info({
    changedSymbols: Object.keys(symbolsMeta).filter(key => symbolsMeta[key].outputHash !== prev?.meta[key]?.outputHash),
    changedMaps: Object.keys(mapsMeta).filter(key => mapsMeta[key].outputHash !== prev?.meta[key].outputHash),
  });
  
  /** @type {Geomorph.AssetsJson} */
  const assetsJson = { meta, symbols, maps };
  const assets = geomorphService.deserializeAssets(assetsJson);
  fs.writeFileSync(
    assetsMetaFilename,
    stringify(assetsJson),
  );
    
  const geomorphs = {
    layout: geomorphService.gmKeys.reduce((agg, gmKey) => ({ ...agg,
      [gmKey]: geomorphService.computeLayoutNew(gmKey, assets),
    }), /** @type {Geomorph.Geomorphs['layout']} */ ({}))
  };
  fs.writeFileSync(
    geomorphsFilename,
    stringify(geomorphService.serializeGeomorphs(geomorphs)),
  );

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
 * @returns {Pick<Geomorph.AssetsJson, 'symbols' | 'meta'>}
 */
function parseSymbols(prev) {
  const meta = /** @type {Geomorph.AssetsJson['meta']} */ ({});
  const symbols = /** @type {Geomorph.AssetsJson['symbols']} */ ({});
  const symbolFilenames = fs.readdirSync(symbolsDir).filter((x) => x.endsWith(".svg"));

  for (const filename of symbolFilenames) {
    const filepath = path.resolve(symbolsDir, filename);
    const contents = fs.readFileSync(filepath).toString();
    const symbolKey = /** @type {Geomorph.SymbolKey} */ (filename.slice(0, -".svg".length));

    // We transform even when contentHash same, because we're changing schema
    const parsed = geomorphService.parseSymbol(symbolKey, contents);
    const serialized = geomorphService.serializeSymbol(parsed);
    symbols[symbolKey] = serialized;
    meta[symbolKey] = { outputHash: hashText(JSON.stringify(serialized)) };
  }

  return { symbols, meta };
}
