/// <reference path="./deps.d.ts"/>

import fs from "fs";
import path from "path";
import stringify from "json-stringify-pretty-compact";

// relative urls for sucrase-node
import { hashText, info, keys, warn } from "../npc-cli/service/generic";
import { geomorphService } from "../npc-cli/service/geomorph";
import { DEV_EXPRESS_WEBSOCKET_PORT } from "./const";

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const mediaDir = path.resolve(__dirname, "../../media");
const symbolsDir = path.resolve(staticAssetsDir, "symbol");
const mapsDir = path.resolve(mediaDir, "map");
const outputFilename = path.resolve(staticAssetsDir, `assets-meta.json`);

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

  const sendDevEventUrl = `http://localhost:${DEV_EXPRESS_WEBSOCKET_PORT}/send-dev-event`;
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
  const mapLookup = /** @type {Geomorph.AssetsJson['maps']} */ ({});
  const mapFilenames = fs.readdirSync(mapsDir).filter((x) => x.endsWith(".svg"));

  for (const filename of mapFilenames) {
    const filepath = path.resolve(mapsDir, filename);
    const contents = fs.readFileSync(filepath).toString();
    const mapName = filename.slice(0, -".svg".length);

    const parsed = geomorphService.parseMap(mapName, contents);
    mapLookup[mapName] = parsed;
    nextMeta[mapName] = {
      lastModified: fs.statSync(filepath).mtimeMs,
      contentHash: hashText(contents),
    };
  }

  return mapLookup;
}

/**
 * @param {null | Geomorph.AssetsJson} prevOutput
 * @param {Geomorph.AssetsJson['meta']} nextMeta
 * @returns {Geomorph.AssetsJson['symbols']}
 */
function parseSymbols(prevOutput, nextMeta) {
  const prevSymbolLookup = prevOutput?.symbols ?? null;
  const symbolLookup = /** @type {Geomorph.AssetsJson['symbols']} */ ({});
  const symbolFilenames = fs.readdirSync(symbolsDir).filter((x) => x.endsWith(".svg"));

  for (const filename of symbolFilenames) {
    const filepath = path.resolve(symbolsDir, filename);
    const contents = fs.readFileSync(filepath).toString();
    const symbolName = /** @type {Geomorph.SymbolKey} */ (filename.slice(0, -".svg".length));

    const parsed = geomorphService.parseStarshipSymbol(symbolName, contents);
    const serialized = geomorphService.serializeSymbol(parsed);
    symbolLookup[symbolName] = serialized;
    nextMeta[symbolName] = {
      lastModified: fs.statSync(filepath).mtimeMs,
      contentHash: hashText(contents),
    };
  }

  const changedSymbols = keys(symbolLookup).filter(
    (symbolName) =>
      !prevOutput ||
      !(symbolName in prevOutput.symbols) ||
      prevOutput.meta?.[symbolName].contentHash !== nextMeta[symbolName].contentHash
  );
  info({ changedSymbols });

  return symbolLookup;
}
