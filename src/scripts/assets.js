/**
 * Usage:
 * ```sh
 * npm run assets
 * yarn assets
 * yarn assets-fast --all --staleMs=2000
 * ```
 *
 * Generates:
 * - assets.json
 * - geomorphs.json
 * - floor images (one per gmKey)
 * - obstacles sprite-sheet
 */
/// <reference path="./deps.d.ts"/>

import fs from "fs";
import path from "path";
import util from "util";
import getopts from 'getopts';
import stringify from "json-stringify-pretty-compact";
import { createCanvas, loadImage } from 'canvas';
import { MaxRectsPacker, Rectangle } from "maxrects-packer";

// relative urls for sucrase-node
import { Poly } from "../npc-cli/geom";
import { ASSETS_JSON_FILENAME, DEV_EXPRESS_WEBSOCKET_PORT, GEOMORPHS_JSON_FILENAME, SPRITE_SHEET_JSON_FILENAME } from "../const";
import { spriteSheetNonHullExtraScale, worldScale } from "../npc-cli/service/const";
import { ansi } from "../npc-cli/sh/const";
import { hashText, info, keyedItemsToLookup, warn, debug, error, assertNonNull, hashJson, toPrecision } from "../npc-cli/service/generic";
import { geomorphService } from "../npc-cli/service/geomorph";
import { SymbolGraphClass } from "../npc-cli/graph/symbol-graph";
import { drawPolygons } from "../npc-cli/service/dom";
import { runYarnScript, saveCanvasAsFile } from "./service";

const opts = getopts(process.argv, {
  boolean: ['all'],
  string: ['staleMs'],
});
const imgOpts = {
  debugImage: true,
  // debugImage: false,
  debugNavPoly: true,
  debugNavTris: false,
  packedPadding: 2,
};

if (!Number.isFinite(Number(opts.staleMs)) && Number(opts.staleMs) > 0) {
  throw Error('option --staleMs={number} must be positive numeric');
}

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const mediaDir = path.resolve(__dirname, "../../media");
const mapsDir = path.resolve(mediaDir, "map");
const symbolsDir = path.resolve(mediaDir, "symbol");
const assets2dDir = path.resolve(staticAssetsDir, "2d");
const assetsFilepath = path.resolve(staticAssetsDir, ASSETS_JSON_FILENAME);
const geomorphsFilepath = path.resolve(staticAssetsDir, GEOMORPHS_JSON_FILENAME);
const assetsScriptFilepath = __filename;
const geomorphServicePath = path.resolve(__dirname, '../npc-cli/service', 'geomorph.js');
const obstaclesPngPath = path.resolve(assets2dDir, `obstacles.png`);
const sendDevEventUrl = `http://localhost:${DEV_EXPRESS_WEBSOCKET_PORT}/send-dev-event`;
const worldToSgu = 1 / worldScale;

