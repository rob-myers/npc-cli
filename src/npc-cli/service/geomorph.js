import * as htmlparser2 from "htmlparser2";
import * as THREE from "three";

import { worldScale, precision } from "./const";
import { Mat, Poly, Rect, Vect } from "../geom";
import {
  assertDefined,
  info,
  parseJsArg,
  warn,
  debug,
  safeJsonParse,
  mapValues,
  keys,
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

  /** @type {Record<Geomorph.SymbolKey, true>} */
  fromSymbolKey = {
    "101--hull": true,
    "102--hull": true,
    "103--hull": true,
    "301--hull": true,
    "302--hull": true,
    "303--hull": true,

    "bridge--042--8x9": true,
    "empty-room--013--2x3": true,
    "misc-stellar-cartography--023--4x4": true,
    "office--001--2x2": true,
    "office--026--2x3": true,
    "office--020--2x3": true,
    "office--023--2x3": true,
    "stateroom--014--2x2": true,
    "stateroom--020--2x3": true,
    "stateroom--036--2x4": true,
    // 🚧 must extend when adding new symbols
  };

  /** @type {Geomorph.SymbolKey[]} */
  get hullKeys() {
    return keys(this.fromSymbolKey).filter(this.isHullKey);
  }

  /**
   * When hull symbols reference non-hull symbols, they may:
   * - remove doors tagged with `optional`
   * - add walls tagged with `optional`
   * @param {Geomorph.ParsedSymbol} symbol
   * @param {string[]} doorTags e.g. `['s']`
   * @param {string[]} wallTags e.g. `['e']`
   * @param {Geom.SixTuple} transform
   * @returns {{ doors: Geom.ConnectorRect[], walls: Geom.Poly[] }}
   */
  augmentSymbolInBrowser(symbol, doorTags, wallTags, transform) {
    tmpMat1.feedFromArray(transform);
    const doorsToRemove = symbol.removableDoors.filter(({ doorId }) => {
      const { meta } = symbol.doors[doorId];
      return !doorTags.some((tag) => meta[tag] === true);
    });
    const walls = symbol.walls.concat(
      doorsToRemove.map((x) => x.wall),
      symbol.addableWalls.filter(({ meta }) => wallTags.some((tag) => meta[tag] === true))
    );

    return {
      doors: symbol.doors
        .filter((_, doorId) => !doorsToRemove.some((x) => x.doorId === doorId))
        .map((x) => geomorphService.polyToConnector(x.poly.clone().applyMatrix(tmpMat1))),
      walls: walls.map((x) => x.clone().applyMatrix(tmpMat1).cleanFinalReps()),
    };
  }

  /**
   * 🚧
   * @param {Geomorph.GeomorphKey} gmKey
   * @param {Geomorph.Assets} assets
   * @returns {Geomorph.Layout}
   */
  computeLayoutInBrowser(gmKey, assets) {
    const { hullKey } = this.gmKeyToKeys(gmKey);
    const { pngRect, symbols, walls: hullWalls, doors: hullDoors } = assets.symbols[hullKey];
    const { lastModified } = assets.meta[gmKey];

    const wallSegs = hullWalls.flatMap((poly) => poly.lineSegs);
    /** @type {[Geom.Vect, Geom.Vect][]} */
    const doorSegs = hullDoors.map(({ seg: [u, v] }) => [u.clone(), v.clone()]);

    for (const { symbolKey, transform, meta } of symbols) {
      const symbol = assets.symbols[symbolKey];
      const { doors, walls } = geomorphService.augmentSymbolInBrowser(
        symbol,
        meta.doors || [],
        meta.walls || [],
        transform
      );

      tmpMat1.feedFromArray(transform);
      walls.forEach((x) =>
        x.lineSegs.forEach(([u, v], segId) => {
          if (u.equalsAlmost(v)) {
            return warn(`${gmKey}: ${segId}: ignored degen wallSeg: ${JSON.stringify(u.json)}`);
          }
          wallSegs.push([u, v]);
        })
      );
      doors.forEach(({ seg: [u, v] }) => doorSegs.push([u, v]));
    }

    return {
      key: gmKey,
      pngRect: Rect.fromJson(pngRect),
      lastModified,
      doorSegs,
      wallSegs,
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
    };
  }

  /**
   * @param {Geomorph.AssetsJson} assetsJson
   * @return {Geomorph.Assets}
   */
  deserializeAssets({ maps, meta, symbols }) {
    return {
      meta,
      symbols: mapValues(symbols, (x) => this.deserializeSymbol(x)),
      maps,
    };
  }

  /**
   * @param {Geom.ConnectorRectJson} x
   * @returns {Geom.ConnectorRect}
   */
  deserializeConnectorRect(x) {
    const poly = Poly.from(x.poly);
    return {
      ...x,
      poly,
      center: poly.center,
      rect: poly.rect,
      normal: Vect.from(x.normal),
      seg: [Vect.from(x.seg[0]), Vect.from(x.seg[1])],
      entries: [Vect.from(x.entries[0]), Vect.from(x.entries[1])],
    };
  }

  /**
   * @param {Geomorph.ParsedSymbolJson} json
   * @returns {Geomorph.ParsedSymbol}
   */
  deserializeSymbol(json) {
    return {
      key: json.key,
      isHull: json.isHull,
      hullWalls: json.hullWalls.map((x) => Object.assign(Poly.from(x), { meta: x.meta })),
      obstacles: json.obstacles.map((x) => Object.assign(Poly.from(x), { meta: x.meta })),
      walls: json.walls.map((x) => Object.assign(Poly.from(x), { meta: x.meta })),
      doors: json.doors.map(this.deserializeConnectorRect),
      windows: json.windows.map(this.deserializeConnectorRect),
      unsorted: json.unsorted.map((x) => Object.assign(Poly.from(x), { meta: x.meta })),
      width: json.width,
      height: json.height,
      pngRect: json.pngRect,
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
   * @param {THREE.Matrix4} [mat4]
   */
  embedXZMat4(transform, yScale = 1, mat4 = new THREE.Matrix4()) {
    // prettier-ignore
    return mat4.set(
      transform[0], 0,      transform[2], transform[4] * worldScale,
      0,            yScale, 0,            0,
      transform[1], 0,      transform[3], transform[5] * worldScale,
      0,            0,      0,             1
    );
  }

  /**
   * @private
   * @param {{ tagName: string; attributes: Record<string, string>; title: string; }} tagMeta
   * @param {number} [scale]
   * @returns {Geom.Poly[]} Either empty or a singleton
   */
  extractGeom(tagMeta, scale) {
    const { tagName, attributes: a, title } = tagMeta;
    let poly = /** @type {Geom.Poly | null} */ (null);

    if (tagName === "rect" || tagName === "image") {
      poly = Poly.fromRect(
        new Rect(Number(a.x ?? 0), Number(a.y ?? 0), Number(a.width ?? 0), Number(a.height ?? 0))
      );
    } else if (tagName === "path") {
      poly =
        geom.svgPathToPolygon(a.d) ??
        (warn(`extractGeom: path must be single connected polygon with ≥ 0 holes`, a), null);
    } else {
      warn(`extractGeom: ${tagName}: unexpected tagName`, a);
    }

    // DOMMatrix not available server-side
    const { transformOrigin, transformBox } = geomorphService.extractTransformData(tagMeta);
    if (a.transform && transformOrigin) {
      if (transformBox === "fill-box") {
        if (!a.x || !a.y) {
          // broken when <path> lacks attribs x, y
          // 🚧 try computing bounding box of `pathEl.d`
          warn(`${title}: ${tagName}: unsupported "transform-box: fill-box" without x and y`);
        }
        transformOrigin.x += Number(a.x ?? "0");
        transformOrigin.y += Number(a.y ?? "0");
      }
      poly
        ?.translate(-transformOrigin.x, -transformOrigin.y)
        .applyMatrix(new Mat(a.transform))
        .translate(transformOrigin.x, transformOrigin.y);
    } else if (a.transform) {
      poly?.applyMatrix(new Mat(a.transform));
    }

    typeof scale === "number" && poly?.scale(scale);

    return poly ? [poly.precision(precision).cleanFinalReps()] : [];
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
  extractSixTuple(transformAttribute = "matrix(1, 0, 0, 1, 0, 0)", rounded = true) {
    const transform = safeJsonParse(`[${transformAttribute.slice("matrix(".length, -1)}]`);
    if (geom.isTransformTuple(transform)) {
      return rounded ? /** @type {Geom.SixTuple} */ (transform.map(Math.round)) : transform;
    } else {
      warn(`extractSixTuple: "${transformAttribute}": expected format "matrix(a, b, c, d, e, f)"`);
      return null;
    }
  }

  /**
   * In SVG initial CSS value is `0 0` (elsewhere `50% 50% 0`)
   * @private
   * @param {{ tagName: string; attributes: Record<string, string>; title: string; }} tagMeta
   */
  extractTransformData(tagMeta) {
    const style = geomorphService.extractStyles(tagMeta.attributes.style ?? "");
    const { "transform-origin": transformOrigin = "", "transform-box": transformBox = null } =
      style;

    // Support format `76.028px 97.3736px`
    // Support format `50% 50%`
    const [xPart, yPart] = transformOrigin.split(/\s+/);
    if (!xPart || !yPart) {
      return { transformOrigin: null, transformBox };
    }

    const [x, y] = [xPart, yPart].map((rep, i) => {
      /** @type {RegExpMatchArray | null} */ let match = null;
      if ((match = rep.match(/^(-?\d+(?:.\d+)?)%$/))) {
        return (
          (Number(match[1]) / 100) * Number(tagMeta.attributes[i === 0 ? "width" : "height"] ?? "0")
        );
      } else if ((match = rep.match(/^(-?\d+(?:.\d+)?)px$/))) {
        return Number(match[1]);
      } else {
        return null;
      }
    });

    if (Number.isFinite(x) && Number.isFinite(y)) {
      // console.log({ transformOrigin }, x, y);
      return {
        transformOrigin: { x: /** @type {number} */ (x), y: /** @type {number} */ (y) },
        transformBox,
      };
    } else {
      transformOrigin &&
        warn(
          `extractTransformData: ${tagMeta.tagName}: ignored transform-origin with format "${transformOrigin}"`
        );
      return { transformOrigin: null, transformBox };
    }
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
        const transform = geomorphService.extractSixTuple(parent.attributes.transform);
        // 🚧 can we ignore transformBox?
        const { transformOrigin, transformBox } = geomorphService.extractTransformData({
          ...parent,
          title: contents,
        });
        // console.log(mapKey, gmNumber, {
        //   rect,
        //   transform,
        //   transformOrigin,
        //   transformBox,
        // });

        transform &&
          gms.push({
            gmKey: geomorphService.toGmKey[gmNumber],
            transform: geom.reduceAffineTransform(
              { ...rect },
              transform,
              transformOrigin ?? { x: 0, y: 0 }
            ),
          });
      },
      onclosetag() {
        tagStack.pop();
      },
    });

    parser.write(svgContents);
    parser.end();

    return {
      gms,
    };
  }

  /**
   * Parse Starship Symbol
   * @param {Geomorph.SymbolKey} symbolKey
   * @param {string} svgContents
   * @returns {Geomorph.ParsedSymbol}
   */
  parseSymbol(symbolKey, svgContents) {
    // info("parseStarshipSymbol", symbolKey, "...");
    const isHull = this.isHullKey(symbolKey);
    /** Non-hull symbol are scaled up by 5 inside SVGs */
    const geomScale = isHull ? 1 : 1 / 5;

    const tagStack = /** @type {{ tagName: string; attributes: Record<string, string>; }[]} */ ([]);
    const folderStack = /** @type {string[]} */ ([]);

    let viewBoxRect = /** @type {Geom.RectJson | null} */ (null);
    let pngRect = /** @type {Geom.RectJson | null} */ (null);
    const symbols = /** @type {Geomorph.ParsedSymbol['symbols']} */ ([]);
    const hullWalls = /** @type {Geomorph.WithMeta<Geom.Poly>[]} */ ([]);
    const obstacles = /** @type {Geomorph.WithMeta<Geom.Poly>[]} */ ([]);
    const doors = /** @type {Geomorph.WithMeta<Geom.Poly>[]} */ ([]);
    const unsorted = /** @type {Geomorph.WithMeta<Geom.Poly>[]} */ ([]);
    const walls = /** @type {Geomorph.WithMeta<Geom.Poly>[]} */ ([]);
    const windows = /** @type {Geomorph.WithMeta<Geom.Poly>[]} */ ([]);

    const parser = new htmlparser2.Parser({
      onopentag(tag, attributes) {
        // console.info(name, attributes);

        if (tag === "svg") {
          // viewBox -> viewbox
          const [x, y, width, height] = attributes.viewbox.trim().split(/\s+/).map(Number);
          viewBoxRect = { x, y, width, height };
        }
        if (tag === "image") {
          pngRect = {
            x: Number(attributes.x || 0),
            y: Number(attributes.y || 0),
            width: Number(attributes.width || 0),
            height: Number(attributes.height || 0),
          };
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

        // Hull symbol has folder "symbols" defining layout
        if (folderStack[0] === "symbols") {
          const [symbolKey, ...symbolTags] = ownTags;
          if (parent.tagName !== "rect") {
            return warn(`parseSymbol: symbols: ${parent.tagName} ${contents}: ignored non-rect`);
          }
          if (!geomorphService.isSymbolKey(symbolKey)) {
            throw Error(`parseSymbol: symbols: ${contents}: must start with a symbol key`);
          }

          // 🚧 can we ignore transformBox?
          const rect = geomorphService.extractRect(parent.attributes);
          const transform = geomorphService.extractSixTuple(parent.attributes.transform);
          const { transformOrigin, transformBox } = geomorphService.extractTransformData({
            ...parent,
            title: contents,
          });
          // console.log(symbolKey, {
          //   rect,
          //   transform,
          //   transformOrigin,
          //   transformBox,
          // });

          transform &&
            symbols.push({
              symbolKey,
              meta: geomorphService.tagsToMeta(symbolTags, { key: symbolKey }),
              width: rect.width,
              height: rect.height,
              transform: geom.reduceAffineTransform(
                { ...rect },
                transform,
                transformOrigin ?? { x: 0, y: 0 }
              ),
            });

          return;
        }

        const meta = geomorphService.tagsToMeta(ownTags, {});

        /** @type {const} */ ([
          ["hull-wall", hullWalls],
          ["wall", walls, geomScale],
          ["obstacle", obstacles, geomScale],
          ["door", doors, geomScale],
          ["window", windows, geomScale],
          [null, unsorted, geomScale],
        ]).some(
          ([tag, polys, scale]) =>
            (tag === null || ownTags.includes(tag)) &&
            polys.push(
              ...geomorphService
                .extractGeom({ ...parent, title: contents }, scale)
                .map((poly) => Object.assign(poly, { meta }))
            )
        );
      },
      onclosetag(name) {
        tagStack.pop();
        if (name === "g") {
          folderStack.pop();
        }
      },
    });

    debug(`parsing ${symbolKey}`);
    parser.write(svgContents);
    parser.end();

    if (!viewBoxRect) {
      throw Error(`parseStarshipSymbol: ${symbolKey} must have viewBox (or viewbox)`);
    }

    const key = symbolKey;
    const { width, height } = viewBoxRect;

    /** @type {Geomorph.PreParsedSymbol} */
    const preParse = {
      key,
      doors: doors.map((x) => this.polyToConnector(x)),
      windows: windows.map((x) => this.polyToConnector(x)),
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
      pngRect: pngRect ?? (info(`${symbolKey}: using viewBox for pngRect`), viewBoxRect),
      symbols,
      unsorted,

      ...postParse,
    };
  }

  /**
   * - Convert polygon 4-gon into connector
   * - For other n-gons we take aabb.
   * - Orientation must be "fixed" i.e. clockwise w.r.t. y downwards.
   * - Cannot compute `roomIds` or `navGroupId` yet.
   * @param {Geomorph.WithMeta<Geom.Poly>} poly
   * @returns {Geom.ConnectorRect}
   */
  polyToConnector(poly) {
    // 🔔 orientation MUST be clockwise w.r.t y-downwards
    poly.fixOrientationConvex();

    const { meta } = poly;
    const { angle, baseRect } = geom.polyToAngledRect(poly);
    const {
      seg: [u, v],
      normal,
    } = geom.getAngledRectSeg({ angle, baseRect });

    const doorEntryDelta = Math.min(baseRect.width, baseRect.height) / 2 + 0.05;
    const inFront = poly.center.addScaledVector(normal, doorEntryDelta).precision(precision);
    const behind = poly.center.addScaledVector(normal, -doorEntryDelta).precision(precision);
    // const moreInfront = infront.clone().addScaledVector(normal, hullDoorOutset);
    // const moreBehind = behind.clone().addScaledVector(normal, -hullDoorOutset);

    // /** @type {[null | number, null | number]} */
    // const roomIds = rooms.reduce((agg, room, roomId) => {
    //   // Support doors connecting a room to itself e.g.
    //   // galley-and-mess-halls--006--4x2
    //   if (room.contains(moreInfront)) agg[0] = roomId;
    //   if (room.contains(moreBehind)) agg[1] = roomId;
    //   return agg;
    // }, /** @type {[null | number, null | number]} */ ([null, null]));

    return {
      angle,
      poly,
      center: poly.center,
      rect: poly.rect.precision(precision),
      meta,
      seg: [u.precision(precision), v.precision(precision)],
      normal: normal.precision(precision),
      roomIds: [null, null], // added in browser
      entries: [inFront, behind],
      navGroupId: -1, // added later
    };
  }

  /**
   * @param {Geomorph.PreParsedSymbol} partial
   * @returns {Geomorph.PostParsedSymbol}
   */
  postParseSymbol(partial) {
    // assume hull doors cannot be optional
    const hullWalls = Poly.cutOut(
      partial.doors.map((x) => x.poly),
      Poly.union(partial.hullWalls)
    ).map((x) => x.cleanFinalReps());
    const nonOptionalWalls = partial.walls.filter((x) => x.meta.optional !== true);
    const uncutWalls = Poly.union(partial.hullWalls.concat(nonOptionalWalls));
    const walls = Poly.cutOut(
      partial.doors.map((x) => x.poly),
      uncutWalls
    ).map((x) => x.cleanFinalReps());

    const removableDoors = partial.doors.flatMap(({ poly, meta }, doorId) =>
      meta.optional ? { doorId, wall: Poly.intersect([poly], uncutWalls)[0] } : []
    );
    const addableWalls = partial.walls.filter((x) => x.meta.optional === true);

    return {
      hullWalls,
      walls,
      removableDoors,
      addableWalls,
    };
  }

  /**
   * Create serializable data associated to a static/assets/symbol/{symbol},
   * e.g. to store inside assets-meta.json.
   * @param {Geomorph.ParsedSymbol} parsed
   * @returns {Geomorph.ParsedSymbolJson}
   */
  serializeSymbol(parsed) {
    return {
      key: parsed.key,
      isHull: parsed.isHull,
      hullWalls: parsed.hullWalls.map((x) => Object.assign(x.geoJson, { meta: x.meta })),
      obstacles: parsed.obstacles.map((x) => Object.assign(x.geoJson, { meta: x.meta })),
      walls: parsed.walls.map((x) => Object.assign(x.geoJson, { meta: x.meta })),
      doors: parsed.doors.map((x) => ({ ...x, poly: x.poly.geoJson })),
      windows: parsed.windows.map((x) => ({ ...x, poly: x.poly.geoJson })),
      unsorted: parsed.unsorted.map((x) => Object.assign(x.geoJson, { meta: x.meta })),
      width: parsed.width,
      height: parsed.height,
      pngRect: parsed.pngRect,
      symbols: parsed.symbols,
      removableDoors: parsed.removableDoors.map((x) => ({ ...x, wall: x.wall.geoJson })),
      addableWalls: parsed.addableWalls.map((x) => Object.assign(x.geoJson, { meta: x.meta })),
    };
  }

  /**
   * @param {string[]} tags
   * @param {Geomorph.Meta} baseMeta
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
}

export const geomorphService = new GeomorphService();

const tmpPoly1 = new Poly();
const tmpMat1 = new Mat();
