import * as htmlparser2 from "htmlparser2";
import * as THREE from "three";

import { worldScale, precision, wallOutset, obstacleOutset } from "./const";
import { Mat, Poly, Rect, Vect } from "../geom";
import {
  info,
  error,
  parseJsArg,
  warn,
  debug,
  safeJsonParse,
  mapValues,
  keys,
  toPrecision,
} from "./generic";
import { geom } from "./geom";

class GeomorphService {
  /** @type {Record<Geomorph.GeomorphNumber, Geomorph.GeomorphKey>} */
  toGmKey = {
    101: "g-101--multipurpose",
    102: "g-102--research-deck",
    103: "g-103--cargo-bay",
    301: "g-301--bridge",
    302: "g-302--xboat-repair-bay",
    303: "g-303--passenger-deck",
  };

  /** @type {Record<Geomorph.GeomorphKey, Geomorph.GeomorphNumber>} */
  toGmNum = {
    "g-101--multipurpose": 101,
    "g-102--research-deck": 102,
    "g-103--cargo-bay": 103,
    "g-301--bridge": 301,
    "g-302--xboat-repair-bay": 302,
    "g-303--passenger-deck": 303,
  };

  /** @type {Record<Geomorph.GeomorphKey, Geomorph.SymbolKey>} */
  toHullKey = {
    "g-101--multipurpose": "101--hull",
    "g-102--research-deck": "102--hull",
    "g-103--cargo-bay": "103--hull",
    "g-301--bridge": "301--hull",
    "g-302--xboat-repair-bay": "302--hull",
    "g-303--passenger-deck": "303--hull",
  };

  /** @type {Geomorph.GeomorphKey[]} */
  get gmKeys() {
    return keys(this.toGmNum);
  }

  fromSymbolKey = {// 🚧 must extend when adding new symbols

    "101--hull": true,
    "102--hull": true,
    "103--hull": true,
    "301--hull": true,
    "302--hull": true,
    "303--hull": true,

    "bed--003--1x1.6": true,
    "bed--004--0.8x1.4": true,
    "bed--005--0.6x1.2": true,
    "bridge--042--8x9": true,
    "cargo--002--2x2": true,
    "cargo--010--2x4": true,
    "cargo--003--2x4.svg": true,
    "console--005--1.2x4": true,
    "console--006--1.2x3": true,
    "console--018--1x1": true, 
    "console--019--2x2": true, 
    "console--022--1x2": true,
    "console--031--1x1.2": true,
    "console--033--0.4x0.6": true,
    "console--051--0.4x0.6": true,
    "couch-and-chairs--006--0.4x2": true,
    "couch-and-chairs--007--0.6x1.4": true,
    "counter--009--0.4x0.4": true,
    "counter--010--0.4x0.4": true,
    "empty-room--013--2x3": true,
    "empty-room--019--2x4": true,
    "empty-room--020--2x4": true,
    "empty-room--039--3x4": true,
    "empty-room--060--4x4": true,
    "engineering--045--6x4": true,
    "engineering--047--4x7": true,
    "fresher--002--0.4x0.6": true,
    "fresher--020--2x2": true,
    "fresher--025--3x2": true,
    "fresher--036--4x2": true,
    "fuel--010--4x2": true,
    "iris-valves--005--1x1": true,
    "lab--012--4x3": true,
    "lab--018--4x4": true,
    "lab--023--4x4": true,
    "lifeboat--small-craft--2x4": true,
    "lounge--015--4x2": true,
    "lounge--017--4x2": true,
    "low-berth--003--1x1": true,
    "machinery--155--1.8x3.6": true,
    "machinery--156--2x4": true,
    "machinery--158--1.8x3.6": true,
    "machinery--357--4x2": true,
    "medical-bed--005--0.6x1.2": true,
    "medical-bed--006--1.6x3.6": true,
    "medical--007--3x2": true,
    "medical--008--3x2": true,
    "misc-stellar-cartography--020--10x10": true,
    "misc-stellar-cartography--023--4x4": true,
    "office--001--2x2": true,
    "office--004--2x2": true,
    "office--006--2x2": true,
    "office--026--2x3": true,
    "office--020--2x3": true,
    "office--023--2x3": true,
    "office--061--3x4": true,
    "office--074--4x4": true,
    "office--089--4x4": true,
    "ships-locker--003--1x1": true,
    "ships-locker--007--2x1": true,
    "ships-locker--020--2x2": true,
    "stateroom--012--2x2": true,
    "stateroom--014--2x2": true,
    "stateroom--018--2x3": true,
    "stateroom--019--2x3": true,
    "stateroom--020--2x3": true,
    "stateroom--035--2x3": true,
    "stateroom--036--2x4": true,
    "table--004--1.2x2.4": true,
    "table--009--0.8x0.8": true,
    "table--012--0.8x0.8": true,

    "extra--001--fresher--0.5x0.5": true,
    "extra--002--fresher--0.5x0.5": true,
    "extra--003--chair--0.25x0.25": true,
    "extra--004--desk--0.5x1": true,
    "extra--005--chair-0.25x0.25": true,
    "extra--006--desk--0.4x1": true,
    "extra--007--desk--0.4x0.66": true,
    "extra--008--desk--0.4x1.33": true,
    "extra--009--table--4x4": true,
    "extra--010--machine--2x1": true,
    "extra--011--machine--1x3": true,
    "extra--012--battery--3x2": true,
    "extra--013--privacy-screen--1.5x0.2": true,
    "extra--014--table--2x3": true,
    "extra--015--table--3x0.5": true,
    "extra--016--table--4x0.5": true,
    "extra--017--table--2x0.5": true,
  };

  /** @type {Geomorph.SymbolKey[]} */
  get hullKeys() {
    return keys(this.fromSymbolKey).filter(this.isHullKey);
  }

