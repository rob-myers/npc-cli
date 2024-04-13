/// <reference path="./deps.d.ts"/>
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';

import { ASSETS_JSON_FILENAME, GEOMORPHS_JSON_FILENAME } from './const';
import { runYarnScript, saveCanvasAsFile } from './service';
// sucrase-node needs relative paths
import { worldScale } from '../npc-cli/service/const';
import { geomorphService } from '../npc-cli/service/geomorph';

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const mediaDir = path.resolve(__dirname, "../../media");
const symbolsDir = path.resolve(mediaDir, "symbol");
const mapsDir = path.resolve(mediaDir, "map");
const assets2dDir = path.resolve(staticAssetsDir, "2d");

(async function main() {
  // ensure output directory
  fs.mkdirSync(assets2dDir, { recursive: true });

  const assets = geomorphService.deserializeAssets(
    JSON.parse(fs.readFileSync(path.resolve(staticAssetsDir, ASSETS_JSON_FILENAME)).toString())
  );
  const geomorphs = geomorphService.deserializeGeomorphs(
    JSON.parse(fs.readFileSync(path.resolve(staticAssetsDir, GEOMORPHS_JSON_FILENAME)).toString())
  );

  const canvas = createCanvas(0, 0);
  const ct = canvas.getContext('2d');

  const layouts = Object.values(geomorphs.layout);
  const pngToProm = /** @type {{ [pngFilename: string]: Promise<any> }} */ ({});

  for (const { key: gmKey, pngRect } of layouts) {
    // e.g. 1.5m --> 60sgu (Starship Geomorph Units)
    pngRect.scale(1 / worldScale);

    canvas.width = pngRect.width;
    canvas.height = pngRect.height;
    // 🚧
    ct.fillStyle = "red";
    ct.fillRect(0, 0, canvas.width, canvas.height);
    ct.fill();

    const debugImg = await loadImage(fs.readFileSync(path.resolve(staticAssetsDir, 'debug', `${gmKey}.png`)))
    ct.drawImage(debugImg, 0, 0);

    const pngPath = path.resolve(assets2dDir, `${gmKey}.floor.png`);
    pngToProm[pngPath] = saveCanvasAsFile(canvas, pngPath);
  }

  await Promise.all(Object.values(pngToProm));
  await runYarnScript('cwebp-fast', JSON.stringify({ files: Object.keys(pngToProm) }), '--webp=50', '--quality=90');

})();
