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
import { hashText, info, keys, warn } from "../npc-cli/service/generic";
import { geomorphService } from "../npc-cli/service/geomorph";
import { DEV_EXPRESS_WEBSOCKET_PORT } from "./const";

const { force: forceUpdate } = getOpts(process.argv, { boolean: ["force"] });

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const mediaDir = path.resolve(__dirname, "../../media");
const symbolsDir = path.resolve(staticAssetsDir, "symbol");
const mapsDir = path.resolve(mediaDir, "map");
const outputFilename = path.resolve(staticAssetsDir, `assets-meta.json`);
const sendDevEventUrl = `http://localhost:${DEV_EXPRESS_WEBSOCKET_PORT}/send-dev-event`;

(function main() {
  const prev = fs.existsSync(outputFilename) && !forceUpdate
    ? /** @type {Geomorph.AssetsJson} */ (JSON.parse(fs.readFileSync(outputFilename).toString()))
    : null;

  const { symbols, meta: symbolsMeta, changed: changedSymbols } = parseSymbols(prev);
  const { maps, meta: mapsMeta, changed: changedMaps } = parseMaps(prev);
  const meta = { ...symbolsMeta, ...mapsMeta };
  info({ changedSymbols, changedMaps });

  /** @type {Geomorph.AssetsJson} */
  const output = { meta, symbols, maps };

  // fix lastModified when forceUpdate
  forceUpdate && prev && keys(meta).forEach((key) =>
    prev.meta[key].contentHash === meta[key].contentHash &&
    (meta[key].lastModified = prev.meta[key].lastModified)
  );

  fs.writeFileSync(outputFilename, stringify(output));

  fetch(sendDevEventUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "update-browser", changedSymbols, changedMaps }),
  }).catch((e) => {
    warn(`POST ${sendDevEventUrl} failed: ${e.cause.code}`);
  });
})();

/**
 * @param {null | Geomorph.AssetsJson} prev
 * @returns {Pick<Geomorph.AssetsJson, 'maps' | 'meta'> & { changed: string[] }}
 */
function parseMaps(prev) {
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
      meta[mapKey] = { lastModified: Date.now(), contentHash };
      changedKeys.push(mapKey);
    } else {
      maps[mapKey] = prev.maps[mapKey];
      meta[mapKey] = prev.meta[mapKey];
    }
  }

  return { maps, meta, changed: changedKeys };
}

/**
 * @param {null | Geomorph.AssetsJson} prev
 * @returns {Pick<Geomorph.AssetsJson, 'symbols' | 'meta'> & { changed: Geomorph.SymbolKey[] }}
 */
function parseSymbols(prev) {
  const prevMeta = prev?.meta;
  const meta = /** @type {Geomorph.AssetsJson['meta']} */ ({});
  const symbols = /** @type {Geomorph.AssetsJson['symbols']} */ ({});
  const symbolFilenames = fs.readdirSync(symbolsDir).filter((x) => x.endsWith(".svg"));
  const changedKeys = /** @type {Geomorph.SymbolKey[]} */ ([]);

  for (const filename of symbolFilenames) {
    const filepath = path.resolve(symbolsDir, filename);
    const contents = fs.readFileSync(filepath).toString();
    const symbolKey = /** @type {Geomorph.SymbolKey} */ (filename.slice(0, -".svg".length));
    const prevHash = prevMeta?.[symbolKey]?.contentHash;
    const contentHash = hashText(contents);

    if (!prev || prevHash !== contentHash) {
      const parsed = geomorphService.parseStarshipSymbol(symbolKey, contents);
      const serialized = geomorphService.serializeSymbol(parsed);
      symbols[symbolKey] = serialized;
      meta[symbolKey] = { lastModified: Date.now(), contentHash };
      changedKeys.push(symbolKey);
    } else {
      symbols[symbolKey] = prev.symbols[symbolKey];
      meta[symbolKey] = prev.meta[symbolKey];
    }
  }

  return { symbols, meta, changed: changedKeys };
}