  /**
   * @param {string} decorKey
   * @param {Geom.Poly} poly
   * @returns {Geomorph.Decor}
   */
  decorFromPoly(decorKey, poly) {
    const { meta } = poly;
    if (meta.rect) {
      const { angle, baseRect } = geom.polyToAngledRect(poly);
      return { type: 'rect', key: decorKey, ...baseRect.precision(precision).json, meta, angle };
    } else if (meta.circle) {
      const baseRect = geom.polyToAngledRect(poly).baseRect.precision(precision);
      const center = poly.center.precision(precision);
      const radius = Math.max(baseRect.width, baseRect.height) / 2;
      return { type: 'circle', key: decorKey, meta, radius, center };
    } else {
      const center = poly.center.precision(precision);
      return { type: 'point', key: decorKey, meta, x: center.x, y: center.y };
    }
  }

  /**
   * @param {Geomorph.GeomorphKey} gmKey 
   * @param {Geomorph.FlatSymbol} symbol Flat hull symbol
   * @param {Geomorph.Assets} assets
   * //@param {Pick<Geomorph.Symbol, 'hullWalls' | 'pngRect'>} context
   * @returns {Geomorph.Layout}
   */
  createLayout(gmKey, symbol, assets) {
    debug(`createLayout ${gmKey}`);

    const { pngRect, hullWalls } = assets.symbols[geomorphService.toHullKey[gmKey]];
    const hullPoly = Poly.union(hullWalls);
    const hullOutline = hullPoly.map((x) => x.clone().removeHoles());

    const uncutWalls = symbol.walls;
    // Cutting pointwise avoids errors (e.g. for 301), and can propagate meta
    const cutWalls = uncutWalls.flatMap((x) =>
      Poly.cutOut(symbol.doors, [x]).map((y) => Object.assign(y, { meta: x.meta }))
    );
    const rooms = Poly.union(uncutWalls).flatMap((x) =>
      x.holes.map((ring) => new Poly(ring).fixOrientation())
    );
    // room meta comes from decor.meta tagged meta
    const metaDecor = symbol.decor.filter(x => x.meta.meta);
    rooms.forEach((room) => Object.assign(
      room.meta = {}, metaDecor.find((x) => room.contains(x.outline[0]))?.meta, { meta: undefined }
    ));

    const navPolyWithDoors = Poly.cutOut([
      ...cutWalls.flatMap((x) => geom.createOutset(x, wallOutset)),
      ...symbol.obstacles.flatMap((x) => geom.createOutset(x, obstacleOutset)),
    ], hullOutline).map((x) => x.cleanFinalReps().precision(precision));

    const doors = symbol.doors.map(x => new Connector(x));
    const windows = symbol.windows.map(x => new Connector(x));

    return {
      key: gmKey,
      decor: symbol.decor.map((d, i) => this.decorFromPoly(`${gmKey}-${i}`, d)),
      pngRect: pngRect.clone(),
      doors,
      hullPoly,
      hullDoors: doors.filter(x => x.meta.hull),
      obstacles: symbol.obstacles.map(/** @returns {Geomorph.LayoutObstacle} */ o => {
        const obstacleId = /** @type {number} */ (o.meta.obsId);
        const symbolKey = /** @type {Geomorph.SymbolKey} */ (o.meta.symKey);
        const origPoly = assets.symbols[symbolKey].obstacles[o.meta.obsId];
        return {
          symbolKey,
          obstacleId,
          origPoly,
          height: typeof o.meta.y === 'number' ? o.meta.y : 0,
          transform: o.meta.transform ?? [1, 0, 0, 1, 0, 0],
        };
      }),
      rooms: rooms.map(x => x.precision(precision)),
      walls: cutWalls.map(x => x.precision(precision)),
      windows,
      ...geomorphService.decomposeLayoutNav(navPolyWithDoors, doors),
    };
  }

  /**
   * @param {Geomorph.Layout} layout
   * @param {number} gmId
   * @param {Geom.SixTuple} transform
   * @returns {Geomorph.LayoutInstance}
   */
  computeLayoutInstance(layout, gmId, transform) {
    return {
      ...layout,
      gmId,
      transform,
      mat4: geomorphService.embedXZMat4(transform),
      doorSegs: layout.doors.map(({ seg }) => seg),
      wallSegs: layout.walls.flatMap((x) => x.lineSegs.map(seg => ({ seg, meta: x.meta }))),
    };
  }

  /**
   * @param {Geom.Poly[]} navPolyWithDoors 
   * @param {Connector[]} doors 
   * @returns {Pick<Geomorph.Layout, 'navDecomp' | 'navDoorwaysOffset'>}
   */
  decomposeLayoutNav(navPolyWithDoors, doors) {
    const navDoorways = doors.map((connector) => connector.computeDoorway());
    const navPolySansDoorways = Poly.cutOut([
      ...navDoorways, // Hull `navDoorways` only include half the door.
      // We must remove the rest before constructing triangulation
      ...doors.flatMap(x => x.meta.hull ? x.poly : []),
    ], navPolyWithDoors).map(x => x.cleanFinalReps());

    const navDecomp = geom.joinTriangulations(navPolySansDoorways.map(poly => poly.qualityTriangulate()));
    // 🔔 earlier precision can break qualityTriangulate
    navDecomp.vs.forEach(v => v.precision(precision));
    navDoorways.forEach(poly => poly.precision(precision));

    // add two triangles for each doorway (we dup some verts)
    const navDoorwaysOffset = navDecomp.tris.length;
    navDoorways.forEach(doorway => {
      const vId = navDecomp.vs.length;
      navDecomp.vs.push(...doorway.outline);
      navDecomp.tris.push([vId, vId + 1, vId + 2], [vId + 2, vId + 3, vId]);
    });
    return {
      navDecomp,
      navDoorwaysOffset,
    };
  }

