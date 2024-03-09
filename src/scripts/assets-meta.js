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
  const prevSymbolsLookup = fs.existsSync(outputFilename)
    ? /** @type {typeof symbolsLookup} */ (JSON.parse(fs.readFileSync(outputFilename).toString()))
    : null;

  const symbolsLookup =
    /** @type {Record<Geomorph.SymbolKey, Geomorph.ParsedSymbol<Geom.GeoJsonPolygon>>} */ ({});

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

  fs.writeFileSync(
    outputFilename,
    stringify({
      symbols: symbolsLookup,
    })
  );
})();
