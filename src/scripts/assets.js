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
 * - obstacles sprite-sheet (using media/symbol/*.svg)
 * - decor sprite-sheet (using media/decor/*.svg)
 * - npc textures (using media/npc/*.tex.svg)
 * - webp from png
 */
/// <reference path="./deps.d.ts"/>

import fs from "fs";
import path from "path";
import childProcess from "child_process";
import getopts from 'getopts';
import stringify from "json-stringify-pretty-compact";
import { createCanvas, loadImage } from 'canvas';
import PQueue from "p-queue-compat";

// relative urls for sucrase-node
import { Poly } from "../npc-cli/geom";
import { spriteSheetSymbolExtraScale, worldToSguScale, spriteSheetDecorExtraScale, sguSymbolScaleDown, sguSymbolScaleUp } from "../npc-cli/service/const";
import { hashText, info, keyedItemsToLookup, warn, debug, error, assertNonNull, hashJson, toPrecision, mapValues, } from "../npc-cli/service/generic";
import { drawPolygons } from "../npc-cli/service/dom";
import { geomorph } from "../npc-cli/service/geomorph";
import { DEV_EXPRESS_WEBSOCKET_PORT, DEV_ORIGIN, ASSETS_JSON_FILENAME, GEOMORPHS_JSON_FILENAME } from "../npc-cli/service/fetch-assets";
import packRectangles from "../npc-cli/service/rects-packer";
import { SymbolGraphClass } from "../npc-cli/graph/symbol-graph";
import { helper } from "../npc-cli/service/helper";
import { labelledSpawn, saveCanvasAsFile, tryLoadImage, tryReadString } from "./service";

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

function computeOpts() {
  /** @type {string[]} */
  const changedFiles = rawOpts.changedFiles ? JSON.parse(rawOpts.changedFiles) : [];
  const all = (
    Boolean(rawOpts.all)
    || !fs.existsSync(assetsFilepath)
    || changedFiles.includes(assetsScriptFilepath)
    || changedFiles.includes(geomorphServicePath)
  );
  const changedDecorBaseNames = changedFiles.flatMap(x =>
    x.startsWith(decorDir) ? path.basename(x) : []
  );
  return {
    /**
     * We'll update efficiently <=> this is `false` i.e.
     * - no `--all`
     * - assets.json exists
     * - neither this script nor geomorphs.js are in `changedFiles`
     */
    all,
    /** When non-empty, files changed (added/modified/deleted) within {ms}, see `assets-nodemon.js` */
    changedFiles,
    /** Restriction of @see changedFiles to decor SVG baseNames */
    changedDecorBaseNames,
    /** Only use @see changedFiles when non-empty and !opts.all  */
    detectChanges: !all && changedFiles.length > 0,
    /**
     * When about to push:
     * - ensure every webp
     * - fail if any asset not committed
     */
    prePush: Boolean(rawOpts.prePush),
  };
}

/** @returns {Promise<Prev>} */
async function computePrev() {
  const [prevAssetsStr, obstaclesPng, decorPng, npcTexMetas] = await Promise.all([
    !opts.all ? tryReadString(assetsFilepath) : null,
    tryLoadImage(obstaclesPngPath),
    tryLoadImage(decorPngPath),
    getNpcTextureMetas(),
  ]);
  const prevAssets = /** @type {Geomorph.AssetsJson | null} */ (JSON.parse(prevAssetsStr ?? 'null'));
  const skipPossible = !opts.all && opts.detectChanges;
  return {
    assets: prevAssets,
    obstaclesPng,
    decorPng,
    npcTexMetas,
    skipMaps: skipPossible && !opts.changedFiles.some(x => x.startsWith(mapsDir)),
    skipObstacles: skipPossible && !!obstaclesPng && !opts.changedFiles.some(x => x.startsWith(symbolsDir)),
    skipDecor: skipPossible && !!decorPng && !opts.changedFiles.some(x => x.startsWith(decorDir)),
    skipNpcTex: skipPossible && npcTexMetas.every(x => x.canSkip) && !opts.changedFiles.some(x => x.startsWith(npcDir)),
  };
}

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const assetsFilepath = path.resolve(staticAssetsDir, ASSETS_JSON_FILENAME);
const assetsScriptFilepath = __filename;
const geomorphServicePath = path.resolve(__dirname, '../npc-cli/service', 'geomorph.js');
const mediaDir = path.resolve(__dirname, "../../media");
const mapsDir = path.resolve(mediaDir, "map");
const symbolsDir = path.resolve(mediaDir, "symbol");
const assets2dDir = path.resolve(staticAssetsDir, "2d");
const assets3dDir = path.resolve(staticAssetsDir, "3d");
const graphDir = path.resolve(mediaDir, "graph");
const decorDir = path.resolve(mediaDir, "decor");
const npcDir = path.resolve(mediaDir, "npc");
const geomorphsFilepath = path.resolve(staticAssetsDir, GEOMORPHS_JSON_FILENAME);
const obstaclesPngPath = path.resolve(assets2dDir, `obstacles.png`);
const decorPngPath = path.resolve(assets2dDir, `decor.png`);
const symbolGraphVizPath = path.resolve(graphDir, `symbols-graph.dot`);
const sendDevEventUrl = `http://${DEV_ORIGIN}:${DEV_EXPRESS_WEBSOCKET_PORT}/send-dev-event`;
const dataUrlRegEx = /"data:image\/png(.*)"/;
const gitStaticAssetsRegex = new RegExp('^static/assets/');
const emptyStringHash = hashText('');

const opts = computeOpts();
info({ opts });

(async function main() {

  const prev = await computePrev();

  const [symbolBaseNames, mapBaseNames] = await Promise.all([
    fs.promises.readdir(symbolsDir).then(xs => xs.filter((x) => x.endsWith(".svg")).sort()),
    fs.promises.readdir(mapsDir).then(xs => xs.filter((x) => x.endsWith(".svg")).sort()),
  ]);

  const symbolBaseNamesToUpdate = opts.all
    ? symbolBaseNames
    : symbolBaseNames.filter(x => opts.changedFiles.includes(path.resolve(symbolsDir, x)))
  ;

  /** @type {Geomorph.AssetsJson} The next assets.json */
  const assetsJson = {
    meta: {},
    sheet: {
      obstacle: {}, decor: /** @type {*} */ ({}),
      obstacleDim: { width: 0, height: 0 }, decorDim: { width: 0, height: 0 },
      imagesHash: 0,
      skins: { svgHash: {} },
    },
    symbols: /** @type {*} */ ({}), maps: {},
  };

  if (prev.assets) {// use previous (may overwrite later)
    const { symbols, meta } = prev.assets;
    symbolBaseNames.forEach(baseName => {
      const symbolKey = /** @type {Geomorph.SymbolKey} */ (baseName.slice(0, -".svg".length));
      assetsJson.symbols[symbolKey] = symbols[symbolKey];
      assetsJson.meta[symbolKey] = meta[symbolKey];
    });
    mapBaseNames.forEach(baseName => {
      const mapKey = baseName.slice(0, -".svg".length);
      assetsJson.meta[mapKey] = meta[mapKey];
    });
    assetsJson.maps = prev.assets.maps;
    assetsJson.sheet = prev.assets.sheet;
  }

  //#region ℹ️ Compute assets.json and sprite-sheets

  if (symbolBaseNamesToUpdate.length) {
    info(`parsing ${symbolBaseNamesToUpdate.length === symbolBaseNames.length
      ? `all symbols`
      : `symbols: ${JSON.stringify(symbolBaseNamesToUpdate)}`
    }`);
    parseSymbols(assetsJson, symbolBaseNamesToUpdate);
  } else {
    info('skipping all symbols');
  }

  if (!prev.skipMaps) {
    info('parsing maps');
    parseMaps(assetsJson, mapBaseNames);
  } else {
    info('skipping maps');
  }

  if (!prev.skipObstacles) {
    info('creating obstacles sprite-sheet');
    createObstaclesSheetJson(assetsJson);
    await drawObstaclesSheet(assetsJson, prev);
  } else {
    info('skipping obstacles sprite-sheet');
  }

  if (!prev.skipDecor) {
    info('creating decor sprite-sheet');
    const toDecorImg = await createDecorSheetJson(assetsJson, prev);
    await drawDecorSheet(assetsJson, toDecorImg, prev);
  } else {
    info('skipping decor sprite-sheet');
  }

  if (!prev.skipNpcTex) {
    info('creating npc textures');
    await createNpcTextures(assetsJson, prev);
  } else {
    info('skipping npc textures');
  }

  const changedSymbolAndMapKeys = Object.keys(assetsJson.meta).filter(
    key => assetsJson.meta[key].outputHash !== prev.assets?.meta[key]?.outputHash
  );
  info({ changedKeys: changedSymbolAndMapKeys });

  // hash sprite-sheet PNGs (including skins lastModified)
  assetsJson.sheet.imagesHash =
    prev.skipObstacles && prev.skipDecor && assetsJson.sheet.imagesHash
      ? assetsJson.sheet.imagesHash
      : hashJson([obstaclesPngPath, decorPngPath].map(x => fs.readFileSync(x).toString())
    )
  ;

  fs.writeFileSync(assetsFilepath, stringify(assetsJson));
  //#endregion

  //#region ℹ️ Compute geomorphs.json
  
  /** @see assetsJson where e.g. rects and polys are `Rect`s and `Poly`s */
  const assets = geomorph.deserializeAssets(assetsJson);

  /** Compute flat symbols i.e. recursively unfold "symbols" folder. */
  // 🚧 reuse unchanged i.e. `changedSymbolAndMapKeys` unreachable
  const flattened = /** @type {Record<Geomorph.SymbolKey, Geomorph.FlatSymbol>} */ ({});
  const symbolGraph = SymbolGraphClass.from(assetsJson.symbols);
  const symbolsStratified = symbolGraph.stratify();
  // debug(util.inspect({ symbolsStratified }, false, 5))

  // Traverse stratified symbols from leaves to co-leaves,
  // creating `FlatSymbol`s via `flattenSymbol` and `instantiateFlatSymbol`
  symbolsStratified.forEach(level => level.forEach(({ id: symbolKey }) =>
    geomorph.flattenSymbol(assets.symbols[symbolKey], flattened)
  ));
  // debug("stateroom--036--2x4", util.inspect(flattened["stateroom--036--2x4"], false, 5));

  // fs.writeFileSync(symbolGraphVizPath, symbolGraph.getGraphviz('symbolGraph'));

  const changedGmKeys = geomorph.gmKeys.filter(gmKey => {
    const hullKey = helper.toHullKey[gmKey];
    const hullNode = assertNonNull(symbolGraph.getNodeById(hullKey));
    return symbolGraph.getReachableNodes(hullNode).find(x => changedSymbolAndMapKeys.includes(x.id));
  });
  info({ changedGmKeys });

  /** @type {Record<Geomorph.GeomorphKey, Geomorph.Layout>} */
  const layout = keyedItemsToLookup(geomorph.gmKeys.map(gmKey => {
    const hullKey = helper.toHullKey[gmKey];
    const flatSymbol = flattened[hullKey];
    return geomorph.createLayout(gmKey, flatSymbol, assets);
  }));
  const layoutJson = mapValues(layout, geomorph.serializeLayout);


  /** @type {Geomorph.GeomorphsJson} */
  const geomorphs = {
    map: assetsJson.maps,
    layout: layoutJson,
    sheet: assetsJson.sheet,
  };

  fs.writeFileSync(geomorphsFilepath, stringify(geomorphs));

  //#endregion

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

  //#region ℹ️ png -> webp for production

  let pngPaths = [
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

  //#endregion

})();

/**
 * @param {Geomorph.AssetsJson} output
 * @param {string[]} mapBasenames
 */
function parseMaps({ meta, maps }, mapBasenames) {
  for (const baseName of mapBasenames) {
    const filePath = path.resolve(mapsDir, baseName);
    const contents = fs.readFileSync(filePath).toString();
    const mapKey = baseName.slice(0, -".svg".length);
    maps[mapKey] = geomorph.parseMap(mapKey, contents);
    meta[mapKey] = { outputHash: hashText(stringify(maps[mapKey])) };
  }
}

/**
 * @param {Geomorph.AssetsJson} output
 * @param {string[]} symbolBasenames
 */
function parseSymbols({ symbols, meta }, symbolBasenames) {
  for (const baseName of symbolBasenames) {
    const filePath = path.resolve(symbolsDir, baseName);
    const contents = fs.readFileSync(filePath).toString();
    const symbolKey = /** @type {Geomorph.SymbolKey} */ (baseName.slice(0, -".svg".length));

    const parsed = geomorph.parseSymbol(symbolKey, contents);
    const serialized = geomorph.serializeSymbol(parsed);
    symbols[symbolKey] = serialized;
    meta[symbolKey] = {
      outputHash: hashJson(serialized),
      // 🔔 emptyStringHash when data-url not found
      pngHash: hashText(contents.match(dataUrlRegEx)?.[0] ?? ''),
      obsHashes: parsed.obstacles.length ? parsed.obstacles.map(x => hashJson(x)) : undefined,
    };
  }

  validateSubSymbolDimensions(symbols);
}

/**
 * @param {Geomorph.AssetsJson['symbols']} symbols 
 */
function validateSubSymbolDimensions(symbols) {
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
 * @param {Geomorph.AssetsJson} assets
 */
function createObstaclesSheetJson(assets) {

  // Each one of a symbol's obstacles induces a respective packed rect
  const obstacleKeyToRect = /** @type {Record<`${Geomorph.SymbolKey} ${number}`, { width: number; height: Number; data: Geomorph.ObstacleSheetRectCtxt }>} */ ({});
  for (const { key: symbolKey, obstacles, isHull } of Object.values(assets.symbols)) {
    /** World coords -> Starship Geomorph coords, modulo additional scale in [1, 5] */
    const scale = worldToSguScale * spriteSheetSymbolExtraScale;

    for (const [obstacleId, poly] of obstacles.entries()) {
      const rect = Poly.from(poly).rect.scale(scale).precision(0); // width, height integers
      const [width, height] = [rect.width, rect.height]
      obstacleKeyToRect[`${symbolKey} ${obstacleId}`] = {
        width, height, data: { symbolKey, obstacleId, type: extractObstacleDescriptor(poly.meta) },
      };
      // info(`images will pack ${ansi.BrightYellow}${JSON.stringify({ ...rectData, width, height })}${ansi.Reset}`);
    }
  }

  const bin = packRectangles(Object.values(obstacleKeyToRect), { logPrefix: 'createObstaclesSheetJson', packedPadding: imgOpts.packedPadding });
  
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

  assets.sheet = { ...assets.sheet, ...json }; // Overwrite initial/previous
}

/**
 * @param {Geomorph.AssetsJson} assets
 * @param {Prev} prev
 */
async function drawObstaclesSheet(assets, prev) {
  
  const { obstacle, obstacleDim } = assets.sheet;
  const obstacles = Object.values(obstacle);
  const ct = createCanvas(obstacleDim.width, obstacleDim.height).getContext('2d');

  const { changed: changedObstacles, removed: removedObstacles } = detectChangedObstacles(obstacles, assets, prev);
  info({ changedObstacles, removedObstacles });

  if (changedObstacles.size === 0 && removedObstacles.size === 0) {
    return;
  }

  for (const { x, y, width, height, symbolKey, obstacleId } of obstacles) {
    if (assets.meta[symbolKey].pngHash !== emptyStringHash) {
      const symbol = assets.symbols[symbolKey];
      const scale = worldToSguScale * spriteSheetSymbolExtraScale;
      
      const srcPoly = Poly.from(symbol.obstacles[obstacleId]);
      const srcRect = srcPoly.rect;
      // 🔔 must use smaller src rect for hull symbols, because <img> is smaller
      const srcPngRect = srcPoly.rect.delta(-symbol.pngRect.x, -symbol.pngRect.y).scale(worldToSguScale * (symbol.isHull ? 1 : sguSymbolScaleUp));
      const dstPngPoly = srcPoly.clone().translate(-srcRect.x, -srcRect.y).scale(scale).translate(x, y);

      if (!changedObstacles.has(`${symbolKey} ${obstacleId}`)) {
        // info(`${symbolKey} ${obstacleId} obstacle did not change`);
        const prevObs = /** @type {Geomorph.AssetsJson} */ (prev.assets).sheet.obstacle[`${symbolKey} ${obstacleId}`];
        ct.drawImage(/** @type {import('canvas').Image} */ (prev.obstaclesPng),
          prevObs.x, prevObs.y, prevObs.width, prevObs.height,
          x, y, width, height,
        );
      } else {
        info(`${symbolKey} ${obstacleId} redrawing...`);
        const symbolPath = path.resolve(symbolsDir, `${symbolKey}.svg`);
        const matched = fs.readFileSync(symbolPath).toString().match(dataUrlRegEx);
        /**
         * 🔔 <img> of hull symbols are currently 1/5 size of symbol.
         * 🔔 Consider larger image, or avoid using as source for obstacles.
         */
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
}

/**
 * @param {Geomorph.AssetsJson} assets
 * @param {Prev} prev
 * @returns {Promise<{ [key in Geomorph.DecorImgKey]?: import('canvas').Image }>}
 */
async function createDecorSheetJson(assets, prev) {
  /** `media/decor/{baseName}` for SVGs corresponding to decorImgKeys */
  const svgBasenames = fs.readdirSync(decorDir).filter((baseName) => {
    if (!baseName.endsWith(".svg")) return false;
    const decorImgKey = baseName.slice(0, -'.svg'.length);
    if (geomorph.isDecorImgKey(decorImgKey)) return true;
    warn(`${'createDecorSheetJson'}: ignored file (unknown decorImgKey "${decorImgKey}")`);
  }).sort();

  const prevDecorSheet = prev.assets?.sheet.decor;
  const changedSvgBasenames = !!prevDecorSheet && opts.detectChanges
    ? svgBasenames.filter(x => opts.changedDecorBaseNames.includes(x) || !(x in prevDecorSheet))
    : svgBasenames
  ;

  const imgKeyToRect = /** @type {Record<Geomorph.DecorImgKey, { width: number; height: Number; data: Geomorph.DecorSheetRectCtxt }>} */ ({});
  const imgKeyToImg = /** @type {{ [key in Geomorph.DecorImgKey]?: import('canvas').Image }} */ ({});

  // Compute changed images in parallel
  const promQueue = new PQueue({ concurrency: 5 });
  await Promise.all(changedSvgBasenames.map(baseName => promQueue.add(async () => {
    const decorImgKey = /** @type {Geomorph.DecorImgKey} */ (baseName.slice(0, -'.svg'.length));
    // svg contents -> data url
    const svgDataUrl = `data:image/svg+xml;utf8,${await tryReadString(path.resolve(decorDir, baseName))}`;
    imgKeyToImg[decorImgKey] = await loadImage(svgDataUrl);
  })));

  /**
   * Decor is drawn in units `sgu * 5` i.e. same approach as SVG symbols.
   * We further adjust how high-res we want it.
   */
  const scale = sguSymbolScaleDown * spriteSheetDecorExtraScale;

  for (const baseName of svgBasenames) {
    const decorImgKey = /** @type {Geomorph.DecorImgKey} */ (baseName.slice(0, -'.svg'.length));
    const img = imgKeyToImg[decorImgKey];

    if (img) {// changedSvgBasenames.includes(baseName)
      const tags = baseName.split('--').slice(0, -1); // ignore e.g. `001.svg`
      const meta = tags.reduce((agg, tag) => { agg[tag] = true; return agg; }, /** @type {Geom.Meta} */ ({}));
      imgKeyToRect[decorImgKey] = {
        width: toPrecision(img.width * scale, 0),
        height: toPrecision(img.height * scale, 0),
        data: { ...meta, decorImgKey: decorImgKey },
      };
    } else {
      // 🔔 keeping meta.{x,y,width,height} avoids nondeterminism in sheet.decor json
      const meta = /** @type {Geomorph.SpriteSheet['decor']} */ (prevDecorSheet)[decorImgKey];
      imgKeyToRect[decorImgKey] = { width: meta.width, height: meta.height, data: { ...meta, fileKey: baseName } };
    }
  }

  const bin = packRectangles(Object.values(imgKeyToRect), { logPrefix: 'createDecorSheetJson', packedPadding: imgOpts.packedPadding });

  /** @type {Pick<Geomorph.SpriteSheet, 'decor' | 'decorDim'>} */
  const json = ({ decor: /** @type {*} */ ({}), decorDim: { width: bin.width, height: bin.height } });
  bin.rects.forEach(r => {
    const meta = /** @type {Geomorph.DecorSheetRectCtxt} */ (r.data);

    json.decor[meta.decorImgKey] = {
      ...meta,
      x: toPrecision(r.x),
      y: toPrecision(r.y),
      width: r.width,
      height: r.height,
    };
  });

  assets.sheet = { ...assets.sheet, ...json }; // Overwrite initial/previous

  return imgKeyToImg; // possibly partial
}

/**
 * @param {Geomorph.AssetsJson} assets
 * @param {Partial<Record<Geomorph.DecorImgKey, import('canvas').Image>>} decorImgKeyToImage
 * @param {Prev} prev
 */
async function drawDecorSheet(assets, decorImgKeyToImage, prev) {
  const { decor, decorDim } = assets.sheet;
  const decors = Object.values(decor);
  const ct = createCanvas(decorDim.width, decorDim.height).getContext('2d');
  const prevDecor = prev.assets?.sheet.decor;
  
  for (const { x, y, width, height, decorImgKey } of decors) {
    const image = decorImgKeyToImage[decorImgKey];
    if (image) {
      info(`${decorImgKey} redrawing...`);
      ct.drawImage(image, 0, 0, image.width, image.height, x, y, width, height);
    } else {// assume image available in previous sprite-sheet
      const prevRect = /** @type {Geomorph.SpriteSheet['decor']} */ (prevDecor)[decorImgKey];
      ct.drawImage(/** @type {import('canvas').Image} */ (prev.decorPng),
        prevRect.x, prevRect.y, prevRect.width, prevRect.height,
        x, y, width, height,
      );
    }
  }

  await saveCanvasAsFile(ct.canvas, decorPngPath);
}

/**
 * Uses special hashes constructed in `assets.meta`.
 * @param {Geomorph.SpriteSheet['obstacle'][*][]} obstacles
 * @param {Geomorph.AssetsJson} assets
 * @param {Prev} prev
 * @returns {Record<'changed' | 'removed', Set<`${Geomorph.SymbolKey} ${number}`>>}
 */
function detectChangedObstacles(obstacles, assets, prev) {
  if (prev.assets && prev.obstaclesPng) {
    const changed = /** @type {Set<`${Geomorph.SymbolKey} ${number}`>} */ (new Set);
    const removed = new Set(Object.values(prev.assets.sheet.obstacle).map(geomorph.symbolObstacleToKey));
    const [currMeta, prevMeta] = [assets.meta, prev.assets.meta];
    obstacles.forEach(({ symbolKey, obstacleId }) => {
      const key = geomorph.symbolObstacleToKey({ symbolKey, obstacleId });
      removed.delete(key);
      // optional-chaining in case symbol is new
      (currMeta[symbolKey].pngHash !== prevMeta[symbolKey]?.pngHash
        || currMeta[symbolKey].obsHashes?.[obstacleId] !== prevMeta[symbolKey].obsHashes?.[obstacleId]
      ) && changed.add(key);
    });
    return { changed, removed };
  } else {
    return {
      changed: new Set(obstacles.map(geomorph.symbolObstacleToKey)),
      removed: new Set(),
    };
  }
}

/** @param {Geom.Meta} meta */
function extractObstacleDescriptor(meta) {
  for (const tag of ['table', 'chair', 'bed', 'shower', 'surface']) {
    if (meta[tag] === true) return tag;
  }
  return 'obstacle';
}

function getNpcTextureMetas() {
  return fs.readdirSync(npcDir).filter(
    (baseName) => baseName.endsWith(".tex.svg")
  ).sort().map((svgBaseName) => {
    const svgPath = path.resolve(npcDir, svgBaseName);
    const { mtimeMs: svgMtimeMs } = fs.statSync(svgPath);
    const pngPath = path.resolve(assets3dDir, svgBaseName.slice(0, -'.svg'.length).concat('.png'));
    let pngMtimeMs = 0; try { pngMtimeMs = fs.statSync(pngPath).mtimeMs } catch {};
    return { svgBaseName, svgPath, pngPath, canSkip: svgMtimeMs < pngMtimeMs };
  });
}

/**
 * Convert SVGs into PNGs.
 * @param {Geomorph.AssetsJson} assets
 * @param {Prev} prev
 */
async function createNpcTextures(assets, prev) {
  const { skins } = assets.sheet
  const changedMetas = prev.npcTexMetas.filter(x => !x.canSkip || !skins.svgHash[x.svgBaseName]);
  await Promise.all(changedMetas.map(async ({ svgBaseName, svgPath, pngPath }) => {
    const svgContents = fs.readFileSync(svgPath).toString();
    skins.svgHash[svgBaseName] = hashText(svgContents);
    const svgDataUrl = `data:image/svg+xml;utf8,${svgContents}`;
    const image = await loadImage(svgDataUrl);
    const canvas = createCanvas(image.width, image.height);
    canvas.getContext('2d').drawImage(image, 0, 0);
    await saveCanvasAsFile(canvas, pngPath);
  }));
}

/**
 * @typedef Prev
 * @property {Geomorph.AssetsJson | null} assets
 * @property {import('canvas').Image | null} obstaclesPng
 * @property {import('canvas').Image | null} decorPng
 * @property {{ svgBaseName: string; svgPath: string; pngPath: string; canSkip: boolean; }[]} npcTexMetas
 * @property {boolean} skipMaps
 * @property {boolean} skipObstacles
 * @property {boolean} skipDecor
 * @property {boolean} skipNpcTex
 */