  /**
   * @param {Geomorph.AssetsJson} assetsJson
   * @return {Geomorph.Assets}
   */
  deserializeAssets({ maps, meta, symbols, sheet }) {
    return {
      meta,
      symbols: mapValues(symbols, (x) => this.deserializeSymbol(x)),
      sheet,
      maps,
    };
  }

  /**
   * @param {Geomorph.GeomorphsJson} geomorphsJson
   * @return {Geomorph.Geomorphs}
   */
  deserializeGeomorphs({ hash, mapsHash, layoutsHash, sheetsHash, map, layout, sheet }) {
    return {
      hash,
      mapsHash,
      layoutsHash,
      sheetsHash,
      map,
      layout: mapValues(layout, (x) => this.deserializeLayout(x)),
      sheet,
    };
  }

  /**
   * @param {Geomorph.LayoutJson} json
   * @returns {Geomorph.Layout}
   */
  deserializeLayout(json) {
    const doors = json.doors.map(Connector.from);
    return {
      key: json.key,
      pngRect: Rect.fromJson(json.pngRect),

      decor: json.decor,
      doors,
      hullPoly: json.hullPoly.map(x => Poly.from(x)),
      hullDoors: doors.filter(x => x.meta.hull),
      obstacles: json.obstacles.map(x => ({
        symbolKey: x.symbolKey,
        obstacleId: x.obstacleId,
        height: x.height,
        origPoly: Poly.from(x.origPoly),
        transform: x.transform,
      })),
      rooms: json.rooms.map(Poly.from),
      walls: json.walls.map(Poly.from),
      windows: json.windows.map(Connector.from),

      navDecomp: { vs: json.navDecomp.vs.map(Vect.from), tris: json.navDecomp.tris },
      navDoorwaysOffset: json.navDoorwaysOffset,
    };
  }

  /**
   * @param {Geomorph.SymbolJson} json
   * @returns {Geomorph.Symbol}
   */
  deserializeSymbol(json) {
    return {
      key: json.key,
      isHull: json.isHull,
      hullWalls: json.hullWalls.map((x) => Object.assign(Poly.from(x), { meta: x.meta })),
      obstacles: json.obstacles.map((x) => Object.assign(Poly.from(x), { meta: x.meta })),
      walls: json.walls.map((x) => Object.assign(Poly.from(x), { meta: x.meta })),
      doors: json.doors.map((x) => Object.assign(Poly.from(x), { meta: x.meta })),
      windows: json.windows.map((x) => Object.assign(Poly.from(x), { meta: x.meta })),
      decor: json.decor.map((x) => Object.assign(Poly.from(x), { meta: x.meta })),
      unsorted: json.unsorted.map((x) => Object.assign(Poly.from(x), { meta: x.meta })),
      width: json.width,
      height: json.height,
      pngRect: Rect.fromJson(json.pngRect),
      symbols: json.symbols,

      removableDoors: json.removableDoors.map(({ doorId, wall }) => ({
        doorId,
        wall: Poly.from(wall),
      })),
      addableWalls: json.addableWalls.map((x) => Object.assign(Poly.from(x), { meta: x.meta })),
    };
  }

  /**
   * Embed a 2D affine transform into three.js XZ plane.
   * @param {Geom.SixTuple} transform
   * @param {object} options
   * @param {number} [options.yScale]
   * @param {number} [options.yHeight]
   * @param {THREE.Matrix4} [options.mat4]
   */
  embedXZMat4(transform, { yScale, yHeight, mat4 } = {}) {
    return (mat4 ?? new THREE.Matrix4()).set(
      transform[0], 0,            transform[2], transform[4],
      0,            yScale ?? 1,  0,            yHeight ?? 0,
      transform[1], 0,            transform[3], transform[5],
      0,            0,            0,             1
    );
  }

  /**
   * @private
   * @param {{ tagName: string; attributes: Record<string, string>; title: string; }} tagMeta
   * @param {number} [scale]
   * @returns {Geom.Poly | null}
   */
  extractGeom(tagMeta, scale) {
    const { tagName, attributes: a, title } = tagMeta;
    let poly = /** @type {Geom.Poly | null} */ (null);

    if (tagName === "rect" || tagName === "image") {
      poly = Poly.fromRect(new Rect(Number(a.x ?? 0), Number(a.y ?? 0), Number(a.width ?? 0), Number(a.height ?? 0)));
    } else if (tagName === "path") {
      poly = geom.svgPathToPolygon(a.d);
      if (!poly) {
        warn(`extractGeom: path must be single connected polygon with ≥ 0 holes`, a);
        return null;
      }
    } else {
      warn(`extractGeom: ${tagName}: unexpected tagName`, a);
      return null;
    }

    // DOMMatrix not available server-side
    const { transformOrigin } = geomorphService.extractTransformData(tagMeta);
    if (a.transform && transformOrigin) {
      poly.translate(-transformOrigin.x, -transformOrigin.y)
        .applyMatrix(new Mat(a.transform))
        .translate(transformOrigin.x, transformOrigin.y);
    } else if (a.transform) {
      poly.applyMatrix(new Mat(a.transform));
    }

    typeof scale === "number" && poly.scale(scale);

    return poly.precision(precision).cleanFinalReps().fixOrientation();
  }

  /**
   * @param {Record<string, string>} attributes
   * @returns {Geom.RectJson}
   */
  extractRect(attributes) {
    const [x, y, width, height] = ["x", "y", "width", "height"].map((x) =>
      Math.round(Number(attributes[x] || 0))
    );
    return { x, y, width, height };
  }

