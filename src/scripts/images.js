/**
 * Create:
 * - a floor image for each geomorph
 * - an obstacle sprite-sheet
 * 
 * Usage
 * - npm run images
 * - yarn images
 * - yarn images-fast
 * - yarn images-fast --all
 */
/// <reference path="./deps.d.ts"/>
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';
import { MaxRectsPacker, Rectangle } from "maxrects-packer";
import stringify from 'json-stringify-pretty-compact';
import getopts from 'getopts';

// sucrase-node needs relative paths
import { ASSETS_JSON_FILENAME, DEV_EXPRESS_WEBSOCKET_PORT, GEOMORPHS_JSON_FILENAME, SPRITE_SHEET_JSON_FILENAME } from './const';
import { runYarnScript, saveCanvasAsFile } from './service';
import { ansi } from "../npc-cli/sh/const";
import { spriteSheetNonHullExtraScale, worldScale,  } from '../npc-cli/service/const';
import { error, hashText, info, toPrecision, warn } from '../npc-cli/service/generic';
import { drawPolygons } from '../npc-cli/service/dom';
import { geomorphService } from '../npc-cli/service/geomorph';
import { Poly } from '../npc-cli/geom';

const opts = getopts(process.argv, { boolean: ['all'] });

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const mediaDir = path.resolve(__dirname, "../../media");
const symbolsDir = path.resolve(mediaDir, "symbol");
const assets2dDir = path.resolve(staticAssetsDir, "2d");
const assetsJsonPath = path.resolve(staticAssetsDir, ASSETS_JSON_FILENAME);
const geomorphsJsonPath = path.resolve(staticAssetsDir, GEOMORPHS_JSON_FILENAME);
const spriteSheetJsonPath = path.resolve(staticAssetsDir, SPRITE_SHEET_JSON_FILENAME);
/** e.g. 1.5m --> 60sgu (Starship Geomorph Units) */
const worldToSgu = 1 / worldScale;
const sendDevEventUrl = `http://localhost:${DEV_EXPRESS_WEBSOCKET_PORT}/send-dev-event`;

const options = {
  debugImage: true,
  // debugImage: false,
  debugNavPoly: true,
  debugNavTris: false,
  packedPadding: 2,
};

(async function main() {
  fs.mkdirSync(assets2dDir, { recursive: true }); // ensure output directory

  const assets = geomorphService.deserializeAssets(JSON.parse(fs.readFileSync(assetsJsonPath).toString()));
  const geomorphs = geomorphService.deserializeGeomorphs(JSON.parse(fs.readFileSync(geomorphsJsonPath).toString()));
  const pngToProm = /** @type {{ [pngPath: string]: Promise<any> }} */ ({});

  await drawFloorImages(geomorphs, pngToProm);

  const { sheet, sheetsHash } = await drawObstacleSpritesheets(assets, pngToProm);
  
  geomorphs.sheetsHash = sheetsHash;
  geomorphs.sheet = sheet;
  fs.writeFileSync(geomorphsJsonPath, stringify(geomorphService.serializeGeomorphs(geomorphs)));

  await Promise.all(Object.values(pngToProm));

  // 🚧 development could use PNGs and avoid re-running this
  await runYarnScript(
    'cwebp-fast',
    JSON.stringify({ files: Object.keys(pngToProm) }),
    '--quality=50',
  );

  await fetch(sendDevEventUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "update-browser" }), // 🚧 specific event for images
  }).catch((e) => {
    warn(`POST ${sendDevEventUrl} failed: ${e.cause.code}`);
  });

})();

/**
 * @param {Geomorph.Geomorphs} geomorphs 
 * @param {{ [pngPath: string]: Promise<any> }} pngToProm 
 */
async function drawFloorImages(geomorphs, pngToProm) {
  const layouts = Object.values(geomorphs.layout);

  for (const { key: gmKey, pngRect, doors, walls, navDecomp, hullPoly } of layouts) {
    
    const canvas = createCanvas(0, 0);
    const ct = canvas.getContext('2d');
    canvas.width = pngRect.width * worldToSgu;
    canvas.height = pngRect.height * worldToSgu;
    ct.transform(worldToSgu, 0, 0, worldToSgu, -worldToSgu * pngRect.x, -worldToSgu * pngRect.y);

    // White floor
    // drawPolygons(ct, hullPoly.map(x => x.clone().removeHoles()), ['white', null]);
    if (options.debugNavPoly || options.debugNavTris) {
      debugDrawNav(ct, navDecomp);
    }

    drawPolygons(ct, walls, ['black', null]);
    // drawPolygons(ct, walls, ['black', 'black', 0.04]);
    // ℹ️ technically we support walls with holes, but they may also arise e.g. via door inside wall
    walls.forEach(wall => wall.holes.length && warn(`${gmKey}: saw wall with hole (${wall.outline.length} outer points)`));

    if (options.debugImage) {
      ct.globalAlpha = 0.2;
      const debugImg = await loadImage(fs.readFileSync(path.resolve(staticAssetsDir, 'debug', `${gmKey}.png`)))
      ct.drawImage(debugImg, 0, 0, debugImg.width, debugImg.height, pngRect.x, pngRect.y, pngRect.width, pngRect.height);
      ct.globalAlpha = 1;
    }

    // Doors
    drawPolygons(ct, doors.map((x) => x.poly), ["rgba(0, 0, 0, 0)", "black", 0.02]);

    const pngPath = path.resolve(assets2dDir, `${gmKey}.floor.png`);
    pngToProm[pngPath] = saveCanvasAsFile(canvas, pngPath);
  }
}

