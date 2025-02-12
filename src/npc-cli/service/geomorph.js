import * as htmlparser2 from "htmlparser2";
import * as THREE from "three";

import { sguToWorldScale, precision, wallOutset, obstacleOutset, hullDoorDepth, doorDepth, decorIconRadius, sguSymbolScaleDown, doorSwitchHeight, doorSwitchDecorImgKey, specialWallMetaKeys, wallHeight, offMeshConnectionHalfDepth, switchDecorQuadScaleUp } from "./const";
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
  hashJson,
  tagsToMeta,
  textToTags,
} from "./generic";
import { geom, tmpRect1 } from "./geom";
import { helper } from "./helper";

class GeomorphService {

  /** @type {Geomorph.GeomorphKey[]} */
  get gmKeys() {
    return keys(helper.toGmNum);
  }

  /** @type {Geomorph.SymbolKey[]} */
  get hullKeys() {
    return keys(helper.fromSymbolKey).filter(this.isHullKey);
  }

  /**
   * 🔔 computed in assets script
   * @param {Geomorph.GeomorphKey} gmKey 
   * @param {Geomorph.FlatSymbol} symbol Flat hull symbol
   * @param {Geomorph.Assets} assets
   * @returns {Geomorph.Layout}
   */
  createLayout(gmKey, symbol, assets) {
    debug(`createLayout ${gmKey}`);

    const { pngRect, hullWalls } = assets.symbols[helper.toHullKey[gmKey]];
    const hullPoly = Poly.union(hullWalls).map(x => x.precision(precision));
    const hullOutline = hullPoly.map((x) => new Poly(x.outline).clone()); // sans holes

    // const uncutWalls = symbol.walls;
    // Avoid non-hull walls inside hull walls (for x-ray)
    const uncutWalls = symbol.walls.flatMap(x =>
      Poly.cutOut(hullWalls, [x]).map(y => (y.meta = x.meta, y))
    ).concat(hullWalls);
    const plainWallMeta = { wall: true };
    const hullWallMeta = { wall: true, hull: true };

    /**
     * Cut doors from walls pointwise. The latter:
     * - avoids errors (e.g. for 301).
     * - permits meta propagation e.g. `h` (height), 'hull' (hull wall)
     */
    const connectors = symbol.doors.concat(symbol.windows);
    const cutWalls = uncutWalls.flatMap((x) => Poly.cutOut(connectors, [x]).map((y) =>
      Object.assign(y, {
        meta: specialWallMetaKeys.some(key => key in x.meta)
          ? x.meta
          : x.meta.hull === true ? hullWallMeta : plainWallMeta
        }
      )
    ));

    const rooms = Poly.union(uncutWalls.concat(symbol.windows)).flatMap((x) =>
      x.holes.map((ring) => new Poly(ring).fixOrientation())
    );
    // Room meta is specified by "decor meta ..." or "decor label=text ..." 
    // 🤔 can compute faster client-side via pixel-look-up
    const metaDecor = new Set(symbol.decor.filter(x =>
      typeof x.meta.label === 'string'
      || x.meta.meta === true
    ));
    rooms.forEach((room) => {
      for (const d of metaDecor) {
        if (room.contains(d.outline[0])) {
          metaDecor.delete(d); // at most 1 room
          Object.assign(room.meta, d.meta, { decor: undefined, meta: undefined, y: undefined });
        }
      }
    });

    const decor = /** @type {Geomorph.Decor[]} */ ([]);
    const labels = /** @type {Geomorph.DecorPoint[]} */ ([]);
    for (const poly of symbol.decor) {
      const d = this.decorFromPoly(poly, assets);
      if (typeof poly.meta.label === 'string' && d.type === 'point') {
        labels.push(d); // decor points with meta.label
      } else {
        decor.push(d);
      }
    }

    const ignoreNavPoints = decor.flatMap(d => d.type === 'point' && d.meta['ignore-nav'] ? d : []);
    const symbolObstacles = symbol.obstacles.filter(d => d.meta['permit-nav'] !== true);

    const navPolyWithDoors = Poly.cutOut([
      ...cutWalls.flatMap((x) => geom.createOutset(x, wallOutset)),
      ...symbol.windows,
      ...symbolObstacles.flatMap((x) => geom.createOutset(x,
        typeof x.meta['nav-outset'] === 'number' ? x.meta['nav-outset'] * sguToWorldScale : obstacleOutset
      )),
      ...decor.filter(this.isDecorCuboid).filter(d => d.meta.nav === true).map(d =>
        geom.applyUnitQuadTransformWithOutset(tmpMat1.feedFromArray(d.transform), obstacleOutset)
      ),
    ], hullOutline).filter(
      poly => poly.rect.area > 1 && !ignoreNavPoints.some(p => poly.contains(p))
    ).map(
      poly => poly.cleanFinalReps().precision(precision)
    );


    // 🔔 connector.roomIds will be computed in browser
    const doors = symbol.doors.map(x => new Connector(x));
    const windows = symbol.windows.map(x => new Connector(x));

    // Joining walls with `{plain,hull}WallMeta` reduces the rendering cost later
    // 🔔 could save more by joining hull/non-hull but want to distinguish them
    const joinedWalls = Poly.union(cutWalls.filter(x => x.meta === plainWallMeta)).map(x => Object.assign(x, { meta: plainWallMeta }));
    const joinedHullWalls = Poly.union(cutWalls.filter(x => x.meta === hullWallMeta)).map(x => Object.assign(x, { meta: hullWallMeta }));
    const unjoinedWalls = cutWalls.filter(x => x.meta !== plainWallMeta && x.meta !== hullWallMeta);

    return {
      key: gmKey,
      num: helper.toGmNum[gmKey],
      pngRect: pngRect.clone(),
      decor,
      doors,
      hullPoly,
      hullDoors: doors.filter(x => x.meta.hull),
      labels,
      obstacles: symbol.obstacles.map(/** @returns {Geomorph.LayoutObstacle} */ o => {
        const obstacleId = /** @type {number} */ (o.meta.obsId);
        const symbolKey = /** @type {Geomorph.SymbolKey} */ (o.meta.symKey);
        const origPoly = assets.symbols[symbolKey].obstacles[o.meta.obsId];
        const transform = /** @type {Geom.SixTuple} */ (o.meta.transform ?? [1, 0, 0, 1, 0, 0]);
        tmpMat1.feedFromArray(transform);
        return {
          symbolKey,
          obstacleId,
          origPoly,
          height: typeof o.meta.y === 'number' ? o.meta.y : 0,
          transform,
          center: tmpMat1.transformPoint(origPoly.center).precision(2),
          meta: origPoly.meta,
        };
      }),
      rooms: rooms.map(x => x.precision(precision)),
      walls: [...joinedHullWalls, ...joinedWalls, ...unjoinedWalls].map(x => x.precision(precision)),
      windows,
      unsorted: symbol.unsorted.map(x => x.precision(precision)),
      ...geomorph.decomposeLayoutNav(navPolyWithDoors, doors),
    };
  }