  /**
   * @private
   * @param {string} styleAttrValue
   */
  extractStyles(styleAttrValue) {
    return styleAttrValue.split(";").reduce((agg, x) => {
      const [k, v] = /** @type {[string, string]} */ (x.split(":").map((x) => x.trim()));
      agg[k] = v;
      return agg;
    }, /** @type {Record<string, string>} */ ({}));
  }

  /**
   * @param {string} transformAttribute
   * @returns {Geom.SixTuple | null}
   */
  extractSixTuple(transformAttribute = "matrix(1, 0, 0, 1, 0, 0)") {
    const transform = safeJsonParse(`[${transformAttribute.slice("matrix(".length, -1)}]`);
    if (geom.isTransformTuple(transform)) {
      // 🔔 precision 3?
      return /** @type {Geom.SixTuple} */ (transform.map(x => toPrecision(x, 3)));
    } else {
      warn(`extractSixTuple: "${transformAttribute}": expected format "matrix(a, b, c, d, e, f)"`);
      return null;
    }
  }

  /**
   * - Support transform-origin `0 0`
   * - Support transform-origin `76.028px 97.3736px`
   * - Support transform-origin `50% 50%`
   * - Support transform-box `fill-box`
   * - In SVG initial CSS value of transform-origin is `0 0` (elsewhere `50% 50%`)
   * - transform-origin is relative to <rect> or <path>, ignoring transform.
   * @private
   * @param {object} opts
   * @param {string} opts.tagName
   * @param {Record<string, string>} opts.attributes
   */
  extractTransformData({ tagName, attributes: a }) {
    const style = geomorphService.extractStyles(a.style ?? "");
    const transformOrigin = (style['transform-origin'] || '').trim();
    const transformBox = style['transform-box'] || null;
    
    /** For `transform-box: fill-box` */
    let bounds = /** @type {Rect | undefined} */ (undefined);
    const [xPart, yPart] = transformOrigin.split(/\s+/);

    if (!xPart || !yPart) {
      transformOrigin && error(`unsupported transform-box/origin: ${transformOrigin} ${transformBox}`);
      return { transformOrigin: null, transformBox };
    }

    if (transformBox) {
      if (transformBox === 'fill-box') {
        if (tagName === 'rect') {
          bounds = new Rect(Number(a.x), Number(a.y), Number(a.width), Number(a.height));
        } else if (tagName === 'path') {
          const pathPoly = geom.svgPathToPolygon(a.d);
          pathPoly && (bounds = pathPoly.rect) || error(`path.d parse failed: ${a.d}`);
        }
      } else {
        error(`unsupported transform-box/origin: ${transformOrigin} ${transformBox}`);
        return { transformOrigin: null, transformBox };
      }
    }

    const [x, y] = [xPart, yPart].map((rep, i) => {
      /** @type {RegExpMatchArray | null} */ let match = null;
      if ((match = rep.match(/^(-?\d+(?:.\d+)?)%$/))) {// e.g. -50.02%
        if (transformBox !== 'fill-box' || !bounds) {
          return null; // only support percentages for fill-box
        } else {
          return (i === 0 ? bounds.x : bounds.y) + (
            (Number(match[1]) / 100) * (i === 0 ? bounds.width : bounds.height)
          );
        }
      } else if ((match = rep.match(/^(-?\d+(?:.\d+)?)(?:px)$/))) {// e.g. 48.44px
        return Number(match[1]);
      } else {
        return null;
      }
    });

    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { transformOrigin: Vect.from(/** @type {Geom.VectJson} */ ({ x, y })), transformBox };
    } else {
      transformOrigin && error(`${tagName}: unsupported transform-box/origin: ${transformOrigin} ${transformBox}`);
      return { transformOrigin: null, transformBox };
    }
  }

  /**
   * Mutates `flattened`, using pre-existing entries.
   * Expects dependent flattened symbols to be in `flattened`.
   * @param {Geomorph.Symbol} symbol 
   * @param {Record<Geomorph.SymbolKey, Geomorph.FlatSymbol>} flattened 
   * This lookup only needs to contain sub-symbols of `symbol`.
   * @returns {void}
   */
  flattenSymbol(symbol, flattened) {
    const {
      key, isHull,
      addableWalls, removableDoors,
      walls, obstacles, doors, windows, decor, unsorted,
      symbols,
    } = symbol;

    const flats = symbols.map(({ symbolKey, meta, transform }) =>
      this.instantiateFlatSymbol(flattened[symbolKey], meta, transform)
    );

    flattened[key] = {
      key,
      isHull,
      // not aggregated, only cloned
      addableWalls: addableWalls.map(x => x.cleanClone()),
      removableDoors: removableDoors.map(x => ({ ...x, wall: x.wall.cleanClone() })),
      // aggregated and cloned
      walls: walls.concat(flats.flatMap(x => x.walls)),
      obstacles: obstacles.concat(flats.flatMap(x => x.obstacles)),
      doors: doors.concat(flats.flatMap(x => x.doors)),
      decor: decor.concat(flats.flatMap(x => x.decor)),
      unsorted: unsorted.concat(flats.flatMap(x => x.unsorted)),
      windows: windows.concat(flats.flatMap(x => x.windows)),
    };
  }

  /**
   * @param {number} gmId
   * @param {number} doorId
   */
  getGmDoorKey(gmId, doorId) {
    return `g${gmId}-d${doorId}`;
  }

  /**
   * @param {Geomorph.GeomorphKey} gmKey
   * @returns {{ gmKey: Geomorph.GeomorphKey; gmNumber: Geomorph.GeomorphNumber; hullKey: Geomorph.SymbolKey }}
   */
  gmKeyToKeys(gmKey) {
    const gmNumber = this.toGmNum[gmKey];
    return { gmKey, gmNumber, hullKey: `${gmNumber}--hull` };
  }

  /**
   * @param {Geomorph.GeomorphNumber} gmNumber
   * @returns {{ gmKey: Geomorph.GeomorphKey; gmNumber: Geomorph.GeomorphNumber; hullKey: Geomorph.SymbolKey }}
   */
  gmNumToKeys(gmNumber) {
    return { gmKey: this.toGmKey[gmNumber], gmNumber, hullKey: `${gmNumber}--hull` };
  }

  /**
   * When instantiating flat symbols:
   * - we can transform them
   * - we can remove doors tagged with `optional`
   * - we can remove walls tagged with `optional`
   * - we can modify every wall's baseHeight and height
   * @param {Geomorph.FlatSymbol} sym
   * @param {Geom.Meta} meta
   * @param {Geom.SixTuple} transform
   * @returns {Geomorph.FlatSymbol}
   */
  instantiateFlatSymbol(sym, meta, transform) {
    /** e.g. `['e']`, `['s']`  */
    const doorTags = /** @type {string[] | undefined} */ (meta.doors);
    /** e.g. `['e']`, `['s']`  */
    const wallTags = /** @type {string[] | undefined} */ (meta.walls);
    tmpMat1.feedFromArray(transform);

    const doorsToRemove = sym.removableDoors.filter(({ doorId }) => {
      const { meta } = sym.doors[doorId];
      return !doorTags ? false : !doorTags.some((tag) => meta[tag] === true);
    });

    const doors = sym.doors.filter((_, doorId) => !doorsToRemove.some((x) => x.doorId === doorId));

    const wallsToAdd = /** @type {Geom.Poly[]} */ ([]).concat(
      doorsToRemove.map((x) => x.wall),
      sym.addableWalls.filter(({ meta }) => !wallTags || wallTags.some((x) => meta[x] === true))
    );

    let extraWallMeta = /** @type {undefined | Geom.Meta} */ (undefined)
    typeof meta.wallsY === 'number' && Object.assign(extraWallMeta ??= {}, { y: meta.wallsY });
    typeof meta.wallsH === 'number' && Object.assign(extraWallMeta ??= {}, { h: meta.wallsH });

    return {
      key: sym.key,
      isHull: sym.isHull,
      addableWalls: [],
      removableDoors: [],
      decor: sym.decor.map((x) => x.cleanClone(tmpMat1, this.transformMeta(x.meta, tmpMat1))),
      doors: doors.map((x) => x.cleanClone(tmpMat1)),
      obstacles: sym.obstacles.map((x) => x.cleanClone(tmpMat1, {
        // aggregate height
        ...typeof meta.y === 'number' && { y: meta.y + (Number(x.meta.y) || 0) },
        // aggregate transform
        ...{ transform: tmpMat2.feedFromArray(transform).preMultiply(x.meta.transform ?? [1, 0, 0, 1, 0, 0]).toArray() },
      })),
      walls: sym.walls.concat(wallsToAdd).map((x) => x.cleanClone(tmpMat1, extraWallMeta)),
      windows: sym.windows.map((x) => x.cleanClone(tmpMat1)),
      unsorted: sym.unsorted.map((x) => x.cleanClone(tmpMat1)),
    };
  }

  /**
   * @param {Geomorph.GeomorphKey | Geomorph.GeomorphNumber} input
   */
  isEdgeGm(input) {
    input = typeof input === "string" ? this.toGmNum[input] : input;
    return 301 <= input && input < 500;
  }

  /**
   * @param {number} input
   * @returns {input is Geomorph.GeomorphNumber}
   */
  isGmNumber(input) {
    return input in this.toGmKey;
    // return (
    //   (101 <= input && input < 300) || // standard
    //   (301 <= input && input < 500) || // edge
    //   (501 <= input && input < 700) // corner
    // );
  }

  /**
   * @param {Geomorph.SymbolKey} symbolKey
   */
  isHullKey(symbolKey) {
    return symbolKey.endsWith("--hull");
  }

  /**
   * @param {string} input
   * @returns {input is Geomorph.SymbolKey}
   */
  isSymbolKey(input) {
    return input in this.fromSymbolKey;
  }

  /**
   * @param {string} mapKey
   * @param {string} svgContents
   * @returns {Geomorph.MapDef}
   */
  parseMap(mapKey, svgContents) {
    const gms = /** @type {Geomorph.MapDef['gms']} */ ([]);
    const tagStack = /** @type {{ tagName: string; attributes: Record<string, string>; }[]} */ ([]);
    const scale = worldScale * 1; // map scaled like hull symbols

    const parser = new htmlparser2.Parser({
      onopentag(name, attributes) {
        tagStack.push({ tagName: name, attributes });
      },
      ontext(contents) {
        const gmNumber = Number(contents); // e.g. 301
        const parent = tagStack.at(-2);

        if (!parent || tagStack.at(-1)?.tagName !== "title") {
          return;
        }
        if (parent.tagName !== "rect") {
          return void (
            parent?.tagName === "pattern" ||
            warn(`parseMap: ${parent?.tagName} ${contents}: ignored non-rect in map`)
          );
        }
        if (!geomorphService.isGmNumber(gmNumber)) {
          return warn(`parseMap: "${contents}": expected valid gm number`);
        }

        const rect = geomorphService.extractRect(parent.attributes);
        // 🔔 Rounded because map transforms must preserve axis-aligned rects
        const transform = geomorphService.extractSixTuple(parent.attributes.transform);
        const { transformOrigin } = geomorphService.extractTransformData(parent);

        if (transform) {
          const reduced = geom.reduceAffineTransform(
            { ...rect },
            transform,
            transformOrigin ?? { x: 0, y: 0 }
          );
          reduced[4] = toPrecision(reduced[4] * scale, precision);
          reduced[5] = toPrecision(reduced[5] * scale, precision);
          gms.push({ gmKey: geomorphService.toGmKey[gmNumber], transform: reduced });
        }
      },
      onclosetag() {
        tagStack.pop();
      },
    });

    parser.write(svgContents);
    parser.end();

    return {
      key: mapKey,
      gms,
    };
  }

  /**
   * Parse Starship Symbol
   * @param {Geomorph.SymbolKey} symbolKey
   * @param {string} svgContents
   * @returns {Geomorph.Symbol}
   */
  parseSymbol(symbolKey, svgContents) {
    // info("parseStarshipSymbol", symbolKey, "...");
    const isHull = this.isHullKey(symbolKey);
    /** Non-hull symbol are scaled up by 5 inside SVGs */
    const scale = worldScale * (isHull ? 1 : 1 / 5);

    const tagStack = /** @type {{ tagName: string; attributes: Record<string, string>; }[]} */ ([]);
    const folderStack = /** @type {string[]} */ ([]);

    let viewBoxRect = /** @type {Geom.Rect | null} */ (null);
    let pngRect = /** @type {Geom.Rect | null} */ (null);
    const symbols = /** @type {Geomorph.Symbol['symbols']} */ ([]);
    const hullWalls = /** @type {Geom.Poly[]} */ ([]);
    const obstacles = /** @type {Geom.Poly[]} */ ([]);
    const doors = /** @type {Geom.Poly[]} */ ([]);
    const unsorted = /** @type {Geom.Poly[]} */ ([]);
    const walls = /** @type {Geom.Poly[]} */ ([]);
    const windows = /** @type {Geom.Poly[]} */ ([]);
    const decor = /** @type {Geom.Poly[]} */ ([]);

    const parser = new htmlparser2.Parser({
      onopentag(tag, attributes) {
        // console.info(name, attributes);

        if (tag === "svg") {
          // viewBox -> viewbox
          const [x, y, width, height] = attributes.viewbox.trim().split(/\s+/).map(Number);
          viewBoxRect = new Rect(x, y, width, height);
          viewBoxRect.scale(scale).precision(precision);
        }
        if (tag === "image") {
          pngRect = new Rect(Number(attributes.x || 0), Number(attributes.y || 0), Number(attributes.width || 0), Number(attributes.height || 0));
          pngRect.scale(scale).precision(precision);
        }

        tagStack.push({ tagName: tag, attributes });
      },
      ontext(contents) {
        const parent = tagStack.at(-2);

        if (!parent || tagStack.at(-1)?.tagName !== "title" || parent.tagName === "pattern") {
          return; // Only consider <title> outside <defs>
        }
        if (parent.tagName === "g") {
          folderStack.push(contents);
          contents !== "symbols" && warn(`unexpected folder: "${contents}" will be ignored`);
          return;
        }
        if (parent.tagName === "image") {
          return;
        }
        if (folderStack.length >= 2 || (folderStack.length && folderStack[0] !== "symbols")) {
          return; // Only depth 0 and folder 'symbols' supported
        }

        const ownTags = contents.split(" ");

        // symbol may have folder "symbols"
        if (folderStack[0] === "symbols") {
          const [subSymbolKey, ...symbolTags] = ownTags;
          if (parent.tagName !== "rect") {
            return warn(`parseSymbol: symbols: ${parent.tagName} ${contents}: ignored non-rect`);
          }
          if (subSymbolKey.startsWith("_")) {
            return warn(`parseSymbol: symbols: ignored ${contents} with underscore prefix`);
          }
          if (!geomorphService.isSymbolKey(subSymbolKey)) {
            throw Error(`parseSymbol: symbols: ${contents}: must start with a symbol key`);
          }

          const rect = geomorphService.extractRect(parent.attributes);
          const transform = geomorphService.extractSixTuple(parent.attributes.transform);
          const { transformOrigin } = geomorphService.extractTransformData(parent);

          if (transform) {
            const reduced = geom.reduceAffineTransform(
              { ...rect },
              transform,
              transformOrigin ?? { x: 0, y: 0},
            );
            // Convert into world coords
            // 🔔 small error when precision 4
            reduced[4] = toPrecision(reduced[4] * scale, 2);
            reduced[5] = toPrecision(reduced[5] * scale, 2);
            // high precision for comparison to expected symbol dimension
            const width = toPrecision(rect.width * scale, 6);
            const height = toPrecision(rect.height * scale, 6);

            symbols.push({
              symbolKey: subSymbolKey,
              meta: geomorphService.tagsToMeta(symbolTags, { key: subSymbolKey }),
              width,
              height,
              transform: reduced,
            });
          }

          return;
        }

        const poly = geomorphService.extractGeom({ ...parent, title: contents }, scale);
        
        if (poly === null) {
          return;
        }
        
        /** @type {const} */ ([
          ["hull-wall", hullWalls],
          ["wall", walls],
          ["obstacle", obstacles],
          ["door", doors],
          ["window", windows],
          ["decor", decor],
          [null, unsorted],
        ]).some(([tag, polys]) =>
          (tag === null || ownTags.includes(tag)) && polys.push(poly)
        );

        const meta = geomorphService.tagsToMeta(ownTags, {});
        poly.meta = meta;

        if (meta.obstacle) {// Link to original symbol
          meta.symId = toSymId[symbolKey];
          meta.symKey = symbolKey; // Debug?
          meta.obsId = obstacles.length - 1;
        }
      },
      onclosetag(name) {
        tagStack.pop();
        if (name === "g") {
          folderStack.pop();
        }
      },
    });

    // debug(`parsing ${symbolKey}`);
    parser.write(svgContents);
    parser.end();

    if (!viewBoxRect) {
      throw Error(`parseStarshipSymbol: ${symbolKey} must have viewBox (or viewbox)`);
    }

    const key = symbolKey;
    const { width, height } = viewBoxRect;

    /** @type {Geomorph.PreSymbol} */
    const preParse = {
      key,
      doors,
      windows,
      hullWalls,
      isHull,
      walls,
      width,
      height,
    };

    const postParse = this.postParseSymbol(preParse);

    return {
      ...preParse,

      obstacles,
      pngRect: Rect.fromJson(
        pngRect ?? (info(`${symbolKey}: using viewBox for pngRect`), viewBoxRect)
      ),
      symbols,
      decor,
      unsorted,

      ...postParse,
    };
  }

  /**
   * @param {Geomorph.PreSymbol} partial
   * @returns {Geomorph.PostSymbol}
   */
  postParseSymbol(partial) {
    // Don't take unions of walls yet
    const hullWalls = partial.hullWalls.map((x) => x.cleanFinalReps());
    const nonOptionalWalls = partial.walls.filter((x) => x.meta.optional !== true);
    const uncutWalls = partial.hullWalls.concat(nonOptionalWalls).map((x) => x.cleanFinalReps());

    const removableDoors = partial.doors.flatMap((doorPoly, doorId) =>
      doorPoly.meta.optional ? { doorId, wall: Poly.intersect([doorPoly], uncutWalls)[0] } : []
    );
    const addableWalls = partial.walls.filter((x) => x.meta.optional === true);

    return {
      hullWalls,
      walls: uncutWalls,
      removableDoors,
      addableWalls,
    };
  }

  /**
   * @param {Geomorph.Geomorphs} geomorphs
   * @returns {Geomorph.GeomorphsJson}
   */
  serializeGeomorphs({ hash, mapsHash, layoutsHash, sheetsHash, map, layout, sheet }) {
    return {
      hash,
      mapsHash,
      layoutsHash,
      sheetsHash,
      map,
      layout: mapValues(layout, (x) => geomorphService.serializeLayout(x)),
      sheet,
    };
  }

  /**
   * @param {Geomorph.Layout} layout
   * @returns {Geomorph.LayoutJson}
   */
  serializeLayout(layout) {
    return {
      key: layout.key,
      pngRect: layout.pngRect,

      decor: layout.decor,
      doors: layout.doors.map(x => x.json),
      hullDoors: layout.hullDoors.map((x) => x.json),
      hullPoly: layout.hullPoly.map(x => x.geoJson),
      obstacles: layout.obstacles.map(x => ({
        symbolKey: x.symbolKey,
        obstacleId: x.obstacleId,
        height: x.height,
        origPoly: x.origPoly.geoJson,
        transform: x.transform,
      })),
      rooms: layout.rooms.map((x) => x.geoJson),
      walls: layout.walls.map((x) => x.geoJson),
      windows: layout.windows.map((x) => x.json),

      navDecomp: { vs: layout.navDecomp.vs, tris: layout.navDecomp.tris },
      navDoorwaysOffset: layout.navDoorwaysOffset,
    };
  }

  /**
   * Create serializable data associated to a static/assets/symbol/{symbol}.
   * @param {Geomorph.Symbol} parsed
   * @returns {Geomorph.SymbolJson}
   */
  serializeSymbol(parsed) {
    return {
      key: parsed.key,
      isHull: parsed.isHull,
      hullWalls: parsed.hullWalls.map((x) => Object.assign(x.geoJson, { meta: x.meta })),
      obstacles: parsed.obstacles.map((x) => Object.assign(x.geoJson, { meta: x.meta })),
      walls: parsed.walls.map((x) => Object.assign(x.geoJson, { meta: x.meta })),
      doors: parsed.doors.map((x) => Object.assign(x.geoJson, { meta: x.meta })),
      windows: parsed.windows.map((x) => Object.assign(x.geoJson, { meta: x.meta })),
      decor: parsed.decor.map((x) => Object.assign(x.geoJson, { meta: x.meta })),
      unsorted: parsed.unsorted.map((x) => Object.assign(x.geoJson, { meta: x.meta })),
      width: parsed.width,
      height: parsed.height,
      pngRect: parsed.pngRect,
      symbols: parsed.symbols,
      removableDoors: parsed.removableDoors.map((x) => ({ ...x, wall: x.wall.geoJson })),
      addableWalls: parsed.addableWalls.map((x) => Object.assign(x.geoJson, { meta: x.meta })),
    };
  }

  /** @param {Pick<Geomorph.SymbolObstacle, 'symbolKey' | 'obstacleId'>} arg0 */
  symbolObstacleToKey({ symbolKey, obstacleId }) {
    return /** @type {const} */ (`${symbolKey} ${obstacleId}`);
  }

  /**
   * @param {string[]} tags
   * @param {Geom.Meta} baseMeta
   */
  tagsToMeta(tags, baseMeta) {
    return tags.reduce((meta, tag) => {
      const eqIndex = tag.indexOf("=");
      if (eqIndex > -1) {
        meta[tag.slice(0, eqIndex)] = parseJsArg(tag.slice(eqIndex + 1));
      } else {
        meta[tag] = true; // Omit tags `foo=bar`
      }
      return meta;
    }, baseMeta);
  }

  /**
   * @param {Geom.Meta} meta 
   * @param {Geom.Mat} mat
   * @returns {Geom.Meta}
   */
  transformMeta(meta, mat) {
    if (typeof meta.orient === 'number') {
      const newDegrees = (180 / Math.PI) * mat.transformAngle(meta.orient * (Math.PI / 180));
      const newOrient =  Math.round(newDegrees < 0 ? 360 + newDegrees : newDegrees);
      return {
        ...meta,
        orient: newOrient,
      };
    } else {
      return meta; 
    }
  }
}

