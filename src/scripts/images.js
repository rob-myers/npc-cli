/// <reference path="./deps.d.ts"/>
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';

import { ASSETS_JSON_FILENAME, DEV_EXPRESS_WEBSOCKET_PORT, GEOMORPHS_JSON_FILENAME } from './const';
import { runYarnScript, saveCanvasAsFile } from './service';

// sucrase-node needs relative paths
import { worldScale } from '../npc-cli/service/const';
import { warn } from '../npc-cli/service/generic';
import { drawPolygons } from '../npc-cli/service/dom';
import { geomorphService } from '../npc-cli/service/geomorph';
import { Poly } from '../npc-cli/geom';

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const mediaDir = path.resolve(__dirname, "../../media");
const symbolsDir = path.resolve(mediaDir, "symbol");
const mapsDir = path.resolve(mediaDir, "map");
const assets2dDir = path.resolve(staticAssetsDir, "2d");
const assetsJson = path.resolve(staticAssetsDir, ASSETS_JSON_FILENAME);
const geomorphsJson = path.resolve(staticAssetsDir, GEOMORPHS_JSON_FILENAME);
/** e.g. 1.5m --> 60sgu (Starship Geomorph Units) */
const worldToSgu = 1 / worldScale;
const sendDevEventUrl = `http://localhost:${DEV_EXPRESS_WEBSOCKET_PORT}/send-dev-event`;

const debugNavPoly = true;
const debugNavTris = false;

(async function main() {
  fs.mkdirSync(assets2dDir, { recursive: true }); // ensure output directory

  const assets = geomorphService.deserializeAssets(JSON.parse(fs.readFileSync(assetsJson).toString()));
  const geomorphs = geomorphService.deserializeGeomorphs(JSON.parse(fs.readFileSync(geomorphsJson).toString()));
  const layouts = Object.values(geomorphs.layout);

  const pngToProm = /** @type {{ [pngPath: string]: Promise<any> }} */ ({});

  for (const layout of layouts) {
    const { key: gmKey, pngRect, walls, navDecomp, hullPoly } = layout;

    const pngPath = path.resolve(assets2dDir, `${gmKey}.floor.png`);
    
    const canvas = createCanvas(0, 0);
    const ct = canvas.getContext('2d');
    canvas.width = pngRect.width * worldToSgu;
    canvas.height = pngRect.height * worldToSgu;
    
    ct.transform(worldToSgu, 0, 0, worldToSgu, -worldToSgu * pngRect.x, -worldToSgu * pngRect.y);

    drawPolygons(ct, hullPoly.map(x => x.clone().removeHoles()), ['white', null]);

    (debugNavPoly || debugNavTris) && drawPolygons(ct, navDecomp.tris.map(tri => new Poly(tri.map(i => navDecomp.vs[i]))), [
      debugNavPoly ? 'rgba(100, 100, 200, 0.4)' : null,
      debugNavTris ? 'rgba(0, 0, 0, 0.3)' : null, 0.02,
    ]);
    // drawPolygons(ct, walls, ['black', null]);
    drawPolygons(ct, walls, ['black', 'black', 0.04]);
    // 🚧

    ct.resetTransform();

    // debug
    ct.globalAlpha = 0.4;
    const debugImg = await loadImage(fs.readFileSync(path.resolve(staticAssetsDir, 'debug', `${gmKey}.png`)))
    ct.drawImage(debugImg, 0, 0);

    pngToProm[pngPath] = saveCanvasAsFile(canvas, pngPath);
  }

  await Promise.all(Object.values(pngToProm));

  await runYarnScript('cwebp-fast', JSON.stringify({ files: Object.keys(pngToProm) }), '--quality=50');

  fetch(sendDevEventUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "update-browser" }), // 🚧 specific event for images
  }).catch((e) => {
    warn(`POST ${sendDevEventUrl} failed: ${e.cause.code}`);
  });

})();
