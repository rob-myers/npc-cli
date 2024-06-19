/**
 * Usage:
 * ```sh
 * npm run assets
 * yarn assets
 * yarn assets-fast --all
 * yarn assets-fast --changedFiles=['/path/to/file/a', '/path/to/file/b']
 * yarn assets-fast --prePush
 * ```
 *
 * Generates:
 * - assets.json
 * - geomorphs.json
 * - floor images (one per gmKey)
 *   - 🚧 compute in browser instead?
 * - obstacles sprite-sheet
 * - decor sprite-sheet
 * - webp from png
 */
/// <reference path="./deps.d.ts"/>

import fs from "fs";
import path from "path";
import childProcess from "child_process";
import util from "util";
import getopts from 'getopts';
import stringify from "json-stringify-pretty-compact";
import { createCanvas, loadImage } from 'canvas';
import { MaxRectsPacker, Rectangle } from "maxrects-packer";

// relative urls for sucrase-node
import { Poly } from "../npc-cli/geom";
import { ASSETS_JSON_FILENAME, DEV_EXPRESS_WEBSOCKET_PORT, GEOMORPHS_JSON_FILENAME, DEV_ORIGIN } from "../const";
import { spriteSheetNonHullExtraScale, worldScale } from "../npc-cli/service/const";
import { hashText, info, keyedItemsToLookup, warn, debug, error, assertNonNull, hashJson, toPrecision } from "../npc-cli/service/generic";
import { geomorphService } from "../npc-cli/service/geomorph";
import { SymbolGraphClass } from "../npc-cli/graph/symbol-graph";
import { drawPolygons } from "../npc-cli/service/dom";
import { labelledSpawn, saveCanvasAsFile } from "./service";

const rawOpts = getopts(process.argv, {
  boolean: ['all', 'prePush'],
  string: ['changedFiles'],
});

const imgOpts = {
  debugImage: true,
  // debugImage: false,
  debugNavPoly: true,
  debugNavTris: false,
  packedPadding: 2,
};

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const assetsFilepath = path.resolve(staticAssetsDir, ASSETS_JSON_FILENAME);
const assetsScriptFilepath = __filename;
const geomorphServicePath = path.resolve(__dirname, '../npc-cli/service', 'geomorph.js');

const opts = (() => {
  /** @type {string[]} */
  const changedFiles = rawOpts.changedFiles ? JSON.parse(rawOpts.changedFiles) : [];
  return {
    /**
     * Try to update efficiently iff this is `false` i.e.
     * - option `--all` is false
     * - assets.json exists
     * - neither this script nor geomorphs.js are in `changedFiles`
     */
    all: (
      Boolean(rawOpts.all)
      || !fs.existsSync(assetsFilepath)
      || changedFiles.includes(assetsScriptFilepath)
      || changedFiles.includes(geomorphServicePath)
    ),
    /** When non-empty, files changed (added/modified/deleted) within {ms} @see assets-nodemon.js */
    changedFiles,
    /** Only use @see changedFiles when non-empty and --all unspecified  */
    detectChanges: !rawOpts.all && changedFiles.length > 0,
    /**
     * When about to push:
     * - ensure every webp.
     * - fail if any asset not committed.
     */
    prePush: Boolean(rawOpts.prePush),
  };
})();

info({ opts });

const mediaDir = path.resolve(__dirname, "../../media");
const mapsDir = path.resolve(mediaDir, "map");
const symbolsDir = path.resolve(mediaDir, "symbol");
const assets2dDir = path.resolve(staticAssetsDir, "2d");
const graphDir = path.resolve(mediaDir, "graph");
const decorDir = path.resolve(mediaDir, "decor");
const geomorphsFilepath = path.resolve(staticAssetsDir, GEOMORPHS_JSON_FILENAME);
const obstaclesPngPath = path.resolve(assets2dDir, `obstacles.png`);
const decorPngPath = path.resolve(assets2dDir, `decor.png`);
const symbolGraphVizPath = path.resolve(graphDir, `symbols-graph.dot`);
const sendDevEventUrl = `http://${DEV_ORIGIN}:${DEV_EXPRESS_WEBSOCKET_PORT}/send-dev-event`;
const worldToSgu = 1 / worldScale;
const dataUrlRegEx = /"data:image\/png(.*)"/;
const gitStaticAssetsRegex = new RegExp('^static/assets/');
const emptyStringHash = hashText('');

