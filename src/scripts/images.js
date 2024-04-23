/**
 * Create:
 * - one floor images per geomorph
 * - obstacle sprite-sheet (over all geomorphs)
 * 
 * Usage
 * - npm run images
 * - yarn images
 */
/// <reference path="./deps.d.ts"/>
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';
import { MaxRectsPacker, Rectangle } from "maxrects-packer";
import stringify from 'json-stringify-pretty-compact';

import { ASSETS_JSON_FILENAME, DEV_EXPRESS_WEBSOCKET_PORT, GEOMORPHS_JSON_FILENAME, OBSTACLES_SPRITE_SHEET_JSON_FILENAME } from './const';
import { runYarnScript, saveCanvasAsFile } from './service';

// sucrase-node needs relative paths
import { ansi } from "../npc-cli/sh/const";
import { precision, worldScale } from '../npc-cli/service/const';
import { error, info, toPrecision, warn } from '../npc-cli/service/generic';
import { drawPolygons } from '../npc-cli/service/dom';
import { geomorphService } from '../npc-cli/service/geomorph';
import { Poly } from '../npc-cli/geom';

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const mediaDir = path.resolve(__dirname, "../../media");
const symbolsDir = path.resolve(mediaDir, "symbol");
const assets2dDir = path.resolve(staticAssetsDir, "2d");
const assetsJson = path.resolve(staticAssetsDir, ASSETS_JSON_FILENAME);
const geomorphsJson = path.resolve(staticAssetsDir, GEOMORPHS_JSON_FILENAME);
const obstaclesSpriteSheetJsonPath = path.resolve(staticAssetsDir, OBSTACLES_SPRITE_SHEET_JSON_FILENAME);
/** e.g. 1.5m --> 60sgu (Starship Geomorph Units) */
const worldToSgu = 1 / worldScale;
const sendDevEventUrl = `http://localhost:${DEV_EXPRESS_WEBSOCKET_PORT}/send-dev-event`;

const opts = {
  debugImage: true,
  debugNavPoly: true,
  debugNavTris: false,
  packedPadding: 2,
};

(async function main() {
  fs.mkdirSync(assets2dDir, { recursive: true }); // ensure output directory

  const assets = geomorphService.deserializeAssets(JSON.parse(fs.readFileSync(assetsJson).toString()));
  const geomorphs = geomorphService.deserializeGeomorphs(JSON.parse(fs.readFileSync(geomorphsJson).toString()));
  const pngToProm = /** @type {{ [pngPath: string]: Promise<any> }} */ ({});

  await drawFloorImages(geomorphs, pngToProm);

  await drawObstacleSpritesheets(assets, pngToProm);

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
    if (opts.debugNavPoly || opts.debugNavTris) {
      debugDrawNav(ct, navDecomp);
    }

    // 🚧 
    // drawPolygons(ct, walls, ['black', null]);
    drawPolygons(ct, walls, ['black', 'black', 0.04]);

    if (opts.debugImage) {
      ct.globalAlpha = 0.4;
      const debugImg = await loadImage(fs.readFileSync(path.resolve(staticAssetsDir, 'debug', `${gmKey}.png`)))
      ct.drawImage(debugImg, 0, 0, debugImg.width, debugImg.height, pngRect.x, pngRect.y, pngRect.width, pngRect.height);
      ct.globalAlpha = 1;
    }

    drawPolygons(ct, doors.map((x) => x.poly), ["white", "black", 0.05]);

    const pngPath = path.resolve(assets2dDir, `${gmKey}.floor.png`);
    pngToProm[pngPath] = saveCanvasAsFile(canvas, pngPath);
  }
}

/**
 * @param {Geomorph.Assets} assets 
 * @param {{ [pngPath: string]: Promise<any> }} pngToProm 
 */