  /**
   * Compute flattened doors and decor:
   * - ensure decor `switch={doorId}` points to correct `doorId`
   * - when doors are close (e.g. coincide) remove later door
   * - ensure resp. switches removed, set other two as "inner"
   * 
   * @param {string} logPrefix 
   * @param {Geomorph.Symbol} symbol
   * @param {Geomorph.FlatSymbol[]} flats
   */
  computeFlattenedDoors(logPrefix, symbol, flats) {

    // ensure decor.meta.switch points to correct doorId
    let doorIdOffset = symbol.doors.length;
    const flatDoors = symbol.doors.concat(flats.flatMap(flat => {
      flat.decor.forEach(d => typeof d.meta.switch === 'number' && (d.meta.switch += doorIdOffset));
      doorIdOffset += flat.doors.length;
      return flat.doors;
    }));

    // detect coinciding doors e.g. from 102
    const centers = flatDoors.map(d => d.center);
    const [rmDoorIds, keptDoorIds] = /** @type {Set<number>[]} */ ([new Set(), new Set()]);
    centers.forEach((center, i) => {
      if (rmDoorIds.has(i)) return;
      for (let j = i + 1; j < centers.length; j++)
        if (Math.abs(center.x - centers[j].x) < 0.1 && Math.abs(center.y - centers[j].y) < 0.1) {
          debug(`${logPrefix}: removed door coinciding with ${i} (${j})`);
          keptDoorIds.add(i), rmDoorIds.add(j);
        }
    });

    const flatDecor = symbol.decor.concat(flats.flatMap(x => x.decor));
    let switchIdOffset = 0; // adjust switches on remove door
    const seenRmDoorId = /** @type {Set<number>} */ (new Set());

    return {
      flatDoors: flatDoors.filter((_, i) => !rmDoorIds.has(i)),
      flatDecor: flatDecor.filter((d) => {
        if (typeof d.meta.switch === 'number') {
          if (rmDoorIds.has(d.meta.switch)) {// remove resp. switch
            !seenRmDoorId.has(d.meta.switch) && (switchIdOffset--, seenRmDoorId.add(d.meta.switch));
            return false;
          }
          if (keptDoorIds.has(d.meta.switch)) {
            d.meta.inner = true; // set kept switches inner
          }
          d.meta.switch += switchIdOffset; // adjust for prior removals
        }
        return true;
      })
    };
  }

  /**
   * 🔔 computed in browser only,
   * where current mapKey is available
   * @param {Geomorph.GeomorphsJson} geomorphs
   * @param {string} mapKey
   * @returns {Geomorph.GeomorphsHash}
   */
  computeHash(geomorphs, mapKey) {
    const mapsHash = hashJson(geomorphs.map);
    const layoutsHash = hashJson(geomorphs.layout);
    const sheetsHash = hashJson(geomorphs.sheet);
    /** @type {Geomorph.PerGeomorphHash} */
    const perGmHash = mapValues(geomorphs.layout, value => ({
      full: hashJson(value),
      decor: hashJson(value.decor),
      nav: hashJson(value.navDecomp),
    }));

    return {
      ...perGmHash,
      full: `${mapsHash} ${layoutsHash} ${sheetsHash}`,
      maps: mapsHash,
      layouts: layoutsHash,
      sheets: sheetsHash,
      decor: `${layoutsHash} ${mapsHash}`,
      map: hashJson(geomorphs.map[mapKey]),
      mapGmHashes: geomorphs.map[mapKey].gms.map((x) => hashJson(x)),
    };
  }

  /**
   * 🔔 computed in browser only (main thread and worker)
   * @param {Geomorph.Layout} layout
   * @param {number} gmId
   * @param {Geom.SixTuple} transform
   * @returns {Geomorph.LayoutInstance}
   */
  computeLayoutInstance(layout, gmId, transform) {
    const matrix = new Mat(transform);
    // 🔔 currently only support "edge geomorph" or "full geomorph"
    const sguGridRect = new Rect(0, 0, 1200, this.isEdgeGm(layout.num) ? 600 : 1200);
    return {
      ...layout,
      gmId,
      transform,
      matrix,
      gridRect: sguGridRect.scale(sguToWorldScale).applyMatrix(matrix),
      inverseMatrix: matrix.getInverseMatrix(),
      mat4: geomorph.embedXZMat4(transform),
      determinant: transform[0] * transform[3] - transform[1] * transform[2],

      getOtherRoomId(doorId, roomId) {
        // We support case where roomIds are equal e.g. 303
        const { roomIds } = this.doors[doorId];
        return roomIds.find((x, i) => typeof x === 'number' && roomIds[1 - i] === roomId) ?? -1;
      },
      isHullDoor(doorId) {
        return doorId < this.hullDoors.length;
      },
    };
  }