export const geomorphService = new GeomorphService();

export class Connector {
  /**
   * @param {Geom.Poly} poly
   * usually a rotated rectangle, but could be a curved window, in which case we'll view it as its AABB
   * @param {Object} [options]
   * @param {[null | number, null | number]} [options.roomIds]
   * @param {Geom.Meta} [options.meta]
   * `[id of room infront, id of room behind]` where a room is *infront* if `normal` is pointing towards it. Hull doors have exactly one non-null entry.
   */
  constructor(poly, options) {
    // 🔔 orientation MUST be clockwise w.r.t y-downwards
    poly.fixOrientationConvex();

    /** @type {Geom.Poly} usually a rotated rectangle, but could be a curved window, in which case we'll view it as its AABB */
    this.poly = poly;
    /** @type {Geom.Vect} */
    this.center = poly.center;
    /** @type {Geom.Meta} */
    this.meta = poly.meta || options?.meta || {};

    const { angle, baseRect } = geom.polyToAngledRect(poly);

    /** @type {Geom.Rect} */
    this.baseRect = baseRect;
    /** @type {number} radians */
    this.angle = angle;

    const {
      seg: [u, v],
      normal,
    } = geom.getAngledRectSeg({ angle, baseRect });

    /** @type {[Geom.Vect, Geom.Vect]} segment through middle of door */
    this.seg = [u, v];
    /** @type {Geom.Vect} */
    this.normal = normal;

    if (this.meta.hull) {
      if (// hull door normals should point outwards
        this.meta.n && this.normal.y > 0
        || this.meta.e && this.normal.x < 0
        || this.meta.s && this.normal.y < 0
        || this.meta.w && this.normal.x > 0
      ) {
        this.normal.scale(-1);
        this.seg = [this.seg[1], this.seg[0]];
      }
    }

    // 🚧 offset needed?
    const doorEntryDelta = 0.5 * baseRect.height + 0.05;
    const inFront = poly.center.addScaled(normal, doorEntryDelta).precision(precision);
    const behind = poly.center.addScaled(normal, -doorEntryDelta).precision(precision);

    /**
     * @type {[Geom.Vect, Geom.Vect]}
     * Aligned to roomIds i.e. `[infront, behind]` where a room is infront if normal is pointing towards it.
     */
    this.entries = [inFront, behind];

    /**
     * @type {[null | number, null | number]}
     * `[id of room infront, id of room behind]` where a room is *infront* if `normal` is pointing towards it. Hull doors have exactly one non-null entry.
     */
    this.roomIds = options?.roomIds || [null, null];
  }

