import * as htmlparser2 from "htmlparser2";
import { Mat, Poly, Rect } from "../geom";
import { assertDefined, info, parseJsArg, warn, debug, safeJsonParse } from "./generic";
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
   * @private
   * @param {{ tagName: string; attributes: Record<string, string>; title: string; }} tagMeta
   * @returns {Geom.Poly[]} Either empty or a singleton
   */
  extractGeom(tagMeta) {
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

    return poly ? [poly.precision(4).cleanFinalReps()] : [];
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
   * @param {number} lastModified
   * @returns {Geomorph.MapLayout}
   */
  parseMap(mapKey, svgContents, lastModified) {
    const gms = /** @type {Geomorph.MapLayout['gms']} */ ([]);
    const tagStack = /** @type {{ tagName: string; attributes: Record<string, string>; }[]} */ ([]);

    const parser = new htmlparser2.Parser({
      onopentag(name, attributes) {
        tagStack.push({ tagName: name, attributes });
      },
      ontext(contents) {
        if (tagStack.at(-1)?.tagName !== "title") {
          return;
        }
        const gmNumericKey = Number(contents); // e.g. 301
        if (!geomorphService.isGmNumber(gmNumericKey)) {
          return warn(`parseMap: "${contents}": expected valid gm number`);
        }
        const parentTagMeta = assertDefined(tagStack.at(-2));
        const transform = geomorphService.extractSixTuple(parentTagMeta.attributes.transform);

        transform &&
          gms.push({
            gmKey: geomorphService.toGmKey[gmNumericKey], // fix rounding errors in Boxy
            transform: /** @type {Geom.SixTuple} */ (transform.map(Math.round)),
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
   * @param {Geomorph.SymbolKey} symbolKey
   * @param {string} svgContents
   * @param {number} lastModified
   * @returns {Geomorph.ParsedSymbol<Geom.Poly>}
   */
  parseStarshipSymbol(symbolKey, svgContents, lastModified) {
    // console.info("parseStarshipSymbol", symbolKey, "...");

    const tagStack = /** @type {{ tagName: string; attributes: Record<string, string>; }[]} */ ([]);
    const folderStack = /** @type {string[]} */ ([]);

    let viewBoxRect = /** @type {Geom.RectJson | null} */ (null);
    let pngRect = /** @type {Geom.RectJson | null} */ (null);
    const symbols = /** @type {Geomorph.ParsedSymbol<Geom.Poly>['symbols']} */ ([]);
    const hullWalls = /** @type {Geom.Poly[]} */ ([]);
    const obstacles = /** @type {Geomorph.PolyWithMeta[]} */ ([]);
    const unsorted = /** @type {Geomorph.PolyWithMeta[]} */ ([]);
    const walls = /** @type {Geom.Poly[]} */ ([]);

    const parser = new htmlparser2.Parser({
      onopentag(name, attributes) {
        // console.info(name, attributes);

        if (name === "svg") {
          // viewBox -> viewbox
          const [x, y, width, height] = attributes.viewbox.trim().split(/\s+/).map(Number);
          viewBoxRect = { x, y, width, height };
        }
        if (name === "image") {
          pngRect = {
            x: Number(attributes.x || 0),
            y: Number(attributes.y || 0),
            width: Number(attributes.width || 0),
            height: Number(attributes.height || 0),
          };
        }

        tagStack.push({ tagName: name, attributes });
      },
      ontext(contents) {
        if (tagStack.at(-1)?.tagName !== "title") {
          return;
        }

        const parent = assertDefined(tagStack.at(-2));

        if (parent.tagName === "g") {
          folderStack.push(contents);
          return;
        }
        if (parent.tagName === "pattern") {
          return; // Ignore <title> inside <defs>
        }

        const ownTags = contents.split(" ");
        // info({ parentTag, ownTags });

        if (folderStack.length === 1 && folderStack[0] === "symbols") {
          const [symbolKey, ...symbolTags] = ownTags;
          if (parent.tagName !== "rect") {
            return warn(
              `parseStarshipSymbol: ${parent.tagName}: ignored non-rect in symbols folder`
            );
          }
          if (!geomorphService.isSymbolKey(symbolKey)) {
            return warn(
              `parseStarshipSymbol: symbols: ${contents}: first tag must be a symbol key`
            );
          }

          const [x, y, width, height] = ["x", "y", "width", "height"].map((x) =>
            Math.round(Number(parent.attributes[x] || 0))
          );
          const transform = geomorphService.extractSixTuple(parent.attributes.transform);
          transform &&
            symbols.push({
              symbolKey,
              meta: geomorphService.tagsToMeta(symbolTags, { key: symbolKey }),
              rect: { x, y, width, height },
              transform,
            });
          return;
        }

        if (ownTags.includes("hull-wall")) {
          hullWalls.push(...geomorphService.extractGeom({ ...parent, title: contents }));
        } else if (ownTags.includes("wall")) {
          walls.push(...geomorphService.extractGeom({ ...parent, title: contents }));
        } else if (ownTags.includes("obstacle")) {
          const meta = geomorphService.tagsToMeta(ownTags, {});
          obstacles.push(
            ...geomorphService
              .extractGeom({ ...parent, title: contents })
              .map((poly) => ({ poly, meta }))
          );
        } else if (parent.tagName === "image") {
          return;
        } else {
          const meta = geomorphService.tagsToMeta(ownTags, {});
          unsorted.push(
            ...geomorphService
              .extractGeom({ ...parent, title: contents })
              .map((poly) => ({ poly, meta }))
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

    return {
      key: symbolKey,
      isHull: symbolKey.endsWith("--hull"),
      hullWalls,
      width: viewBoxRect.width,
      height: viewBoxRect.height,
      lastModified,
      obstacles,
      pngRect:
        pngRect ??
        (info(`${symbolKey} is using viewBox for pngRect ${JSON.stringify(pngRect)}`), viewBoxRect),
      symbols,
      unsorted,
      walls,
    };
  }

  /**
   * Create serializable data associated to a static/assets/symbol/{symbol},
   * e.g. to store inside assets-meta.json.
   * @param {Geomorph.ParsedSymbol<Poly>} parsed
   * @returns {Geomorph.ParsedSymbol<Geom.GeoJsonPolygon>}
   */
  serializeSymbol(parsed) {
    return {
      key: parsed.key,
      isHull: parsed.isHull,
      hullWalls: parsed.hullWalls.map((x) => x.geoJson),
      obstacles: parsed.obstacles.map(({ meta, poly }) => ({ meta, poly: poly.geoJson })),
      walls: parsed.walls.map((x) => x.geoJson),
      unsorted: parsed.unsorted.map(({ meta, poly }) => ({ meta, poly: poly.geoJson })),
      width: parsed.width,
      height: parsed.height,
      pngRect: parsed.pngRect,
      symbols: parsed.symbols,
      lastModified: parsed.lastModified,
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
