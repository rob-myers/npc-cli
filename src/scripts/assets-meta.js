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

  const symbols = parseSymbols(prevOutput, meta);
  const maps = parseMaps(prevOutput, meta);

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
 * 🚧 parse maps AND geomorph layouts
 * @param {null | Geomorph.AssetsJson} prevOutput
 * @param {Geomorph.AssetsJson['meta']} nextMeta
 * @returns {Geomorph.AssetsJson['maps']}
 */
function parseMaps(prevOutput, nextMeta) {
  const prevMeta = prevOutput?.meta;
  const mapLookup = /** @type {Geomorph.AssetsJson['maps']} */ ({});
  const mapFilenames = fs.readdirSync(mapsDir).filter((x) => x.endsWith(".svg"));

  for (const filename of mapFilenames) {
    const filepath = path.resolve(mapsDir, filename);
    const contents = fs.readFileSync(filepath).toString();
    const mapKey = filename.slice(0, -".svg".length);
    const prevHash = prevMeta?.[mapKey]?.contentHash;
    const contentHash = hashText(contents);

    if (!prevOutput || prevHash !== contentHash) {
      const parsed = geomorphService.parseMap(mapKey, contents);
      mapLookup[mapKey] = parsed;
      nextMeta[mapKey] = { lastModified: fs.statSync(filepath).mtimeMs, contentHash };
    } else {
      mapLookup[mapKey] = prevOutput.maps[mapKey];
      nextMeta[mapKey] = prevOutput.meta[mapKey];
    }
  }

  return mapLookup;
}

/**
 * @param {null | Geomorph.AssetsJson} prevOutput
 * @param {Geomorph.AssetsJson['meta']} nextMeta
 * @returns {Geomorph.AssetsJson['symbols']}
 */
function parseSymbols(prevOutput, nextMeta) {
  const prevMeta = prevOutput?.meta;
  const symbolLookup = /** @type {Geomorph.AssetsJson['symbols']} */ ({});
  const symbolFilenames = fs.readdirSync(symbolsDir).filter((x) => x.endsWith(".svg"));
  const changedSymbols = /** @type {Geomorph.SymbolKey[]} */ ([]);

  for (const filename of symbolFilenames) {
    const filepath = path.resolve(symbolsDir, filename);
    const contents = fs.readFileSync(filepath).toString();
    const symbolKey = /** @type {Geomorph.SymbolKey} */ (filename.slice(0, -".svg".length));
    const prevHash = prevMeta?.[symbolKey]?.contentHash;
    const contentHash = hashText(contents);

    if (!prevOutput || prevHash !== contentHash) {
      const parsed = geomorphService.parseStarshipSymbol(symbolKey, contents);
      const serialized = geomorphService.serializeSymbol(parsed);
      symbolLookup[symbolKey] = serialized;
      nextMeta[symbolKey] = { lastModified: fs.statSync(filepath).mtimeMs, contentHash };
      changedSymbols.push(symbolKey);
    } else {
      symbolLookup[symbolKey] = prevOutput.symbols[symbolKey];
      nextMeta[symbolKey] = prevOutput.meta[symbolKey];
    }
  }

  info({ changedSymbols });
  return symbolLookup;
}