(async function main() {

  const prevAssets = /** @type {Geomorph.AssetsJson | null} */ (
    opts.all ? null : JSON.parse(fs.readFileSync(assetsFilepath).toString())
  );

  const prevObstaclesPng = prevAssets && fs.existsSync(obstaclesPngPath) ? await loadImage(obstaclesPngPath) : null;
  const prevDecorPng = prevAssets && fs.existsSync(decorPngPath) ? await loadImage(decorPngPath) : null;

  /** @type {Geomorph.AssetsJson} */
  const assetsJson = {
    meta: {},
    sheet: { obstacle: {}, decor: {}, obstacleDim: { width: 0, height: 0 }, decorDim: { width: 0, height: 0 } },
    symbols: /** @type {*} */ ({}),
    maps: {},
  };
  
  let svgSymbolFilenames = fs.readdirSync(symbolsDir).filter((x) => x.endsWith(".svg")).sort();

  if (opts.all) {
    info(`updating all symbols`);
  } else {// Avoid re-computing
    const prev = /** @type {Geomorph.AssetsJson} */ (prevAssets);
    svgSymbolFilenames = svgSymbolFilenames.filter(filename => {
      const symbolKey = /** @type {Geomorph.SymbolKey} */ (filename.slice(0, -".svg".length));
      assetsJson.symbols[symbolKey] = prev.symbols[symbolKey];
      assetsJson.meta[symbolKey] = prev.meta[symbolKey];
      return opts.changedFiles.includes(path.resolve(symbolsDir, filename));
    });
    info(`updating symbols: ${JSON.stringify(svgSymbolFilenames)}`);
  }

  //#region compute assets.json

  parseSymbols(assetsJson, svgSymbolFilenames);

  parseMaps(assetsJson);

  // 🚧 only two functions (instead of 4)
  createObstaclesSheetJson(assetsJson);
  const toDecorImg = await createDecorSheetJson(assetsJson, prevAssets, prevObstaclesPng);
  await drawObstaclesSheet(assetsJson, prevAssets, prevObstaclesPng);
  await drawDecorSheet(assetsJson, toDecorImg, prevAssets, prevDecorPng);

  //#endregion

  const changedSymbolAndMapKeys = Object.keys(assetsJson.meta).filter(
    key =>  assetsJson.meta[key].outputHash !== prevAssets?.meta[key]?.outputHash
  );
  info({ changedKeys: changedSymbolAndMapKeys });

  const assets = geomorphService.deserializeAssets(assetsJson);
  fs.writeFileSync(assetsFilepath, stringify(assetsJson));
  
  /** Compute flat symbols i.e. recursively unfold "symbols" folder. */
  // 🚧 reuse unchanged i.e. `changedSymbolAndMapKeys` unreachable
  const flattened = /** @type {Record<Geomorph.SymbolKey, Geomorph.FlatSymbol>} */ ({});
  const symbolGraph = SymbolGraphClass.from(assetsJson.symbols);
  const symbolsStratified = symbolGraph.stratify();
  // debug(util.inspect({ symbolsStratified }, false, 5))
  // Traverse stratified symbols from leaves to co-leaves,
  // creating `FlatSymbol`s via `flattenSymbol` and `instantiateFlatSymbol`
  symbolsStratified.forEach(level => level.forEach(({ id: symbolKey }) =>
    geomorphService.flattenSymbol(assets.symbols[symbolKey], flattened)
  ));
  // debug("stateroom--036--2x4", util.inspect(flattened["stateroom--036--2x4"], false, 5));
  // fs.writeFileSync(symbolGraphVizPath, symbolGraph.getGraphviz('symbolGraph'));

  const changedGmKeys = geomorphService.gmKeys.filter(gmKey => {
    const hullKey = geomorphService.toHullKey[gmKey];
    const hullNode = assertNonNull(symbolGraph.getNodeById(hullKey));
    return symbolGraph.getReachableNodes(hullNode).find(x => changedSymbolAndMapKeys.includes(x.id));
  });
  info({ changedGmKeys });

  /**
   * Compute geomorphs.json
   * 🚧 reuse unchanged i.e. `changedSymbolAndMapKeys` unreachable
   */
  const layout = keyedItemsToLookup(geomorphService.gmKeys.map(gmKey => {
    const hullKey = geomorphService.toHullKey[gmKey];
    const flatSymbol = flattened[hullKey];
    return geomorphService.createLayout(gmKey, flatSymbol, assets);
  }));

  const mapsHash = hashJson(assetsJson.maps);
  const layoutsHash = hashJson(layout);
  const sheetsHash = hashJson(assetsJson.sheet);
  const hash = `${mapsHash} ${layoutsHash} ${sheetsHash}`;

  /** @type {Geomorph.Geomorphs} */
  const geomorphs = {
    hash,
    mapsHash,
    layoutsHash,
    sheetsHash,
    map: assetsJson.maps,
    layout,
    sheet: assetsJson.sheet,
  };

  fs.writeFileSync(geomorphsFilepath, stringify(geomorphService.serializeGeomorphs(geomorphs)));

  /** Draw geomorph floors */
  await drawFloorImages(geomorphs, changedGmKeys);

  /**
   * Tell the browser we're ready.
   * In development we use PNG (not WEBP) to avoid HMR delay.
   */
  fetch(sendDevEventUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "update-browser" }),
  }).catch((e) => {
    warn(`POST ${sendDevEventUrl} failed: ${e.cause.code}`);
  });

  /** Convert PNGs to WEBP for production. */
  let pngPaths = [
    ...geomorphService.gmKeys.map(getFloorPngPath), // 🚧 remove
    obstaclesPngPath,
    decorPngPath,
  ];
  if (!opts.prePush) {
    // Only convert PNG if (i) lacks a WEBP, or (ii) has an "older one"
    pngPaths = pngPaths.filter(pngPath =>
      fs.statSync(pngPath).mtimeMs
      > (fs.statSync(`${pngPath}.webp`, { throwIfNoEntry: false })?.mtimeMs ?? 0)
    );
  }
  pngPaths.length && await labelledSpawn('cwebp',
    'yarn', 'cwebp-fast', JSON.stringify({ files: pngPaths }), '--quality=50',
  );

  if (opts.prePush) {
    /**
     * Fail if any asset not committed.
     */
    const [modifiedPaths, untrackedPaths, stagedPaths] = [
      `git diff --name-only`,
      `git ls-files --others --exclude-standard`,
      `git diff --name-only --cached`,
    ].map(cmd =>
      `${childProcess.execSync(cmd)}`.trim().split(/\n/)
      .filter(x => x.match(gitStaticAssetsRegex))
    );

    if (modifiedPaths.concat(untrackedPaths, stagedPaths).length) {
      error('Please commit static/assets/*', { modifiedPaths, untrackedPaths, stagedPaths });
      process.exit(1);
    }
  }

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
    meta[symbolKey] = {
      outputHash: hashJson(serialized),
      // 🔔 emptyStringHash when data-url not found
      pngHash: hashText(contents.match(dataUrlRegEx)?.[0] ?? ''),
      obsHashes: parsed.obstacles.length ? parsed.obstacles.map(x => hashJson(x)) : undefined,
    };
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
 */