(async function main() {
  
  const prevAssets = /** @type {Geomorph.AssetsJson | null} */ (
    fs.existsSync(assetsFilepath) ? JSON.parse(fs.readFileSync(assetsFilepath).toString()) : null
  );
  const prevGeomorphs = /** @type {Geomorph.GeomorphsJson | null} */ (
    fs.existsSync(geomorphsFilepath) ? JSON.parse(fs.readFileSync(geomorphsFilepath).toString()) : null
  );

  const assetsJson = /** @type {Geomorph.AssetsJson} */ (
    { meta: {}, symbols: /** @type {*} */ ({}), maps: {} }
  );
  
  let svgSymbolFilenames = fs.readdirSync(symbolsDir).filter((x) => x.endsWith(".svg"));

  const updateAll = !!opts.all || !prevAssets || !opts.staleMs || (
    [assetsScriptFilepath, geomorphServicePath].some(x => fs.statSync(x).atimeMs > Date.now() - Number(opts.staleMs)
  ));

  if (updateAll) {
    info(`updating all symbols`);
  } else {// Avoid re-computing
    svgSymbolFilenames = svgSymbolFilenames.filter(filename => {
      const symbolKey = /** @type {Geomorph.SymbolKey} */ (filename.slice(0, -".svg".length));
      assetsJson.symbols[symbolKey] = prevAssets.symbols[symbolKey];
      assetsJson.meta[symbolKey] = prevAssets.meta[symbolKey];
      return fs.statSync(path.resolve(symbolsDir, filename)).atimeMs > Date.now() - 2000;
    });
    info(`updating symbols: ${JSON.stringify(svgSymbolFilenames)}`);
  }

  /**
   * Compute assets.json
   */
  parseSymbols(assetsJson, svgSymbolFilenames);
  parseMaps(assetsJson);

  const changedSymbolAndMapKeys = Object.keys(assetsJson.meta).filter(key =>  assetsJson.meta[key].outputHash !== prevAssets?.meta[key]?.outputHash);
  info({ changedKeys: changedSymbolAndMapKeys });

  const assets = geomorphService.deserializeAssets(assetsJson);
  fs.writeFileSync(assetsFilepath, stringify(assetsJson));
  
  /**
   * Compute flat symbols i.e. recursively unfold "symbols" folder
   */
  const flattened = /** @type {Record<Geomorph.SymbolKey, Geomorph.FlatSymbol>} */ ({});
  const symbolGraph = SymbolGraphClass.from(assetsJson.symbols);
  const symbolsStratified = symbolGraph.stratify();
  debug(util.inspect({ symbolsStratified }, false, 5))
  // Traverse stratified symbols from leaves to co-leaves,
  // creating FlatSymbols via flattenSymbol and instantiateFlatSymbol
  symbolsStratified.forEach(level => level.forEach(({ id: symbolKey }) =>
    geomorphService.flattenSymbol(assets.symbols[symbolKey], flattened)
  ));
  // debug("stateroom--036--2x4", util.inspect(flattened["stateroom--036--2x4"], false, 5));

  const changedGmKeys = geomorphService.gmKeys.filter(gmKey => {
    const hullKey = geomorphService.toHullKey[gmKey];
    const hullNode = assertNonNull(symbolGraph.getNodeById(hullKey));
    return symbolGraph.getReachableNodes(hullNode).find(x => changedSymbolAndMapKeys.includes(x.id));
  });
  info({ changedGmKeys });

  /**
   * Compute sprite-sheet json
   */
  const { sheet, sheetsHash } = await createSheetJson(assets);

  /**
   * Compute geomorphs.json
   */
  const layout = keyedItemsToLookup(geomorphService.gmKeys.map(gmKey => {
    const hullKey = geomorphService.toHullKey[gmKey];
    const flatSymbol = flattened[hullKey];
    return geomorphService.createLayout(gmKey, flatSymbol, assets);
  }));

  /** @type {Geomorph.Geomorphs} */
  const geomorphs = {
    mapsHash: hashJson(assetsJson.maps),
    layoutsHash: hashJson(layout), // don't bother serializing
    sheetsHash,
    map: assetsJson.maps,
    layout,
    sheet,
  };

  fs.writeFileSync(geomorphsFilepath, stringify(geomorphService.serializeGeomorphs(geomorphs)));

  /**
   * Draw geomorph floors
   */
  const createdPngPaths = await drawFloorImages(geomorphs, changedGmKeys);

  fetch(sendDevEventUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "update-browser" }),
  }).catch((e) => {
    warn(`POST ${sendDevEventUrl} failed: ${e.cause.code}`);
  });
  
  /**
   * Draw obstacles sprite-sheet
   */
  // 🚧 only draw when changed
  if (updateAll) {
    await drawObstaclesSheet(assets, geomorphs);
    createdPngPaths.push(obstaclesPngPath);
  }

  await runYarnScript(
    'cwebp-fast',
    JSON.stringify({ files: createdPngPaths }),
    '--quality=50',
  );

})();

/**
 * @param {Geomorph.AssetsJson} output
 */
function parseMaps({ meta, maps }) {
  const mapFilenames = fs.readdirSync(mapsDir).filter((x) => x.endsWith(".svg"));

  for (const filename of mapFilenames) {
    const filepath = path.resolve(mapsDir, filename);
    const contents = fs.readFileSync(filepath).toString();
    const mapKey = filename.slice(0, -".svg".length);
    maps[mapKey] = geomorphService.parseMap(mapKey, contents);
    meta[mapKey] = { outputHash: hashText(stringify(maps[mapKey])) };
  }
}

/**
 * @param {Geomorph.AssetsJson} output
 * @param {string[]} symbolFilenames
 */
function parseSymbols({ symbols, meta }, symbolFilenames) {
  for (const filename of symbolFilenames) {
    const filepath = path.resolve(symbolsDir, filename);
    const contents = fs.readFileSync(filepath).toString();
    const symbolKey = /** @type {Geomorph.SymbolKey} */ (filename.slice(0, -".svg".length));

    const parsed = geomorphService.parseSymbol(symbolKey, contents);
    const serialized = geomorphService.serializeSymbol(parsed);
    symbols[symbolKey] = serialized;
    // console.log({ symbolKey }, typeof serialized)
    meta[symbolKey] = { outputHash: hashText(stringify(serialized)) };
  }

  validateSubSymbolDimension(symbols);
}

