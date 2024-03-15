import * as htmlparser2 from "htmlparser2";
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
    "stateroom--014--2x2": true,
  };

  /**
   * @param {Geomorph.GeomorphKey} gmKey
   * @param {Geomorph.Assets} assets
   * @returns {Geomorph.Layout}
   */
  computeLayout(gmKey, assets) {
    // 🚧
    const { hullKey } = this.gmKeyToKeys(gmKey);
    const { pngRect } = assets.symbols[hullKey];
    const { lastModified } = assets.meta[gmKey];
    return { key: gmKey, pngRect: Rect.fromJson(pngRect), lastModified };
  }

  /**
   * Computation differs for hull vs non-hull symbols.
   * @param {Geomorph.PreParsedSymbol<Geom.Poly>} partial
   */
  computeSymbolFloor(partial) {
    let floor = /** @type {null | Geom.Poly} */ (null);

    const wallsKey = partial.isHull ? "hullWalls" : "walls";
    const union = Poly.union(partial[wallsKey]).map((poly) => poly.removeHoles());

    if (union.length > 1) {
      warn(`${partial.key}: ${wallsKey} are not connected`);
    }
    if (union.length > 0) {
      // 🚧 hard-coded
      const [insetted] = geom.createInset(union[0], wallsKey === "walls" ? 1 : 2);
      floor = insetted?.outline.length ? insetted : null;
    }
    if (floor === null) {
      warn(`${partial.key}: ${wallsKey} empty: using rectangular floor`);
      floor = Poly.fromRect({ x: 0, y: 0, ...partial });
    }
    return floor;
  }

  /**
   * @param {Geomorph.AssetsJson} assetsJson
   * @return {Geomorph.Assets}
   */
  deserializeAssets({ maps, meta, symbols }) {
    return {
      meta,
      symbols: mapValues(symbols, this.deserializeSymbol),
      maps,
    };
  }

  /**
   * @param {Geomorph.ParsedSymbol<Geom.GeoJsonPolygon>} json
   * @returns {Geomorph.ParsedSymbol<Poly, Geom.Vect>}
   */
  deserializeSymbol(json) {
    return {
      key: json.key,
      isHull: json.isHull,
      hullWalls: json.hullWalls.map(Poly.from),
      obstacles: json.obstacles.map((x) => Object.assign(Poly.from(x), { meta: x.meta })),
      walls: json.walls.map(Poly.from),
      doors: json.doors.map((x) => Object.assign(Poly.from(x), { meta: x.meta })),
      unsorted: json.unsorted.map((x) => Object.assign(Poly.from(x), { meta: x.meta })),
      width: json.width,
      height: json.height,
      pngRect: json.pngRect,
      symbols: json.symbols,
      floor: Poly.from(json.floor),
      wallEdges: json.wallEdges.map(([u, v]) => [Vect.from(u), Vect.from(v)]),
    };
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

    return poly ? [poly.precision(4).cleanFinalReps()] : [];
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

    // Support e.g. `76.028px 97.3736px`, `50% 50%`
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
        if (tagStack.at(-1)?.tagName !== "title") {
          return;
        }
        const parent = assertDefined(tagStack.at(-2));
        const gmNumber = Number(contents); // e.g. 301

        if (parent.tagName !== "rect") {
          return (
            parent.tagName !== "pattern" &&
            warn(`parseMap: ${parent.tagName} ${contents}: ignored non-rect in map`)
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

        transform &&
          gms.push({
            gmKey: geomorphService.toGmKey[gmNumber],
            transform: geom.reduceAffineTransform(
              { ...rect },
              transform,
              transformOrigin ?? { x: 0, y: 0 }
            ),
          });
        // console.log({ gmNumericKey, parentTagMeta });
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
   * @returns {Geomorph.ParsedSymbol<Geom.Poly, Geom.Vect>}
   */
  parseSymbol(symbolKey, svgContents) {
    // info("parseStarshipSymbol", symbolKey, "...");
    const isHull = symbolKey.endsWith("--hull");
    /** Non-hull symbol are scaled up by 5 inside SVGs */
    const geomScale = isHull ? 1 : 1 / 5;

    const tagStack = /** @type {{ tagName: string; attributes: Record<string, string>; }[]} */ ([]);
    const folderStack = /** @type {string[]} */ ([]);

    let viewBoxRect = /** @type {Geom.RectJson | null} */ (null);
    let pngRect = /** @type {Geom.RectJson | null} */ (null);
    const symbols = /** @type {Geomorph.ParsedSymbol<Geom.Poly>['symbols']} */ ([]);
    const hullWalls = /** @type {Geom.Poly[]} */ ([]);
    const obstacles = /** @type {Geomorph.WithMeta<Geom.Poly>[]} */ ([]);
    const doors = /** @type {Geomorph.WithMeta<Geom.Poly>[]} */ ([]);
    const unsorted = /** @type {Geomorph.WithMeta<Geom.Poly>[]} */ ([]);
    const walls = /** @type {Geom.Poly[]} */ ([]);

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
        if (tagStack.at(-1)?.tagName !== "title") {
          return;
        }

        const parent = assertDefined(tagStack.at(-2));

        if (parent.tagName === "g") {
          folderStack.push(contents);
          contents !== "symbols" && warn(`unexpected folder: "${contents}" will be ignored`);
          return;
        }
        if (parent.tagName === "pattern") {
          return; // Ignore <title> inside <defs>
        }

        const ownTags = contents.split(" ");
        // info({ parent, ownTags });

        if (folderStack.length === 1 && folderStack[0] === "symbols") {
          const [symbolKey, ...symbolTags] = ownTags;
          if (parent.tagName !== "rect") {
            return warn(`parseSymbol: symbols: ${parent.tagName} ${contents}: ignored non-rect`);
          }
          if (!geomorphService.isSymbolKey(symbolKey)) {
            return warn(`parseSymbol: symbols: ${contents}: first tag must be a symbol key`);
          }

          const rect = geomorphService.extractRect(parent.attributes);
          const transform = geomorphService.extractSixTuple(parent.attributes.transform);
          // 🚧 can we ignore transformBox?
          const { transformOrigin, transformBox } = geomorphService.extractTransformData({
            ...parent,
            title: contents,
          });

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

        if (folderStack.length) {
          return; // Only depth 0 and folder 'symbols' supported
        }

        if (ownTags.includes("hull-wall")) {
          // hull symbols only
          hullWalls.push(...geomorphService.extractGeom({ ...parent, title: contents }));
        } else if (ownTags.includes("wall")) {
          walls.push(...geomorphService.extractGeom({ ...parent, title: contents }, geomScale));
        } else if (ownTags.includes("obstacle")) {
          const meta = geomorphService.tagsToMeta(ownTags, {});
          obstacles.push(
            ...geomorphService
              .extractGeom({ ...parent, title: contents }, geomScale)
              .map((poly) => Object.assign(poly, { meta }))
          );
        } else if (ownTags.includes("door")) {
          const meta = geomorphService.tagsToMeta(ownTags, {});
          doors.push(
            ...geomorphService
              .extractGeom({ ...parent, title: contents }, geomScale)
              .map((poly) => Object.assign(poly, { meta }))
          );
        } else if (parent.tagName === "image") {
          return;
        } else {
          const meta = geomorphService.tagsToMeta(ownTags, {});
          unsorted.push(
            ...geomorphService
              .extractGeom({ ...parent, title: contents }, geomScale)
              .map((poly) => Object.assign(poly, { meta }))
          );
        }
      },
      onclosetag(name) {
        tagStack.pop();
        if (name === "g") {
          folderStack.pop();
        }
      },
    });

    debug(`parsedStarshipSymbol: parsing ${symbolKey}`);
    parser.write(svgContents);
    parser.end();

    if (!viewBoxRect) {
      throw Error(`parseStarshipSymbol: ${symbolKey} must have viewBox (or viewbox)`);
    }

    const key = symbolKey;
    const { width, height } = viewBoxRect;
    /** @type {Geomorph.PreParsedSymbol<Geom.Poly>} */
    const preParse = {
      key,
      hullWalls,
      isHull,
      walls,
      width,
      height,
    };
    const { floor, wallEdges } = this.postParseSymbol(preParse);

    return {
      ...preParse,
      obstacles,
      pngRect: pngRect ?? (info(`${symbolKey}: using viewBox for pngRect`), viewBoxRect),
      symbols,
      doors,
      unsorted,
      floor,
      wallEdges,
    };
  }

  /**
   * @param {Geomorph.PreParsedSymbol<Geom.Poly>} partial
   */
  postParseSymbol(partial) {
    const floor = this.computeSymbolFloor(partial);
    const walls = partial.hullWalls.concat(partial.walls);

    if (partial.isHull) {
      console.log(partial.hullWalls.length, partial.walls.length);
      console.log(partial.hullWalls.flatMap((x) => x.outline));
    }

    /** Those edges contained outside @see {floor} */
    const wallEdges = walls
      .flatMap((poly) => poly.lineSegs)
      .filter(([u, v]) => !floor.contains(u) && !floor.contains(v));

    return {
      floor,
      wallEdges,
    };
  }

  /**
   * Create serializable data associated to a static/assets/symbol/{symbol},
   * e.g. to store inside assets-meta.json.
   * @param {Geomorph.ParsedSymbol<Geom.Poly, Geom.Vect>} parsed
   * @returns {Geomorph.ParsedSymbol<Geom.GeoJsonPolygon>}
   */
  serializeSymbol(parsed) {
    return {
      key: parsed.key,
      isHull: parsed.isHull,
      hullWalls: parsed.hullWalls.map((x) => x.geoJson),
      obstacles: parsed.obstacles.map((x) => Object.assign(x.geoJson, { meta: x.meta })),
      walls: parsed.walls.map((x) => x.geoJson),
      doors: parsed.doors.map((x) => Object.assign(x.geoJson, { meta: x.meta })),
      unsorted: parsed.unsorted.map((x) => Object.assign(x.geoJson, { meta: x.meta })),
      width: parsed.width,
      height: parsed.height,
      pngRect: parsed.pngRect,
      symbols: parsed.symbols,
      floor: parsed.floor.geoJson,
      wallEdges: parsed.wallEdges.map(([u, v]) => [u.json, v.json]),
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