async function drawFloorImages(geomorphs, gmKeys) {
  const changedLayouts = Object.values(geomorphs.layout).filter(({ key }) => gmKeys.includes(key));
  const promises = /** @type {Promise<any>[]} */ ([]);

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

    promises.push(saveCanvasAsFile(canvas, getFloorPngPath(gmKey)));
  }

  await Promise.all(promises);
}

/**
 * @param {Geomorph.AssetsJson} assets
 */
function createObstaclesSheetJson(assets) {

  // Each one of a symbol's obstacles induces a respective packed rect
  const obstacleKeyToRect = /** @type {Record<`${Geomorph.SymbolKey} ${number}`, Rectangle>} */ ({});
  for (const { key: symbolKey, obstacles, isHull } of Object.values(assets.symbols)) {
    /** World coords -> Starship Geomorph coords, modulo additonal scale in [1, 5] non-hull symbols. */
    const worldToSguScaled = (1 / worldScale) * (isHull ? 1 : spriteSheetNonHullExtraScale);

    for (const [obstacleId, poly] of obstacles.entries()) {
      const rect = Poly.from(poly).rect.scale(worldToSguScaled).precision(0); // width, height integers
      const [width, height] = [rect.width, rect.height]
      
      const r = new Rectangle(width, height);
      /** @type {Geomorph.ObstacleSheetRectCtxt} */
      const rectData = { symbolKey, obstacleId, type: extractObstacleDescriptor(poly.meta) };
      r.data = rectData;
      obstacleKeyToRect[`${symbolKey} ${obstacleId}`] = r;
      // info(`images will pack ${ansi.BrightYellow}${JSON.stringify({ ...rectData, width, height })}${ansi.Reset}`);
    }
  }

  const bin = packRectangles(Object.values(obstacleKeyToRect), 'createObstaclesSheetJson');
  
  /** @type {Pick<Geomorph.SpriteSheet, 'obstacle' | 'obstacleDim'>} */
  const json = ({ obstacle: {}, obstacleDim: { width: bin.width, height: bin.height } });
  // ℹ️ can try forcing 4096 x 4096 to debug sprite-sheet hmr
  // const json = ({ obstacle: {}, obstaclesHeight: 4096, obstaclesWidth: 4096 });
  bin.rects.forEach(r => {
    const { symbolKey, obstacleId, type } = /** @type {Geomorph.ObstacleSheetRectCtxt} */ (r.data);
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
  assets.sheet = { ...assets.sheet, ...json };
}

/**
 * @param {Geomorph.AssetsJson} assets
 * @param {Geomorph.AssetsJson | null} prevAssets
 * @param {import('canvas').Image | null} prevDecorPng
 * @returns {Promise<Record<string, import('canvas').Image>>}
 */
async function createDecorSheetJson(assets, prevAssets, prevDecorPng) {

  if (prevAssets && prevDecorPng && opts.detectChanges && !opts.changedFiles.some(x => x.startsWith(decorDir))) {
    assets.sheet.decor = prevAssets.sheet.decor;
    assets.sheet.decorDim = prevAssets.sheet.decorDim;
    return {};
  }

  const pngBasenames = fs.readdirSync(decorDir).filter((x) => x.endsWith(".png")).sort();
  const changedBasenames = prevAssets && opts.detectChanges
    ? pngBasenames.filter(x => opts.changedFiles.includes(x) || !(x in prevAssets.sheet.decor))
    : pngBasenames;

  const baseNameToRect = /** @type {Record<string, Rectangle>} */ ({});
  const baseNameToImg = /** @type {Record<string, import('canvas').Image>} */ ({});
  const prevDecorSheet = prevAssets?.sheet.decor;

  for (const baseName of pngBasenames) {
    if (changedBasenames.includes(baseName)) {
      const tags = baseName.split('-').slice(0, -1); // ignore e.g. `001.png`
      const meta = tags.reduce((agg, tag) => { agg[tag] = true; return agg; }, /** @type {Geom.Meta} */ ({}));
      const img = await loadImage(path.resolve(decorDir, baseName));
      const rect = new Rectangle(img.width, img.height);
      /** @type {Geomorph.DecorSheetRectCtxt} */
      const rectData = { ...meta, fileKey: baseName };
      rect.data = rectData;
      baseNameToRect[baseName] = rect;
      baseNameToImg[baseName] = img;
    } else {
      const { x: _, y: __, ...meta } = /** @type {Geomorph.DecorSheet} */ (prevDecorSheet)[baseName];
      const rect = new Rectangle(meta.width, meta.height);
      rect.data = { ...meta, fileKey: baseName };
      baseNameToRect[baseName] = rect;
    }
  }

  const bin = packRectangles(Object.values(baseNameToRect), 'createDecorSheetJson');

  /** @type {Pick<Geomorph.SpriteSheet, 'decor' | 'decorDim'>} */
  const json = ({ decor: {}, decorDim: { width: bin.width, height: bin.height } });
  bin.rects.forEach(r => {
    const meta = /** @type {Geomorph.DecorSheetRectCtxt} */ (r.data);
    json.decor[meta.fileKey] = { ...meta, x: toPrecision(r.x), y: toPrecision(r.y), width: r.width, height: r.height };
  });

  assets.sheet = { ...assets.sheet, ...json };

  return baseNameToImg; // can be partial
}

/**
 * @param {Geomorph.AssetsJson} assets
 * @param {Geomorph.AssetsJson | null} prevAssets
 * @param {import('canvas').Image | null} prevObstaclesPng
 * @returns {Promise<boolean>} Return true iff changed i.e. had to (re)draw
 */
async function drawObstaclesSheet(assets, prevAssets, prevObstaclesPng) {
  
  const { obstacle, obstacleDim } = assets.sheet;
  const obstacles = Object.values(obstacle);
  const ct = createCanvas(obstacleDim.width, obstacleDim.height).getContext('2d');

  // 🚧 redraw all obstacles when:
  // - opts.all ✅ (prevAssets necessarily `null`)
  // - this file changed (?)
  const { changed: changedObstacles, removed: removedObstacles } = detectChangedObstacles(
    obstacles,
    assets,
    prevObstaclesPng ? prevAssets : null,
  );
  
  info({ changedObstacles, removedObstacles });

  if (changedObstacles.size === 0 && removedObstacles.size === 0) {
    return false;
  }

  for (const { x, y, width, height, symbolKey, obstacleId } of obstacles) {
    if (assets.meta[symbolKey].pngHash !== emptyStringHash) {
      const symbol = assets.symbols[symbolKey];
      const scale = (1 / worldScale) * (symbol.isHull ? 1 : spriteSheetNonHullExtraScale);
      
      const srcPoly = Poly.from(symbol.obstacles[obstacleId]);
      const srcRect = srcPoly.rect;
      const srcPngRect = srcPoly.rect.delta(-symbol.pngRect.x, -symbol.pngRect.y).scale(1 / (worldScale * (symbol.isHull ? 1 : 0.2)));
      const dstPngPoly = srcPoly.clone().translate(-srcRect.x, -srcRect.y).scale(scale).translate(x, y);

      if (!changedObstacles.has(`${symbolKey} ${obstacleId}`)) {
        // info(`${symbolKey} ${obstacleId} obstacle did not change`);
        const prev = /** @type {Geomorph.AssetsJson} */ (prevAssets).sheet.obstacle[`${symbolKey} ${obstacleId}`];
        ct.drawImage(/** @type {import('canvas').Image} */ (prevObstaclesPng),
          prev.x, prev.y, prev.width, prev.height,
          x, y, width, height,
        );
      } else {
        info(`${symbolKey} ${obstacleId} redrawing...`);
        const symbolPath = path.resolve(symbolsDir, `${symbolKey}.svg`);
        const matched = fs.readFileSync(symbolPath).toString().match(dataUrlRegEx);
        const dataUrl = assertNonNull(matched)[0].slice(1, -1);
        const image = await loadImage(dataUrl);
        ct.save();
        drawPolygons(ct, dstPngPoly, ['white', null], 'clip');
        ct.drawImage(image, srcPngRect.x, srcPngRect.y, srcPngRect.width, srcPngRect.height, x, y, width, height);
        ct.restore();
      }

    } else {
      error(`${symbolKey}.svg: expected data:image/png inside SVG symbol`);
    }
  }

  await saveCanvasAsFile(ct.canvas, obstaclesPngPath);
  return true;
}

/**
 * @param {Geomorph.AssetsJson} assets
 * @param {Record<string, import('canvas').Image>} fileKeyToImage
 * @param {Geomorph.AssetsJson | null} prevAssets
 * @param {import('canvas').Image | null} prevDecorPng
 * @returns {Promise<boolean>} Return true iff changed i.e. had to (re)draw
 */
async function drawDecorSheet(assets, fileKeyToImage, prevAssets, prevDecorPng) {
  const { decor, decorDim } = assets.sheet;
  const decors = Object.values(decor);
  const ct = createCanvas(decorDim.width, decorDim.height).getContext('2d');
  const prevDecor = prevAssets?.sheet.decor;
  
  for (const { x, y, width, height, fileKey } of decors) {
    const image = fileKeyToImage[fileKey];
    if (image) {
      ct.drawImage(image, 0, 0, image.width, image.height, x, y, width, height);
    } else {// assume image available in previous sprite-sheet
      const prevRect = /** @type {Geomorph.DecorSheet} */ (prevDecor)[fileKey];
      ct.drawImage(/** @type {import('canvas').Image} */ (prevDecorPng),
        prevRect.x, prevRect.y, prevRect.width, prevRect.height,
        x, y, width, height,
      );
    }
  }

  await saveCanvasAsFile(ct.canvas, decorPngPath);
  return true;
}

/**
 * Uses special hashes constructed in `assets.meta`.
 * @param {Geomorph.SpriteSheet['obstacle'][*][]} obstacles
 * @param {Geomorph.AssetsJson} assets
 * @param {Geomorph.AssetsJson | null} prevAssets
 * @returns {Record<'changed' | 'removed', Set<`${Geomorph.SymbolKey} ${number}`>>}
 */
function detectChangedObstacles(obstacles, assets, prevAssets) {
  if (prevAssets) {
    const changed = /** @type {Set<`${Geomorph.SymbolKey} ${number}`>} */ (new Set);
    const removed = new Set(Object.values(prevAssets.sheet.obstacle).map(geomorphService.symbolObstacleToKey));
    const [currMeta, prevMeta] = [assets.meta, prevAssets.meta];
    obstacles.forEach(({ symbolKey, obstacleId }) => {
      const key = geomorphService.symbolObstacleToKey({ symbolKey, obstacleId });
      removed.delete(key);
      // optional-chaining in case symbol is new
      (currMeta[symbolKey].pngHash !== prevMeta[symbolKey]?.pngHash
        || currMeta[symbolKey].obsHashes?.[obstacleId] !== prevMeta[symbolKey].obsHashes?.[obstacleId]
      ) && changed.add(key);
    });
    return { changed, removed };
  } else {
    return {
      changed: new Set(obstacles.map(geomorphService.symbolObstacleToKey)),
      removed: new Set(),
    };
  }
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

/** @param {Geomorph.GeomorphKey} gmKey */
function getFloorPngPath(gmKey) {
  return path.resolve(assets2dDir, `${gmKey}.floor.png`);
}

/**
 * @param {Rectangle[]} rectsToPack
 * @param {string} errorPrefix
 */
function packRectangles(rectsToPack, errorPrefix) {
  const packer = new MaxRectsPacker(4096, 4096, imgOpts.packedPadding, {
    pot: false,
    border: imgOpts.packedPadding,
    // smart: false,
  });
  packer.addArray(rectsToPack);
  const { bins } = packer;

  if (bins.length !== 1) {// 🔔 support more than one sprite-sheet
    // warn(`images: expected exactly one bin (${bins.length})`);
    throw Error(`${errorPrefix}: expected exactly one bin (${bins.length})`);
  } else if (bins[0].rects.length !== rectsToPack.length) {
    throw Error(`${errorPrefix}: expected every image to be packed (${bins.length} of ${rectsToPack.length})`);
  }

  return bins[0];
}
