/// <reference path="./deps.d.ts"/>

import fs from "fs";
import path from "path";
import stringify from "json-stringify-pretty-compact";

// relative urls for sucrase-node
import { hashText, info, warn } from "../npc-cli/service/generic";
import { geomorphService } from "../npc-cli/service/geomorph";
import { DEV_EXPRESS_WEBSOCKET_PORT } from "./const";

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const mediaDir = path.resolve(__dirname, "../../media");
const symbolsDir = path.resolve(staticAssetsDir, "symbol");
const mapsDir = path.resolve(mediaDir, "map");
const outputFilename = path.resolve(staticAssetsDir, `assets-meta.json`);
const sendDevEventUrl = `http://localhost:${DEV_EXPRESS_WEBSOCKET_PORT}/send-dev-event`;

(function main() {
  /** @type {null | Geomorph.AssetsJson} */
  const prevOutput = fs.existsSync(outputFilename)
    ? JSON.parse(fs.readFileSync(outputFilename).toString())
    : null;

  const meta = /** @type {Geomorph.AssetsJson['meta']} */ ({});

  const { symbols, changedKeys: changedSymbols } = parseSymbols(prevOutput, meta);
  const { maps, changedKeys: changedMaps } = parseMaps(prevOutput, meta);
  info({ changedSymbols, changedMaps });

  /** @type {Geomorph.AssetsJson} */
  const output = {
    meta,
    symbols,
    maps,
  };

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
 * @param {Geomorph.AssetsJson['meta']} nextMeta
 * @returns {{ maps: Geomorph.AssetsJson['maps']; changedKeys: string[] }}
 */
function parseMaps(prev, nextMeta) {
  const prevMeta = prev?.meta;
  const mapLookup = /** @type {Geomorph.AssetsJson['maps']} */ ({});
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
      mapLookup[mapKey] = parsed;
      nextMeta[mapKey] = { lastModified: fs.statSync(filepath).mtimeMs, contentHash };
      changedKeys.push(mapKey);
    } else {
      mapLookup[mapKey] = prev.maps[mapKey];
      nextMeta[mapKey] = prev.meta[mapKey];
    }
  }

  return { maps: mapLookup, changedKeys };
}

/**
 * @param {null | Geomorph.AssetsJson} prev
 * @param {Geomorph.AssetsJson['meta']} nextMeta
 * @returns {{ symbols: Geomorph.AssetsJson['symbols']; changedKeys: Geomorph.SymbolKey[] }}
 */
function parseSymbols(prev, nextMeta) {
  const prevMeta = prev?.meta;
  const symbolLookup = /** @type {Geomorph.AssetsJson['symbols']} */ ({});
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
      symbolLookup[symbolKey] = serialized;
      nextMeta[symbolKey] = { lastModified: fs.statSync(filepath).mtimeMs, contentHash };
      changedKeys.push(symbolKey);
    } else {
      symbolLookup[symbolKey] = prev.symbols[symbolKey];
      nextMeta[symbolKey] = prev.meta[symbolKey];
    }
  }

  return { symbols: symbolLookup, changedKeys };
}
