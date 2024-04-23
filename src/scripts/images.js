/**
 * Create:
 * - floor images (one per geomorph)
 * - obstacle sprite-sheets (over all geomorphs)
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
import { info, warn } from '../npc-cli/service/generic';
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

const rectsToPack = /** @type {import("maxrects-packer").Rectangle[]} */ ([]);

const opts = {
  debugImage: true,
  debugNavPoly: true,
  debugNavTris: false,
  packedPadding: 2,
};

(async function main() {
  fs.mkdirSync(assets2dDir, { recursive: true }); // ensure output directory

  // const assets = geomorphService.deserializeAssets(JSON.parse(fs.readFileSync(assetsJson).toString()));
  const geomorphs = geomorphService.deserializeGeomorphs(JSON.parse(fs.readFileSync(geomorphsJson).toString()));
  const pngToProm = /** @type {{ [pngPath: string]: Promise<any> }} */ ({});

  await drawFloorImages(geomorphs, pngToProm);

  await drawObstacleSpritesheets(geomorphs, pngToProm);

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
 * @param {Geomorph.Geomorphs} geomorphs 
 * @param {{ [pngPath: string]: Promise<any> }} pngToProm 
 */
async function drawObstacleSpritesheets(geomorphs, pngToProm) {
  const layouts = Object.values(geomorphs.layout);

  for (const { key: gmKey, obstacles } of layouts) {
    const gmNumber = geomorphService.toGmNum[gmKey]
    for (const [obstacleId, { origPoly, symbolKey }] of obstacles.entries()) {
      const { rect } = origPoly;
      rect.precision(precision);
      addRectToPack(rect.width, rect.height, `gm ${gmNumber}: ${ansi.Purple}${JSON.stringify(origPoly.meta)} ${obstacleId}${ansi.Reset}`);
    }
  }

  const packer = new MaxRectsPacker(4096, 4096, opts.packedPadding, {
    pot: false,
    border: opts.packedPadding,
    // smart: false,
  });
  packer.addArray(rectsToPack);
  const { bins } = packer;

  if (bins.length !== 1) {// 🔔 support more than one sprite-sheet
    throw Error(`images: expected exactly one bin (${bins.length})`);
  } else if (bins[0].rects.length !== rectsToPack.length) {
    throw Error(`images: expected every image to be packed (${bins.length} of ${rectsToPack.length})`);
  }

  const bin = bins[0];
  const packedWidth = bin.width;
  const packedHeight = bin.height;
  
  // Metadata
  const json = /** @type {Geomorph.ObstaclesSpriteSheet} */ ({ lookup: {} });
  bin.rects.forEach(r => json.lookup[r.data.name] = {
    name: r.data.name,
    x: r.x, y: r.y, width: r.width, height: r.height,
  });
  fs.writeFileSync(obstaclesSpriteSheetJsonPath, stringify(json));

  // 🚧
  // Sprite-sheet
  
  // // Create PNG, WEBP
  // for (const [index, filename] of filenames.entries()) {
  //   const rect = assertDefined(bin.rects.find((x) => x.data.name === filenameToKey(filename)));
  //   const { svgContents, width, height } = metas[index];
  
  //   // transform SVG to specified dimension
  //   const $ = cheerio.load(svgContents);
  //   const svgEl = $('svg').first();
  //   svgEl.attr('width', `${width}`);
  //   svgEl.attr('height', `${height}`);
  //   const transformedSvgContents = svgEl.toString();
  
  //   // draw image via data url
  //   const dataUrl = `data:image/svg+xml;utf8,${transformedSvgContents}`;
  //   const image = await loadImage(dataUrl);
  //   ctxt.drawImage(image, rect.x, rect.y);
  // }
  // await saveCanvasAsFile(canvas, outputPngPath);
  // await runYarnScript('pngs-to-webp', outputPngPath);
}

/** @param {number} width @param {number} height @param {string} name */
function addRectToPack(width, height, name) {
  info(`images will pack:`, name, { width, height });
  const r = new Rectangle(width, height);
  r.data = { name };
  rectsToPack.push(r);
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
