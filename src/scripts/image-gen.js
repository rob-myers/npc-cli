/// <reference path="./deps.d.ts"/>
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';

import { ASSETS_META_JSON_FILENAME, GEOMORPHS_JSON_FILENAME } from './const';
import { saveCanvasAsFile } from './service';
import { worldScale } from '../npc-cli/service/const'; // sucrase-node needs relative paths
import { geomorphService } from '../npc-cli/service/geomorph';

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const mediaDir = path.resolve(__dirname, "../../media");
const symbolsDir = path.resolve(mediaDir, "symbol");
const mapsDir = path.resolve(mediaDir, "map");
const outputDir = path.resolve(staticAssetsDir, "2d");

(async function main() {

  // ensure output directory
  fs.mkdirSync(outputDir, { recursive: true });

  const assets = geomorphService.deserializeAssets(
    JSON.parse(fs.readFileSync(path.resolve(staticAssetsDir, ASSETS_META_JSON_FILENAME)).toString())
  );
  const geomorphs = geomorphService.deserializeGeomorphs(
    JSON.parse(fs.readFileSync(path.resolve(staticAssetsDir, GEOMORPHS_JSON_FILENAME)).toString())
  );

  // 🚧 png + webp
  const canvas = createCanvas(0, 0);
  const ct = canvas.getContext('2d');

  const layouts = Object.values(geomorphs.layout);

  for (const { key: gmKey, pngRect } of layouts) {

    // e.g. 1.5m --> 60sgu (Starship Geomorph Units)
    pngRect.scale(1 / worldScale);

    canvas.width = pngRect.width;
    canvas.height = pngRect.height;
    ct.fillStyle = "red";
    ct.fillRect(0, 0, canvas.width, canvas.height);
    ct.fill();

    const debugImg = await loadImage(fs.readFileSync(path.resolve(staticAssetsDir, 'debug', `${gmKey}.png`)))
    ct.drawImage(debugImg, 0, 0);

    saveCanvasAsFile(canvas, path.resolve(outputDir, `${gmKey}.floor.png`));
  }


})();