/**
 * @param {Geomorph.AssetsJson['symbols']} symbols 
 */
function validateSubSymbolDimension(symbols) {
  Object.values(symbols).forEach(({ key: parentKey, symbols: subSymbols }) => {
    subSymbols.forEach(({ symbolKey, width, height }) => {
      try {
        const expected = { width: symbols[symbolKey].width, height: symbols[symbolKey].height };
        const observed = { width, height };
        if (expected.width !== width || expected.height !== height) {
          warn(`${parentKey}: ${symbolKey}: unexpected symbol dimension`, { expected, observed });
        }
      } catch (e) {
        debug(`parent ${parentKey}: sub-symbol: ${symbolKey}`);
        throw e;
      }
    })
  });
}

/**
 * @param {Geomorph.Geomorphs} geomorphs 
 * @param {Geomorph.GeomorphKey[]} gmKeys 
 * @returns {Promise<string[]>} Paths of created PNGs
 */
async function drawFloorImages(geomorphs, gmKeys) {
  const changedLayouts = Object.values(geomorphs.layout).filter(({ key }) => gmKeys.includes(key));
  const pngPathToProm = /** @type {Record<String, Promise<any>>} */ ({});

  for (const { key: gmKey, pngRect, doors, walls, navDecomp, hullPoly } of changedLayouts) {
    
    const canvas = createCanvas(0, 0);
    const ct = canvas.getContext('2d');
    canvas.width = pngRect.width * worldToSgu;
    canvas.height = pngRect.height * worldToSgu;
    ct.transform(worldToSgu, 0, 0, worldToSgu, -worldToSgu * pngRect.x, -worldToSgu * pngRect.y);

    // White floor
    // drawPolygons(ct, hullPoly.map(x => x.clone().removeHoles()), ['white', null]);
    if (imgOpts.debugNavPoly || imgOpts.debugNavTris) {
      debugDrawNav(ct, navDecomp);
    }

    drawPolygons(ct, walls, ['black', null]);
    // drawPolygons(ct, walls, ['black', 'black', 0.04]);
    // ℹ️ technically we support walls with holes, but they may also arise e.g. via door inside wall
    walls.forEach(wall => wall.holes.length && warn(`${gmKey}: saw wall with hole (${wall.outline.length} outer points)`));

    if (imgOpts.debugImage) {
      ct.globalAlpha = 0.2;
      const debugImg = await loadImage(fs.readFileSync(path.resolve(staticAssetsDir, 'debug', `${gmKey}.png`)))
      ct.drawImage(debugImg, 0, 0, debugImg.width, debugImg.height, pngRect.x, pngRect.y, pngRect.width, pngRect.height);
      ct.globalAlpha = 1;
    }

    // Doors
    drawPolygons(ct, doors.map((x) => x.poly), ["rgba(0, 0, 0, 0)", "black", 0.02]);

    const pngPath = path.resolve(assets2dDir, `${gmKey}.floor.png`);
    pngPathToProm[pngPath] = saveCanvasAsFile(canvas, pngPath);
  }

  await Promise.all(Object.values(pngPathToProm));

  return Object.keys(pngPathToProm);
}

/**
 * @param {Geomorph.Assets} assets 
 * @returns {Promise<{ sheet: Geomorph.SpriteSheet; sheetsHash: number; }>}
 */