  /**
   * @param {Geom.Poly[]} navPolyWithDoors 
   * @param {Connector[]} doors 
   * @returns {Pick<Geomorph.Layout, 'navDecomp' | 'navRects'>}
   */
  decomposeLayoutNav(navPolyWithDoors, doors) {
    // 🚧 remove all doorways... we'll use offMeshConnections instead
    const navDoorways = doors.map(x => x.computeDoorway().precision(precision).cleanFinalReps());
    const navPolySansDoors = Poly.cutOut(navDoorways, navPolyWithDoors).map(x => x.cleanFinalReps());
    const navDecomp = geom.joinTriangulations(navPolySansDoors.map(poly => poly.qualityTriangulate()));
    
    // include doors to infer "connected components"
    const navRects = navPolyWithDoors.map(x => x.rect.precision(precision));
    // Smaller rects 1st, else larger overrides (e.g. 102)
    navRects.sort((a, b) => a.area < b.area ? -1 : 1);
    // Mutate doors
    doors.forEach(door => door.navRectId = navRects.findIndex(r => r.contains(door.center)));
    return { navDecomp, navRects };
  }

  /**
   * - Script only.
   * - Only invoked for layouts, not nested symbols.
   * @param {Geom.Poly} poly
   * @param {Geomorph.Assets} assets
   * @returns {Geomorph.Decor}
   */
  decorFromPoly(poly, assets) {
    // 🔔 key, gmId, roomId provided on instantiation
    const meta = /** @type {Meta<Geomorph.GmRoomId>} */ (poly.meta);
    meta.y = toPrecision(Number(meta.y) || 0);
    const base = { key: '', meta };
    
    if (meta.rect === true) {
      if (poly.outline.length !== 4) {
        warn(`${'decorFromPoly'}: decor rect expected 4 points (saw ${poly.outline.length})`, poly.meta);
      }
      const { baseRect, angle } = geom.polyToAngledRect(poly);
      baseRect.precision(precision);
      return { type: 'rect', ...base, bounds2d: baseRect.json, points: poly.outline.map(x => x.json), center: poly.center.precision(3).json, angle };
    } else if (meta.quad === true) {
      const polyRect = poly.rect.precision(precision);
      const { transform } = poly.meta;
      delete poly.meta.transform;

      const quadMeta = /** @type {Geomorph.DecorQuad['meta']} */ (base.meta);
      if (!this.isDecorImgKey(quadMeta.img)) {
        warn(`${'decorFromPoly'}: decor quad meta.img must be in DecorImgKey (using "icon--warn")`);
        quadMeta.img = 'icon--warn';
      }

      // 🔔 `det` provided on instantiation
      return { type: 'quad', key: base.key, meta: quadMeta, bounds2d: polyRect.json, transform, center: poly.center.precision(3).json, det: 1 };
    } else if (meta.cuboid === true) {
      // decor cuboids follow "decor quad approach"
      const polyRect = poly.rect.precision(precision);
      const { transform } = poly.meta;
      delete poly.meta.transform;

      const center2d = poly.center;
      const y3d = typeof meta.y === 'number' ? meta.y : 0;
      const height3d = typeof meta.h === 'number' ? meta.h : 0.5; // 🚧 remove hard-coding
      const center = geom.toPrecisionV3({ x: center2d.x, y: y3d + (height3d / 2), z: center2d.y });

      return { type: 'cuboid', ...base, bounds2d: polyRect.json, transform, center };
    } else if (meta.circle == true) {
      const polyRect = poly.rect.precision(precision);
      const baseRect = geom.polyToAngledRect(poly).baseRect.precision(precision);
      const center = poly.center.precision(precision);
      const radius = Math.max(baseRect.width, baseRect.height) / 2;
      return { type: 'circle', ...base, bounds2d: polyRect.json, radius, center };
    } else {// 🔔 fallback to decor point
      const center = poly.center.precision(precision);
      const radius = decorIconRadius + 2;
      const bounds2d = tmpRect1.set(center.x - radius, center.y - radius, 2 * radius, 2 * radius).precision(precision).json;
      // direction determines orient (degrees), where (1, 0) understood as 0 degrees
      const direction = /** @type {Geom.VectJson} */ (meta.direction) || { x: 0, y: 0 };
      delete meta.direction;
      const orient = toPrecision((180 / Math.PI) * Math.atan2(direction.y, direction.x));

      if ('img' in meta && !this.isDecorImgKey(meta.img)) {
        warn(`${'decorFromPoly'}: decor point with meta.img must be in DecorImgKey (using "icon--warn")`);
        meta.img = 'icon--warn';
      }
      return { type: 'point', ...base, bounds2d, x: center.x, y: center.y, orient };
    }
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
  deserializeGeomorphs({ map, layout, sheet }) {
    return {
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
      num: json.num,
      pngRect: Rect.fromJson(json.pngRect),
      
      decor: json.decor,
      doors,
      hullPoly: json.hullPoly.map(x => Poly.from(x)),
      hullDoors: doors.filter(x => x.meta.hull),
      labels: json.labels,
      obstacles: json.obstacles.map(x => {
        const origPoly = Poly.from(x.origPoly);
        return {
          symbolKey: x.symbolKey,
          obstacleId: x.obstacleId,
          height: x.height,
          origPoly,
          transform: x.transform,
          center: Vect.from(x.center),
          meta: origPoly.meta, // shortcut to origPoly.meta
        };
      }),
      rooms: json.rooms.map(Poly.from),
      walls: json.walls.map(Poly.from),
      windows: json.windows.map(Connector.from),
      unsorted: json.unsorted.map(Poly.from),

      navDecomp: { vs: json.navDecomp.vs.map(Vect.from), tris: json.navDecomp.tris },
      navRects: json.navRects.map(Rect.fromJson),
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
   * Given decor symbol instance <use>, extract polygon with meta.
   * Support: cuboid, point, quad.
   * @private
   * @param {{ tagName: string; attributes: Record<string, string>; title: string; }} tagMeta
   * @param {Meta} meta
   * @returns {Geom.Poly}
   */
  extractDecorPoly(tagMeta, meta) {
    const scale = sguToWorldScale * sguSymbolScaleDown;
    const trOrigin = geomorph.extractTransformData(tagMeta).transformOrigin ?? { x: 0, y: 0 };
    tmpMat1.setMatrixValue(tagMeta.attributes.transform)
      .preMultiply([1, 0, 0, 1, -trOrigin.x, -trOrigin.y])
      .postMultiply([scale, 0, 0, scale, trOrigin.x * scale, trOrigin.y * scale])
    ;

    const poly = Poly.fromRect(new Rect(0, 0, 1, 1)).applyMatrix(tmpMat1);
    poly.meta = meta;

    // support cuboid/point/quad with point fallback
    if (meta.cuboid === true) {
      meta.transform = tmpMat1.precision(precision).toArray();
    } else if (meta.quad === true) {
      /**
       * 🔔 SVG symbols with meta.quad should have meta.img
       * 🔔 meta.switch means door switch
       */
      if (typeof meta.switch === 'number') {
        meta.y = doorSwitchHeight;
        meta.tilt = true; // 90° so in XY plane
        meta.img = doorSwitchDecorImgKey;
        // 🔔 scale up for easier mobile press
        meta.transform = tmpMat1.preMultiply(switchDecorQuadScaleUp).precision(precision).toArray();
      } else {
        meta.transform = tmpMat1.precision(precision).toArray();
      }
    } else {
      meta.point = true;
      meta.direction = tmpVect1.set(tmpMat1.a, tmpMat1.b).normalize().json;
    }

    return poly.precision(precision).cleanFinalReps().fixOrientation();
  }

  /**
   * Extract polygon with meta from <rect>, <path>, <circle> or <image>
   * - <rect> e.g. possibly rotated wall
   * - <path> e.g. complex obstacle
   * - <circle> i.e. decor circle
   * - <image> i.e. background image in symbol
   * - <polygon>
   * @private
   * @param {{ tagName: string; attributes: Record<string, string>; title: string; }} tagMeta
   * @param {Meta} meta
   * @param {number} [scale]
   * @returns {Geom.Poly | null}
   */
  extractPoly(tagMeta, meta, scale = sguToWorldScale * sguSymbolScaleDown) {
    const { tagName, attributes: a, title } = tagMeta;
    let poly = /** @type {Geom.Poly | null} */ (null);

    if (tagName === 'rect' || tagName === 'image') {
      poly = Poly.fromRect(new Rect(Number(a.x ?? 0), Number(a.y ?? 0), Number(a.width ?? 0), Number(a.height ?? 0)));
    } else if (tagName === 'path') {
      poly = geom.svgPathToPolygon(a.d);
      if (poly === null) {
        warn(`${'extractPoly'}: path must be single connected polygon with ≥ 0 holes`, a);
        return null;
      }
    } else if (tagName === 'circle') {
      const r = Number(a.r ?? 0);
      poly = Poly.fromRect(new Rect(Number(a.cx ?? 0) - r, Number(a.cy ?? 0) - r, 2 * r, 2 * r));
      meta.circle = true;
    } else if (tagName === 'polygon') {
      // e.g. "1024.000,0.000 921.600,0.000 921.600,102.400 1024.000,102.400"
      poly = geom.svgPathToPolygon(`M${a.points}Z`);
      if (poly === null) {
        warn(`${'extractPoly'}: ${tagName}: invalid induced path: M${a.points}Z`, a);
        return null;
      }
    } else {
      warn(`${'extractPoly'}: ${tagName}: unexpected tagName`, a);
      return null;
    }

    // 🔔 DOMMatrix not available server-side
    const { transformOrigin } = geomorph.extractTransformData(tagMeta);
    if (a.transform && transformOrigin) {
      poly.translate(-transformOrigin.x, -transformOrigin.y)
        .applyMatrix(new Mat(a.transform))
        .translate(transformOrigin.x, transformOrigin.y);
    } else if (a.transform) {
      poly.applyMatrix(new Mat(a.transform));
    }

    poly.scale(scale);
    poly.meta = meta;

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
    const style = geomorph.extractStyles(a.style ?? "");
    const transformOrigin = (style['transform-origin'] || '').trim();
    const transformBox = style['transform-box'] || null;
    const [xPart, yPart] = transformOrigin.split(/\s+/);
    
    /** For `transform-box: fill-box` */
    let bounds = /** @type {Rect | undefined} */ (undefined);

    if (!xPart || !yPart) {
      transformOrigin && error(`${tagName}: transform-box/origin: "${transformBox}"/"${transformOrigin}": transform-origin must have an "x part" and a "y part"`);
      return { transformOrigin: null, transformBox };
    }

    if (transformBox) {
      if (transformBox === 'fill-box') {
        if (tagName === 'rect' || tagName === 'use') {
          bounds = new Rect(Number(a.x || 0), Number(a.y || 0), Number(a.width || 0), Number(a.height || 0));
        } else if (tagName === 'path') {
          const pathPoly = geom.svgPathToPolygon(a.d);
          pathPoly && (bounds = pathPoly.rect) || error(`path.d parse failed: ${a.d}`);
        }
      } else {
        error(`${tagName}: transform-box/origin: "${transformBox}"/"${transformOrigin}": only fill-box is supported`);
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
      } else if (rep.endsWith('px')) {// e.g. 48.44px or -4e-06px
        return parseFloat(rep);
      } else {
        return null;
      }
    });

    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { transformOrigin: Vect.from(/** @type {Geom.VectJson} */ ({ x, y })), transformBox };
    } else {
      transformOrigin && error(`${tagName}: transform-box/origin: "${transformBox}"/"${transformOrigin}": failed to parse transform-origin`);
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
      walls, obstacles, windows, unsorted,
      symbols,
    } = symbol;

    const flats = symbols.map(({ symbolKey, meta, transform }) =>
      this.instantiateFlatSymbol(flattened[symbolKey], meta, transform)
    );

    const { flatDoors, flatDecor } = this.computeFlattenedDoors(symbol.key, symbol, flats);

    flattened[key] = {
      key,
      isHull,
      // not aggregated, only cloned
      addableWalls: addableWalls.map(x => x.cleanClone()),
      removableDoors: removableDoors.map(x => ({ ...x, wall: x.wall.cleanClone() })),
      // aggregated and cloned
      walls: walls.concat(flats.flatMap(x => x.walls)),
      obstacles: obstacles.concat(flats.flatMap(x => x.obstacles)),
      doors: flatDoors,
      decor: flatDecor,
      unsorted: unsorted.concat(flats.flatMap(x => x.unsorted)),
      windows: windows.concat(flats.flatMap(x => x.windows)),
    };
  }

  /**
   * - 🔔 instantiated decor should be determined by min(3D AABB)
   * - replace decimal points by `_` so can `w decor.byKey.point[29_5225,0,33_785]`
   * @param {Pick<Geomorph.Decor, 'type' | 'bounds2d' | 'meta'>} d 
   */
  getDerivedDecorKey(d) {
    return `${d.type}[${d.bounds2d.x},${Number(d.meta.y) || 0},${d.bounds2d.y}]`.replace(/[.]/g, '_');
  }

  /**
   * When instantiating flat symbols:
   * - we can transform them
   * - we can remove doors tagged with `optional`
   * - we can remove walls tagged with `optional`
   * - we can modify every wall's baseHeight and height
   * @param {Geomorph.FlatSymbol} sym
   * @param {Meta<{ doors?: string[]; walls?: string[] }>} meta
   * `meta.{doors,walls}` e.g. `['e']`, `['s']`
   * @param {Geom.SixTuple} transform
   * @returns {Geomorph.FlatSymbol}
   */
  instantiateFlatSymbol(sym, meta, transform) {
    const doorTags = meta.doors;
    const wallTags = meta.walls;
    tmpMat1.feedFromArray(transform);

    const doorsToRemove = sym.removableDoors.filter(({ doorId }) => {
      const { meta } = sym.doors[doorId];
      return !doorTags ? false : !doorTags.some((tag) => meta[tag] === true);
    });
    const rmDoorIds = new Set(doorsToRemove.map(x => x.doorId));
    let switchIdOffset = 0;
    const seenRmDoorId = /** @type {Set<number>} */ (new Set());

    const doors = sym.doors.filter((_, doorId) => !rmDoorIds.has(doorId));
    const decor = sym.decor
      .map(x => x.cleanClone(tmpMat1, this.transformDecorMeta(x.meta, tmpMat1, meta.y)))
      .filter(d => { // remove resp switches of removed doors, offsetting subsequent
        if (typeof d.meta.switch === 'number') {
          if (rmDoorIds.has(d.meta.switch)) {
            !seenRmDoorId.has(d.meta.switch) && (switchIdOffset--, seenRmDoorId.add(d.meta.switch));
            return false;
          }
          d.meta.switch += switchIdOffset;
        }
        return true;
      })
    ;

    const wallsToAdd = /** @type {Geom.Poly[]} */ ([]).concat(
      doorsToRemove.map((x) => x.wall),
      sym.addableWalls.filter(({ meta }) => !wallTags || wallTags.some((x) => meta[x] === true))
    );

    return {
      key: sym.key,
      isHull: sym.isHull,
      addableWalls: [],
      removableDoors: [],
      decor,
      doors: doors.map((x) => x.cleanClone(tmpMat1)),
      obstacles: sym.obstacles.map((x) => x.cleanClone(tmpMat1, {
        // aggregate height
        ...typeof meta.y === 'number' && { y: toPrecision(meta.y + (Number(x.meta.y) || 0)) },
        // aggregate transform
        ...{ transform: tmpMat2.feedFromArray(transform).preMultiply(x.meta.transform ?? [1, 0, 0, 1, 0, 0]).toArray() },
      })),
      walls: sym.walls.concat(wallsToAdd).map((x) => x.cleanClone(tmpMat1)),
      // meta.{y,h} define window dimension
      windows: sym.windows.map((x) => x.cleanClone(tmpMat1, meta)),
      unsorted: sym.unsorted.map((x) => x.cleanClone(tmpMat1)),
    };
  }

  /**
   * @param {string | undefined} input
   * @returns {input is Geomorph.DecorImgKey}
   */
  isDecorImgKey(input) {
    return input !== undefined && input in helper.fromDecorImgKey;
  }

  /**
   * @param {Geomorph.Decor} d
   * @returns {d is Geomorph.DecorCollidable}
   */
  isDecorCollidable(d) {
    return d.type === 'circle' || d.type === 'rect';
  }

  /**
   * @param {Geomorph.Decor} d
   * @returns {d is Geomorph.DecorCuboid}
   */
  isDecorCuboid(d) {
    return d.type === 'cuboid';
  }

  /**
   * @param {Geomorph.Decor} d
   * @returns {d is Geomorph.DecorPoint}
   */
  isDecorPoint(d) {
    return d.type === 'point';
  }

  /**
   * @param {Geomorph.GeomorphKey | Geomorph.GeomorphNumber} input
   */
  isEdgeGm(input) {
    input = typeof input === "string" ? helper.toGmNum[input] : input;
    return 301 <= input && input < 500;
  }

  /**
   * @param {number} input
   * @returns {input is Geomorph.GeomorphNumber}
   */
  isGmNumber(input) {
    return input in helper.toGmKey;
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
    return input in helper.fromSymbolKey;
  }

  /**
   * @param {string} mapKey
   * @param {string} svgContents
   * @returns {Geomorph.MapDef}
   */
  parseMap(mapKey, svgContents) {
    const gms = /** @type {Geomorph.MapDef['gms']} */ ([]);
    const tagStack = /** @type {{ tagName: string; attributes: Record<string, string>; }[]} */ ([]);
    const scale = sguToWorldScale * 1; // map scaled like hull symbols

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
            warn(`${'parseMap'}: ${mapKey}: ${parent?.tagName} ${contents}: ignored non-rect`)
          );
        }
        if (!geomorph.isGmNumber(gmNumber)) {
          return warn(`${'parseMap'}: ${mapKey}: "${contents}": expected geomorph number`);
        }

