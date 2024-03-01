/// <reference path="./deps.d.ts"/>

import fs from "fs";
import path from "path";
import stringify from "json-stringify-pretty-compact";

import { keys } from "src/npc-cli/service/generic";
import { geomorphService } from "src/npc-cli/service/geomorph";

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const symbolsDir = path.resolve(staticAssetsDir, "symbol");
const outputFilename = path.resolve(symbolsDir, `symbols-meta.json`);

(function main() {
  const prevLookup = fs.existsSync(outputFilename)
    ? /** @type {typeof outputLookup} */ (JSON.parse(fs.readFileSync(outputFilename).toString()))
    : null;

  const outputLookup =
    /** @type {Record<Geomorph.SymbolKey, Geomorph.ParsedSymbol<Geom.GeoJsonPolygon>>} */ ({});

  const svgFilenames = fs.readdirSync(symbolsDir).filter((x) => x.endsWith(".svg"));

  for (const filename of svgFilenames) {
    const filepath = path.resolve(symbolsDir, filename);
    const contents = fs.readFileSync(filepath).toString();
    const symbolName = /** @type {Geomorph.SymbolKey} */ (filename.slice(0, -".svg".length));
    const lastModified = fs.statSync(filepath).mtimeMs;

    const parsed = geomorphService.parseStarshipSymbol(symbolName, contents, lastModified);
    const serialized = geomorphService.serializeSymbol(parsed);
    outputLookup[symbolName] = serialized;
  }

  const changedSymbols = keys(outputLookup).filter(
    (symbolName) =>
      !prevLookup ||
      !(symbolName in prevLookup) ||
      prevLookup[symbolName].lastModified !== outputLookup[symbolName].lastModified
  );
  console.info({ changedSymbols });

  fs.writeFileSync(outputFilename, stringify(outputLookup));
})();
