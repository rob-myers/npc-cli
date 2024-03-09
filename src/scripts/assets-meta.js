/// <reference path="./deps.d.ts"/>

import fs from "fs";
import path from "path";
import stringify from "json-stringify-pretty-compact";

import { info, keys } from "src/npc-cli/service/generic";
import { geomorphService } from "src/npc-cli/service/geomorph";

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const symbolsDir = path.resolve(staticAssetsDir, "symbol");
const mapsDir = path.resolve(staticAssetsDir, "map");
const outputFilename = path.resolve(staticAssetsDir, `assets-meta.json`);

(function main() {
  /** @type {null | Geomorph.AssetsJson} */
  const prevOutput = fs.existsSync(outputFilename)
    ? JSON.parse(fs.readFileSync(outputFilename).toString())
    : null;

  const symbols = parseSymbols(prevOutput);
  const maps = parseMaps(prevOutput);

  /** @type {Geomorph.AssetsJson} */
  const output = {
    symbols,
    maps,
  };

  fs.writeFileSync(outputFilename, stringify(output));
})();

/**
 * 🚧 parse maps AND geomorph layouts
 * @param {null | Geomorph.AssetsJson} prevOutput
 * @returns {Geomorph.AssetsJson['maps']}
 */
function parseMaps(prevOutput) {
  const mapLookup = /** @type {Geomorph.AssetsJson['maps']} */ ({});
  const mapFilenames = fs.readdirSync(mapsDir).filter((x) => x.endsWith(".svg"));

  for (const filename of mapFilenames) {
    const filepath = path.resolve(mapsDir, filename);
    const contents = fs.readFileSync(filepath).toString();
    const mapName = filename.slice(0, -".svg".length);
    const lastModified = fs.statSync(filepath).mtimeMs;

    const parsed = geomorphService.parseMap(mapName, contents, lastModified);
    mapLookup[mapName] = parsed;
  }

  return mapLookup;
}

/**
 * @param {null | Geomorph.AssetsJson} prevOutput
 * @returns {Geomorph.AssetsJson['symbols']}
 */
function parseSymbols(prevOutput) {
  const prevSymbolLookup = prevOutput?.symbols ?? null;
  const symbolLookup = /** @type {Geomorph.AssetsJson['symbols']} */ ({});
  const symbolFilenames = fs.readdirSync(symbolsDir).filter((x) => x.endsWith(".svg"));

  for (const filename of symbolFilenames) {
    const filepath = path.resolve(symbolsDir, filename);
    const contents = fs.readFileSync(filepath).toString();
    const symbolName = /** @type {Geomorph.SymbolKey} */ (filename.slice(0, -".svg".length));
    const lastModified = fs.statSync(filepath).mtimeMs;

    const parsed = geomorphService.parseStarshipSymbol(symbolName, contents, lastModified);
    const serialized = geomorphService.serializeSymbol(parsed);
    symbolLookup[symbolName] = serialized;
  }

  const changedSymbols = keys(symbolLookup).filter(
    (symbolName) =>
      !prevSymbolLookup ||
      !(symbolName in prevSymbolLookup) ||
      prevSymbolLookup[symbolName].lastModified !== symbolLookup[symbolName].lastModified
  );
  info({ changedSymbols });

  return symbolLookup;
}