  /** @returns {Geomorph.ConnectorJson} */
  get json() {
    return {
      poly: Object.assign(this.poly.geoJson, { meta: this.meta }),
      roomIds: [this.roomIds[0], this.roomIds[1]],
    };
  }

  /** @param {Geomorph.ConnectorJson} json */
  static from(json) {
    return new Connector(Object.assign(Poly.from(json.poly), { meta: json.poly.meta }), {
      roomIds: json.roomIds,
    });
  }

  /** @param {Geom.Poly[]} rooms */
  computeRoomIds(rooms) {
    const [infront, behind] = this.entries;
    this.roomIds = rooms.reduce((agg, room, roomId) => {
      // Support doors connecting a room to itself e.g.
      // galley-and-mess-halls--006--4x2
      if (room.contains(infront)) agg[0] = roomId;
      if (room.contains(behind)) agg[1] = roomId;
      return agg;
    }, /** @type {[null | number, null | number]} */ ([null, null]));
  }

  /** @returns {Geom.Poly} */
  computeDoorway() {
    const width = this.baseRect.width;
    // 🚧 clarify hull-wall vs wall width
    const height = (this.meta.hull ? 8 : 20/5) * worldScale;
    const hNormal = this.normal;
    const wNormal = tmpVect1.set(this.normal.y, -this.normal.x);

    if (this.meta.hull) {
      // hull doorways only contain half of door,
      // to avoid overlapping adjacent hull door
      const topLeft = this.seg[0].clone().addScaled(wNormal, wallOutset);
      const botLeft = topLeft.clone().addScaled(hNormal, -(height/2 + wallOutset));
      const botRight = botLeft.clone().addScaled(wNormal, width - 2 * wallOutset);
      const topRight = botRight.clone().addScaled(hNormal, (wallOutset + height/2));
      return new Poly([topLeft, botLeft, botRight, topRight]).fixOrientation();
    } else {
      const topLeft = this.seg[0].clone().addScaled(wNormal, wallOutset).addScaled(hNormal, -height/2 - wallOutset);
      const botLeft = topLeft.clone().addScaled(hNormal, wallOutset + height + wallOutset);
      const botRight = botLeft.clone().addScaled(wNormal, width - 2 * wallOutset);
      const topRight = botRight.clone().addScaled(hNormal, -wallOutset - height - wallOutset);
      return new Poly([topLeft, botLeft, botRight, topRight]).fixOrientation();
    }
  }
}

const tmpVect1 = new Vect();
const tmpVect2 = new Vect();
const tmpPoly1 = new Poly();
const tmpMat1 = new Mat();
const tmpMat2 = new Mat();

/**
 * @typedef {keyof GeomorphService['fromSymbolKey']} SymbolKey
 */

const symbolKeys = keys(geomorphService.fromSymbolKey);
const toSymId = symbolKeys.reduce((agg, key, id) =>
  (agg[key] = id, agg), /** @type {Record<Geomorph.SymbolKey, number>} */ ({})
);
const fromSymId = symbolKeys.reduce((agg, key, id) =>
  (agg[id] = key, agg), /** @type {Record<number, Geomorph.SymbolKey>} */ ({})
);