        const rect = geomorph.extractRect(parent.attributes);
        // 🔔 Rounded because map transforms must preserve axis-aligned rects
        const transform = geomorph.extractSixTuple(parent.attributes.transform);
        const { transformOrigin } = geomorph.extractTransformData(parent);

        if (transform) {
          const reduced = geom.reduceAffineTransform(
            { ...rect },
            transform,
            transformOrigin ?? { x: 0, y: 0 }
          );
          reduced[4] = toPrecision(reduced[4] * scale, precision);
          reduced[5] = toPrecision(reduced[5] * scale, precision);
          gms.push({ gmKey: helper.toGmKey[gmNumber], transform: reduced });
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
    const scale = sguToWorldScale * sguSymbolScaleDown;

    const tagStack = /** @type {{ tagName: string; attributes: Record<string, string>; }[]} */ ([]);
    const folderStack = /** @type {string[]} */ ([]);
    let defsStack = 0;

    let viewBoxRect = /** @type {Geom.Rect | null} */ (null);
    let pngRect = /** @type {Geom.Rect | null} */ (null);
    const symbols = /** @type {Geomorph.Symbol['symbols']} */ ([]);
    const decor = /** @type {Geom.Poly[]} */ ([]);
    const doors = /** @type {Geom.Poly[]} */ ([]);
    const hullWalls = /** @type {Geom.Poly[]} */ ([]);
    const obstacles = /** @type {Geom.Poly[]} */ ([]);
    const unsorted = /** @type {Geom.Poly[]} */ ([]);
    const walls = /** @type {Geom.Poly[]} */ ([]);
    const windows = /** @type {Geom.Poly[]} */ ([]);

    const parser = new htmlparser2.Parser({
      onopentag(tag, attributes) {
        // console.info(name, attributes);

        if (tag === "svg") {
          // parser normalises 'viewBox' as 'viewbox'
          const [x, y, width, height] = attributes.viewbox.trim().split(/\s+/).map(Number);
          viewBoxRect = new Rect(x, y, width, height);
          viewBoxRect.scale(scale).precision(precision);
        } else if (tag === "image") {
          pngRect = new Rect(Number(attributes.x || 0), Number(attributes.y || 0), Number(attributes.width || 0), Number(attributes.height || 0));
          pngRect.scale(scale).precision(precision);
        } else if (tag === "defs") {
          defsStack++;
        }

        tagStack.push({ tagName: tag, attributes });
      },
      ontext(contents) {
        const parent = tagStack.at(-2);

        if (!parent || (tagStack.at(-1)?.tagName !== "title") || defsStack > 0) {
          return; // Only consider <title>, ignoring <defs>
        }
        if (parent.tagName === "g") {
          folderStack.push(contents);
          contents !== "symbols" && warn(`unexpected folder: "${contents}" will be ignored`);
          return;
        }
        if (parent.tagName === "image") {
          return;
        }
        if (folderStack.length >= 2 || (folderStack[0] && folderStack[0] !== "symbols")) {
          return; // Only depth 0 and folder 'symbols' supported
        }

        // const ownTags = contents.split(" ");
        const ownTags = textToTags(contents);

        // symbol may have folder "symbols"
        if (folderStack[0] === "symbols") {
          const [subSymbolKey, ...symbolTags] = ownTags;
          if (parent.tagName !== "rect" && parent.tagName !== "use") {
            return warn(`parseSymbol: symbols: ${parent.tagName} ${contents}: only <rect>, <use> allowed`);
          }
          if (subSymbolKey.startsWith("_")) {
            return warn(`parseSymbol: symbols: ignored ${contents} with underscore prefix`);
          }
          if (!geomorph.isSymbolKey(subSymbolKey)) {
            throw Error(`parseSymbol: symbols: ${contents}: must start with a symbol key`);
          }

          const rect = geomorph.extractRect(parent.attributes);
          const transform = geomorph.extractSixTuple(parent.attributes.transform);
          const { transformOrigin } = geomorph.extractTransformData(parent);

          if (transform !== null) {
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
              meta: tagsToMeta(symbolTags, { key: subSymbolKey }, metaVarNames, metaVarValues),
              width,
              height,
              transform: reduced,
            });
          }

          return;
        }

        const meta = tagsToMeta(ownTags, {}, metaVarNames, metaVarValues);
        // 🔔 "switch" points to last doorId seen
        if (meta.switch === true) {
          meta.switch = doors.length - 1;
        }

        const poly = parent.tagName === "use" && meta.decor === true
          ? geomorph.extractDecorPoly({ ...parent, title: contents }, meta)
          : geomorph.extractPoly({ ...parent, title: contents }, meta)
        ;
        
        if (poly === null) {
          return;
        }

        // insert polygon into specific array
        if (meta.wall === true) {
          (meta.hull === true ? hullWalls : walls).push(poly);
        } else if (meta.obstacle === true) {
          obstacles.push(poly);
        } else if (meta.door === true) {
          doors.push(poly);
        } else if (meta.window === true) {
          windows.push(poly);
        } else if (meta.decor === true) {
          decor.push(poly);
        } else {
          unsorted.push(poly);
        }

        if (meta.obstacle) {// Link to original symbol
          meta.symKey = symbolKey;
          // local id inside SVG symbol
          meta.obsId = obstacles.length - 1;
        }
      },
      onclosetag(tag) {
        tagStack.pop();
        if (tag === "g") {
          folderStack.pop();
        } else if (tag === "defs") {
          defsStack--;
        }
      },
    });

    // debug(`parsing ${symbolKey}`);
    parser.write(svgContents);
    parser.end();

    if (!viewBoxRect) {
      throw Error(`${'parseSymbol'}: ${symbolKey} must have viewBox (or viewbox)`);
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
   * Given SVG contents with `<g><title>uv-map</title> {...} </g>`,
   * parse name to UV Rect i.e. normalized to [0, 1] x [0, 1]
   * @param {string} svgContents 
   * @param {string} logLabel 
   * @returns {{ width: number; height: number; uvMap: { [uvRectName: string]: Geom.RectJson }; }}
   */
  parseUvMapRects(svgContents, logLabel) {
    const output = /** @type {ReturnType<GeomorphService['parseUvMapRects']>} */ ({
      width: 0,
      height: 0,
      uvMap: {},
    });
    const tagStack = /** @type {{ tagName: string; attributes: Record<string, string>; }[]} */ ([]);
    const folderStack = /** @type {string[]} */ ([]);

    const parser = new htmlparser2.Parser({
      onopentag(name, attributes) {
        if (tagStack.length === 0) {
          output.width = Number(attributes.width) || 0;
          output.height = Number(attributes.height) || 0;
        }
        tagStack.push({ tagName: name, attributes });
      },
      ontext(contents) {
        const parent = tagStack.at(-2);

        if (!parent || tagStack.at(-1)?.tagName !== "title") {
          return; // only consider <title> tags
        }
        
        if (parent.tagName === "g") {
          return folderStack.push(contents); // track folders
        }
        
        if (folderStack.at(-1) !== 'uv-map') {
          return; // only consider top-level folder "uv-map"
        }

        // Blender UV SVG Export generates <polygon>'s
        if (parent.tagName !== "polygon") {
          return void (
            warn(`${'parseUvMapRects'}: ${logLabel}: ${parent?.tagName} ${contents}: ignored non <polygon>`)
          );
        }

        const poly = geomorph.extractPoly({ ...parent, title: contents }, {}, 1);

        if (poly) {// output sub-rect of [0, 1] x [0, 1]
          const uvRectName = contents; // e.g. `head-right`
          output.uvMap[uvRectName] = poly.rect
            .scale(1 / output.width, 1 / output.height)
            .precision(4).json
          ;
        }
      },
      onclosetag() {
        tagStack.pop();
      },
    });

    parser.write(svgContents);
    parser.end();
    return output;
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
  serializeGeomorphs({ map, layout, sheet }) {
    return {
      map,
      layout: mapValues(layout, (x) => geomorph.serializeLayout(x)),
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
      num: layout.num,
      pngRect: layout.pngRect,

      decor: layout.decor,
      doors: layout.doors.map(x => x.json),
      hullDoors: layout.hullDoors.map((x) => x.json),
      hullPoly: layout.hullPoly.map(x => x.geoJson),
      labels: layout.labels,
      obstacles: layout.obstacles.map(x => ({
        symbolKey: x.symbolKey,
        obstacleId: x.obstacleId,
        height: x.height,
        origPoly: x.origPoly.geoJson,
        transform: x.transform,
        center: x.center,
        meta: x.origPoly.meta,
      })),
      rooms: layout.rooms.map((x) => x.geoJson),
      walls: layout.walls.map((x) => x.geoJson),
      windows: layout.windows.map((x) => x.json),
      unsorted: layout.unsorted.map((x) => x.geoJson),

      navDecomp: { vs: layout.navDecomp.vs, tris: layout.navDecomp.tris },
      navRects: layout.navRects,
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

  /** @param {Pick<Geomorph.ObstacleSheetRectCtxt, 'symbolKey' | 'obstacleId'>} arg0 */
  symbolObstacleToKey({ symbolKey, obstacleId }) {
    return /** @type {const} */ (`${symbolKey} ${obstacleId}`);
  }

  /**
   * For nested symbols i.e. before decor becomes `Geomorph.Decor`
   * @param {Meta} meta 
   * @param {Geom.Mat} mat
   * @param {number} [y] Height off the ground
   * @returns {Meta}
   */
  transformDecorMeta(meta, mat, y) {
    return {
      ...meta,
      // aggregate `y` i.e. height off ground,
      // 🔔 except y=0 which is forced to be "on the ground"
      y: meta.y === 0 ? 0.01 : (Number(y) || 0) + (Number(meta.y) || 0.01),
      // transform `transform` i.e. affine transform from unit quad (0,0)...(1,1) to rect
      ...Array.isArray(meta.transform) && {
        transform: tmpMat2.setMatrixValue(tmpMat1).preMultiply(/** @type {Geom.SixTuple} */ (meta.transform)).toArray(),
      },
      // transform `direction` i.e. unit vector
      ...meta.direction != undefined && {
        direction: mat.transformSansTranslate({...meta.direction}),
      },
    };
  }
}

export const geomorph = new GeomorphService();

export class Connector {
  /**
   * @param {Geom.Poly} poly
   * usually a rotated rectangle, but could be a curved window, in which case we'll view it as its AABB
   */
  constructor(poly) {
    // 🔔 orientation MUST be clockwise w.r.t y-downwards
    poly.fixOrientationConvex();

    /** @type {Geom.Poly} usually a rotated rectangle, but could be a curved window, in which case we'll view it as its AABB */
    this.poly = poly;
    /** @type {Geom.Vect} */
    this.center = poly.center;
    /** @type {Meta} */
    this.meta = poly.meta || {};

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

    // 🔔 hull door normals should point outwards
    if (this.meta.hull === true) {
      const edge = /** @type {Geomorph.HullDoorMeta} */ (this.meta).edge;
      if (
        edge === 'n' && this.normal.y > 0
        || edge === 'e' && this.normal.x < 0
        || edge === 's' && this.normal.y < 0
        || edge === 'w' && this.normal.x > 0
      ) {
        this.normal.scale(-1);
        this.seg = [v, u];
      }
    }

    /**
     * 🔔 every unsealed hull door is auto
     * 🔔 unsealed non-hull locked doors default to auto
     */
    if (
      this.meta.sealed !== true && (
      this.meta.hull === true
      || (this.meta.manual !== true && this.meta.locked === true)
    )) {
      this.meta.auto = true;
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
     * `[id of room infront, id of room behind]`
     * - a room is *infront* if `normal` is pointing towards it.
     * - hull doors have form `[null, roomId]` because their normal points outwards
     * @type {[null | number, null | number]}
     */
    this.roomIds = [null, null];

    /** @type {number} overridden later */
    this.navRectId = -1;
  }

  /** @returns {Geomorph.ConnectorJson} */
  get json() {
    return {
      poly: Object.assign(this.poly.geoJson, { meta: this.meta }),
      navRectId: this.navRectId,
      roomIds: [this.roomIds[0], this.roomIds[1]],
    };
  }

  /** @param {Geomorph.ConnectorJson} json */
  static from(json) {
    const connector = new Connector(Object.assign(Poly.from(json.poly), { meta: json.poly.meta }));
    connector.navRectId = json.navRectId;
    connector.roomIds = json.roomIds;
    return connector;
  }

  /**
   * Doorways are the navigable entries/exits of a door.
   * - They are not as wide as the door by `2 * wallOutset`.
   * - They are deeper then the door by
   *   (a) `wallOutset` for hull doors.
   *   (b) `2 * wallOutset` for non-hull doors.
   * @param {number} [extrudeDoorDepth]
   * @param {number} [halfWidth]
   * @returns {Geom.Poly}
   */
  computeDoorway(extrudeDoorDepth = wallOutset, halfWidth) {
    const doorHalfDepth = 0.5 * (this.meta.hull ? hullDoorDepth : doorDepth);
    const inwardsExtrude = extrudeDoorDepth;
    /**
     * For hull doors, normals point outwards from geomorphs,
     * and we exclude "outer part" of doorway to fix doorway normalization.
     */
    const outwardsExtrude = this.meta.hull === true ? 0 : extrudeDoorDepth;

    const normal = this.normal;
    const delta = tmpVect1.copy(this.seg[1]).sub(this.seg[0]);
    const length = delta.length;
    
    halfWidth ??= length / 2 - wallOutset;
    const offset = halfWidth / length;

    return new Poly([
      new Vect(
        this.center.x + delta.x * offset + normal.x * (doorHalfDepth + outwardsExtrude),
        this.center.y + delta.y * offset + normal.y * (doorHalfDepth + outwardsExtrude),
      ),
      new Vect(
        this.center.x - delta.x * offset + normal.x * (doorHalfDepth + outwardsExtrude),
        this.center.y - delta.y * offset + normal.y * (doorHalfDepth + outwardsExtrude),
      ),
      new Vect(
        this.center.x - delta.x * offset - normal.x * (doorHalfDepth + inwardsExtrude),
        this.center.y - delta.y * offset - normal.y * (doorHalfDepth + inwardsExtrude),
      ),
      new Vect(
        this.center.x + delta.x * offset - normal.x * (doorHalfDepth + inwardsExtrude),
        this.center.y + delta.y * offset - normal.y * (doorHalfDepth + inwardsExtrude),
      ),
    ]).fixOrientationConvex();
  }

  /**
   * Cannot re-use `computeDoorway` because it accounts for "outer hull door".
   * The first segment is pointed to by `normal`.
   * @returns {[Geom.Vect, Geom.Vect, Geom.Vect, Geom.Vect]} `[srcSeg0, srcSeg1, dstSeg0, dstSeg0]`
   */
  computeEntrances() {
    const entranceHalfDepth = this.meta.hull === true ? offMeshConnectionHalfDepth.hull : offMeshConnectionHalfDepth.nonHull;
    const normal = this.normal;
    const delta = tmpVect1.copy(this.seg[1]).sub(this.seg[0]);
    const length = delta.length;
    const halfWidth = length / 2 - wallOutset;
    const offset = halfWidth / length;

    return [
      new Vect(
        this.center.x + delta.x * offset + normal.x * entranceHalfDepth,
        this.center.y + delta.y * offset + normal.y * entranceHalfDepth,
      ),
      new Vect(
        this.center.x - delta.x * offset + normal.x * entranceHalfDepth,
        this.center.y - delta.y * offset + normal.y * entranceHalfDepth,
      ),
      new Vect(
        this.center.x - delta.x * offset - normal.x * entranceHalfDepth,
        this.center.y - delta.y * offset - normal.y * entranceHalfDepth,
      ),
      new Vect(
        this.center.x + delta.x * offset - normal.x * entranceHalfDepth,
        this.center.y + delta.y * offset - normal.y * entranceHalfDepth,
      ),
    ];
  }

  /**
   * The thin polygon is the connector polygon with its depth restricted,
   * so it doesn't jut out from its surrounding walls.
   * @returns {Geom.Poly}
   */
  computeThinPoly(extraDepth = 0) {
    const height = (this.meta.hull ? hullDoorDepth : doorDepth) + extraDepth;
    const hNormal = this.normal;
    const topLeft = this.seg[0].clone().addScaled(hNormal, -height/2);
    const botLeft = topLeft.clone().addScaled(hNormal, height);
    const botRight = this.seg[1].clone().addScaled(hNormal, height/2);
    const topRight = botRight.clone().addScaled(hNormal, -height);
    return new Poly([topLeft, botLeft, botRight, topRight], undefined, this.meta).fixOrientation();
  }
}

const tmpVect1 = new Vect();
const tmpMat1 = new Mat();
const tmpMat2 = new Mat();

const metaVarNames = ['wallHeight'];
const metaVarValues = [wallHeight];