async function createSheetJson(assets) {

  const rectsToPackLookup = /** @type {Record<`${Geomorph.SymbolKey} ${number}`, import("maxrects-packer").Rectangle>} */ ({});

  // Each symbol obstacle induces a packed rect
  for (const { key: symbolKey, obstacles, isHull } of Object.values(assets.symbols)) {
    /** World coords -> Starship Geomorph coords, modulo additonal scale in [1, 5] non-hull symbols. */
    const worldToSguScaled = (1 / worldScale) * (isHull ? 1 : spriteSheetNonHullExtraScale);

    for (const [obstacleId, poly] of obstacles.entries()) {
      const rect = poly.rect.scale(worldToSguScaled).precision(0); // width, height integers
      const [width, height] = [rect.width, rect.height]
      
      const r = new Rectangle(width, height);
      /** @type {Geomorph.SymbolObstacleContext} */
      const rectData = { symbolKey, obstacleId, type: extractObstacleDescriptor(poly.meta) };
      r.data = rectData;
      rectsToPackLookup[`${symbolKey} ${obstacleId}`] = r;
      info(`images will pack ${ansi.BrightYellow}${JSON.stringify({ ...rectData, width, height })}${ansi.Reset}`);
    }
  }

  const packer = new MaxRectsPacker(4096, 4096, imgOpts.packedPadding, {
    pot: false,
    border: imgOpts.packedPadding,
    // smart: false,
  });
  const rectsToPack = Object.values(rectsToPackLookup);
  packer.addArray(rectsToPack);
  const { bins } = packer;

  if (bins.length !== 1) {// 🔔 support more than one sprite-sheet
    // warn(`images: expected exactly one bin (${bins.length})`);
    throw Error(`images: expected exactly one bin (${bins.length})`);
  } else if (bins[0].rects.length !== rectsToPack.length) {
    throw Error(`images: expected every image to be packed (${bins.length} of ${rectsToPack.length})`);
  }

  const bin = bins[0];
  
  /** @type {Geomorph.SpriteSheet} */
  const json = ({ obstacle: {}, obstaclesHeight: bin.height, obstaclesWidth: bin.width });
  bin.rects.forEach(r => {
    const { symbolKey, obstacleId, type } = /** @type {Geomorph.SymbolObstacleContext} */ (r.data);
    json.obstacle[`${symbolKey} ${obstacleId}`] = {
      x: toPrecision(r.x),
      y: toPrecision(r.y),
      width: r.width,
      height: r.height,
      symbolKey,
      obstacleId,
      type,
    }
  });

  return { sheet: json, sheetsHash: hashText(stringify(json)) };
}

/**
 * 🚧 only draw changed
 * @param {Geomorph.Assets} assets 
 * @param {Geomorph.Geomorphs} geomorphs 
 */
async function drawObstaclesSheet(assets, geomorphs) {

  const { obstaclesWidth, obstaclesHeight, obstacle } = geomorphs.sheet;
  const canvas = createCanvas(obstaclesWidth, obstaclesHeight);
  const ct = canvas.getContext('2d');
  
  for (const { x, y, width, height, symbolKey, obstacleId } of Object.values(obstacle)) {
    // extract data-url PNG from SVG symbol
    const symbolPath = path.resolve(symbolsDir, `${symbolKey}.svg`);
    const matched = fs.readFileSync(symbolPath).toString().match(/"data:image\/png(.*)"/);
    if (matched) {
      const dataUrl = matched[0].slice(1, -1);
      const image = await loadImage(dataUrl);
      const symbol = assets.symbols[symbolKey];
      const scale = (1 / worldScale) * (symbol.isHull ? 1 : spriteSheetNonHullExtraScale);
      
      const srcPoly = symbol.obstacles[obstacleId].clone();
      const srcRect = srcPoly.rect;
      const srcPngRect = srcPoly.rect.delta(-symbol.pngRect.x, -symbol.pngRect.y).scale(1 / (worldScale * (symbol.isHull ? 1 : 0.2)));
      const dstPngPoly = srcPoly.clone().translate(-srcRect.x, -srcRect.y).scale(scale).translate(x, y);

      ct.save();
      drawPolygons(ct, dstPngPoly, ['white', null], 'clip');
      ct.drawImage(image, srcPngRect.x, srcPngRect.y, srcPngRect.width, srcPngRect.height, x, y, width, height);
      ct.restore();
      info(`images: drew ${symbolKey}`);
    } else {
      error(`${symbolPath}: expected data:image/png inside SVG symbol`);
    }
  }

  saveCanvasAsFile(canvas, obstaclesPngPath);
}


/**
 * @param {import('canvas').CanvasRenderingContext2D} ct
 * @param {Geomorph.Layout['navDecomp']} navDecomp
 */
function debugDrawNav(ct, navDecomp) {
  const triangles = navDecomp.tris.map(tri => new Poly(tri.map(i => navDecomp.vs[i])));
  const navPoly = Poly.union(triangles);
  imgOpts.debugNavPoly && drawPolygons(ct, navPoly, ['rgba(200, 200, 200, 0.4)', 'black', 0.01]);
  imgOpts.debugNavTris && drawPolygons(ct, triangles, [null, 'rgba(0, 0, 0, 0.3)', 0.02]);
}

/** @param {Geom.Meta} meta */
function extractObstacleDescriptor(meta) {
  for (const tag of ['table', 'chair', 'bed', 'shower', 'surface']) {
    if (meta[tag] === true) return tag;
  }
  return 'obstacle';
}