/**
 * - Write spritesheet.json
 * - Draw obstacles.png
 * @param {Geomorph.Assets} assets 
 * @param {{ [pngPath: string]: Promise<any> }} pngToProm 
 * @returns {Promise<{ sheet: Geomorph.SpriteSheet; sheetsHash: number; }>}
 */
async function drawObstacleSpritesheets(assets, pngToProm) {

  /** @type {Record<`${Geomorph.SymbolKey} ${number}`, import("maxrects-packer").Rectangle>} */
  const rectsToPackLookup = {};

  // Each symbol obstacle induces a packed rect
  for (const { key: symbolKey, obstacles, isHull } of Object.values(assets.symbols)) {
    /**
     * Scale from world coords to Starship Geomorph coords,
     * and additionally scale up for non-hull symbols.
     * We can additionally scale up by any `1 ≤ x ≤ 5`,
     * making use of the larger size of non-hull symbols.
     */
    const scale = (1 / worldScale) * (isHull ? 1 : spriteSheetNonHullExtraScale);

    for (const [obstacleId, poly] of obstacles.entries()) {
      // width, height should be integers
      const rect = poly.rect.scale(scale).precision(0);
      const [width, height] = [rect.width, rect.height]
      
      const r = new Rectangle(width, height);
      /** @type {Geomorph.SymbolObstacleContext} */
      const rectData = { symbolKey, obstacleId, type: extractObstacleDescriptor(poly.meta) };
      r.data = rectData;
      rectsToPackLookup[`${symbolKey} ${obstacleId}`] = r;
      info(`images will pack ${ansi.BrightYellow}${JSON.stringify({ ...rectData, width, height })}${ansi.Reset}`);
    }
  }

  const packer = new MaxRectsPacker(4096, 4096, options.packedPadding, {
    pot: false,
    border: options.packedPadding,
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
  
  // Create metadata
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

  const jsonString = stringify(json);
  const prevHash = fs.existsSync(spriteSheetJsonPath) ? hashText(fs.readFileSync(spriteSheetJsonPath).toString()) : null;
  const sheetsHash = hashText(jsonString);
  fs.writeFileSync(spriteSheetJsonPath, jsonString);
  if (!opts.all && sheetsHash === prevHash) {
    info(`sheetsHash unchanged: won't redraw sprite-sheet`);
    return { sheet: json, sheetsHash };
  }

  // Create sprite-sheet
  const canvas = createCanvas(bin.width, bin.height);
  const ct = canvas.getContext('2d');
  
  for (const { x, y, width, height, symbolKey, obstacleId } of Object.values(json.obstacle)) {
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

  const pngPath = path.resolve(assets2dDir, `obstacles.png`);
  pngToProm[pngPath] = saveCanvasAsFile(canvas, pngPath);

  return { sheet: json, sheetsHash };
}

/**
 * @param {import('canvas').CanvasRenderingContext2D} ct
 * @param {Geomorph.Layout['navDecomp']} navDecomp
 */
function debugDrawNav(ct, navDecomp) {
  const triangles = navDecomp.tris.map(tri => new Poly(tri.map(i => navDecomp.vs[i])));
  const navPoly = Poly.union(triangles);
  options.debugNavPoly && drawPolygons(ct, navPoly, ['rgba(200, 200, 200, 0.4)', 'black', 0.01]);
  options.debugNavTris && drawPolygons(ct, triangles, [null, 'rgba(0, 0, 0, 0.3)', 0.02]);
}

/** @param {Geom.Meta} meta */
function extractObstacleDescriptor(meta) {
  for (const tag of ['table', 'chair', 'bed', 'shower', 'surface']) {
    if (meta[tag] === true) return tag;
  }
  return 'obstacle';
}