async function drawObstacleSpritesheets(assets, pngToProm) {

  /** @type {Record<`${Geomorph.SymbolKey} ${number}`, import("maxrects-packer").Rectangle>} */
  const rectsToPackLookup = {};

  // Each symbol obstacle induces a packed rect
  for (const { key: symbolKey, obstacles } of Object.values(assets.symbols)) {
    /** Scale from world coords to Starship Geomorph coords (hull symbol coords)  */
    const scale = 1 / worldScale;

    for (const [obstacleId, poly] of obstacles.entries()) {
      const rect = poly.rect.scale(scale).precision(precision);
      const [width, height] = [rect.width, rect.height]
      
      const r = new Rectangle(width, height);
      /** @type {Geomorph.SymbolObstacleContext} */
      const rectData = { symbolKey, obstacleId, type: extractObstacleDescriptor(poly.meta) };
      r.data = rectData;
      rectsToPackLookup[`${symbolKey} ${obstacleId}`] = r;
      info(`images will pack ${ansi.BrightYellow}${JSON.stringify({ ...rectData, width, height })}${ansi.Reset}`);
    }
  }

  const packer = new MaxRectsPacker(4096, 4096, opts.packedPadding, {
    pot: false,
    border: opts.packedPadding,
    // smart: false,
  });
  const rectsToPack = Object.values(rectsToPackLookup);
  packer.addArray(rectsToPack);
  const { bins } = packer;

  if (bins.length !== 1) {// 🔔 support more than one sprite-sheet
    throw Error(`images: expected exactly one bin (${bins.length})`);
  } else if (bins[0].rects.length !== rectsToPack.length) {
    throw Error(`images: expected every image to be packed (${bins.length} of ${rectsToPack.length})`);
  }

  const bin = bins[0];
  
  // Create metadata
  /** @type {Geomorph.ObstaclesSpriteSheet} */
  const json = ({ lookup: {} });
  bin.rects.forEach(r => {
    const { symbolKey, obstacleId, type } = /** @type {Geomorph.SymbolObstacleContext} */ (r.data);
    json.lookup[`${symbolKey} ${obstacleId}`] = {
      x: toPrecision(r.x),
      y: toPrecision(r.y),
      width: r.width,
      height: r.height,
      symbolKey, obstacleId, type,
    }
  });
  fs.writeFileSync(obstaclesSpriteSheetJsonPath, stringify(json));

  // Create sprite-sheet
  const canvas = createCanvas(bin.width, bin.height);
  const ct = canvas.getContext('2d');
  
  for (const { x, y, width, height, symbolKey, obstacleId } of Object.values(json.lookup)) {
    // drawPolygons(ct, Poly.fromRect({ x, y, width, height }), ['red', null])

    // extract data-url PNG from SVG symbol
    // 🚧 draw polygonal masked image
    const symbolPath = path.resolve(symbolsDir, `${symbolKey}.svg`);
    const matched = fs.readFileSync(symbolPath).toString().match(/"data:image\/png(.*)"/);
    if (matched) {
      const dataUrl = matched[0].slice(1, -1);
      const image = await loadImage(dataUrl);
      const symbol = assets.symbols[symbolKey];
      const { rect: srcRect } = symbol.obstacles[obstacleId];
      srcRect.scale(1 / (worldScale * (symbol.isHull ? 1 : 0.2)));
      ct.drawImage(image, srcRect.x, srcRect.y, srcRect.width, srcRect.height, x, y, width, height);
      info(`images: drew ${symbolKey}`);
    } else {
      error(`${symbolPath}: expected data:image/png inside SVG symbol`);
    }
  }

  const pngPath = path.resolve(assets2dDir, `obstacles.png`);
  pngToProm[pngPath] = saveCanvasAsFile(canvas, pngPath);
}

/**
 * @param {import('canvas').CanvasRenderingContext2D} ct
 * @param {Geomorph.Layout['navDecomp']} navDecomp
 */
function debugDrawNav(ct, navDecomp) {
  const triangles = navDecomp.tris.map(tri => new Poly(tri.map(i => navDecomp.vs[i])));
  const navPoly = Poly.union(triangles);
  opts.debugNavPoly && drawPolygons(ct, navPoly, ['rgba(100, 100, 200, 0.4)', null]);
  opts.debugNavTris && drawPolygons(ct, triangles, [null, 'rgba(0, 0, 0, 0.3)', 0.02]);
}

/** @param {Geom.Meta} meta */
function extractObstacleDescriptor(meta) {
  for (const tag of ['table', 'chair', 'bed', 'shower', 'surface']) {
    if (meta[tag] === true) return tag;
  }
  return 'obstacle';
}
