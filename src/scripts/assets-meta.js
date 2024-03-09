/// <reference path="./deps.d.ts"/>

import fs from "fs";
import path from "path";
import stringify from "json-stringify-pretty-compact";

import { keys } from "src/npc-cli/service/generic";
import { geomorphService } from "src/npc-cli/service/geomorph";

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const symbolsDir = path.resolve(staticAssetsDir, "symbol");
const mapsDir = path.resolve(staticAssetsDir, "map");
const outputFilename = path.resolve(staticAssetsDir, `assets-meta.json`);

(function main() {
  /** @type {null | OutputJson} */
  const prevOutput = fs.existsSync(outputFilename)
    ? JSON.parse(fs.readFileSync(outputFilename).toString())
    : null;

  const symbols = parseSymbols(prevOutput);
  const maps = parseMaps(prevOutput);

  /** @type {OutputJson} */
  const output = {
    symbols,
    maps,
  };

  fs.writeFileSync(outputFilename, stringify(output));
})();

/**
 * 🚧 eventually create maps and geomorph layouts
 * @param {null | OutputJson} prevOutput
 * @returns {OutputJson['maps']}
 */
function parseMaps(prevOutput) {
  const prevMapLookup = prevOutput?.maps ?? null;
  const mapLookup = /** @type {OutputJson['maps']} */ ({});
  const mapFilenames = fs.readdirSync(mapsDir).filter((x) => x.endsWith(".svg"));

  // 🚧

  return mapLookup;
}

/**
 * @param {null | OutputJson} prevOutput
 * @returns {OutputJson['symbols']}
 */
function parseSymbols(prevOutput) {
  const prevSymbolsLookup = prevOutput?.symbols ?? null;
  const symbolsLookup = /** @type {OutputJson['symbols']} */ ({});
  const symbolFilenames = fs.readdirSync(symbolsDir).filter((x) => x.endsWith(".svg"));

  for (const filename of symbolFilenames) {
    const filepath = path.resolve(symbolsDir, filename);
    const contents = fs.readFileSync(filepath).toString();
    const symbolName = /** @type {Geomorph.SymbolKey} */ (filename.slice(0, -".svg".length));
    const lastModified = fs.statSync(filepath).mtimeMs;

    const parsed = geomorphService.parseStarshipSymbol(symbolName, contents, lastModified);
    const serialized = geomorphService.serializeSymbol(parsed);
    symbolsLookup[symbolName] = serialized;
  }

  const changedSymbols = keys(symbolsLookup).filter(
    (symbolName) =>
      !prevSymbolsLookup ||
      !(symbolName in prevSymbolsLookup) ||
      prevSymbolsLookup[symbolName].lastModified !== symbolsLookup[symbolName].lastModified
  );
  console.info({ changedSymbols });

  return symbolsLookup;
}

/**
 * @typedef OutputJson
 * @property {Record<Geomorph.SymbolKey, Geomorph.ParsedSymbol<Geom.GeoJsonPolygon>>} symbols
 * @property {Record<string, Geomorph.MapLayout>} maps
 */
