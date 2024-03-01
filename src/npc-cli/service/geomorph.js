import * as htmlparser2 from "htmlparser2";
import { Mat, Poly, Rect } from "../geom";
import { assertDefined, parseJsArg } from "./generic";
import { geom } from "./geom";

class GeomorphService {
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
        (console.warn(`extractGeom: path must be single connected polygon with ≥ 0 holes`, a),
        null);
    } else {
      console.warn(`extractGeom: ${tagName}: unexpected tagName`, a);
    }

    // DOMMatrix not available server-side
    const { transformOrigin, transformBox } = geomorphService.extractTransformData(tagMeta);
    if (a.transform && transformOrigin) {
      if (transformBox === "fill-box") {
        if (!a.x || !a.y) {
          // broken when <path> lacks attribs x, y
          // 🚧 try computing bounding box of `pathEl.d`
          console.warn(
            `${title}: ${tagName}: unsupported "transform-box: fill-box" without x and y`
          );
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
        console.warn(
          `extractTransformData: ${tagMeta.tagName}: ignored transform-origin with format "${transformOrigin}"`
        );
      return { transformOrigin: null, transformBox };
    }
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
    let viewBoxRect = /** @type {Geom.RectJson | null} */ (null);
    let pngRect = /** @type {Geom.RectJson | null} */ (null);
    const hullWalls = /** @type {Geom.Poly[]} */ ([]);
    const obstacles = /** @type {Geomorph.PolyWithMeta<Geom.Poly>[]} */ ([]);
    const unsorted = /** @type {Geomorph.PolyWithMeta<Geom.Poly>[]} */ ([]);
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
            x: Number(attributes.x ?? 0),
            y: Number(attributes.y ?? 0),
            width: Number(attributes.width ?? 0),
            height: Number(attributes.height ?? 0),
          };
        }

        tagStack.push({ tagName: name, attributes });
      },
      ontext(contents) {
        if (tagStack.at(-1)?.tagName !== "title") {
          return;
        }

        const parentTagMeta = assertDefined(tagStack.at(-2));
        const ownTags = contents.split(" ");
        // console.log({ parentTag, contents });

        if (ownTags.includes("hull-wall")) {
          hullWalls.push(...geomorphService.extractGeom({ ...parentTagMeta, title: contents }));
        } else if (ownTags.includes("wall")) {
          walls.push(...geomorphService.extractGeom({ ...parentTagMeta, title: contents }));
        } else if (ownTags.includes("obstacle")) {
          const meta = geomorphService.tagsToMeta(ownTags, {});
          obstacles.push(
            ...geomorphService
              .extractGeom({ ...parentTagMeta, title: contents })
              .map((poly) => ({ poly, meta }))
          );
        } else if (parentTagMeta.tagName === "image") {
          return;
        } else {
          const meta = geomorphService.tagsToMeta(ownTags, {});
          unsorted.push(
            ...geomorphService
              .extractGeom({ ...parentTagMeta, title: contents })
              .map((poly) => ({ poly, meta }))
          );
        }
      },
      onclosetag() {
        tagStack.pop();
      },
    });
    parser.write(svgContents);
    parser.end();

    if (!viewBoxRect) {
      throw Error(`parseStarshipSymbol: ${symbolKey} must have viewBox (or viewbox)`);
    }

    return {
      key: symbolKey,
      ...(hullWalls.length && { hullWalls }),
      width: viewBoxRect.width,
      height: viewBoxRect.height,
      lastModified,
      obstacles,
      pngRect:
        pngRect ??
        (console.info(`${symbolKey} is using viewBox for pngRect ${JSON.stringify(pngRect)}`),
        viewBoxRect),
      unsorted,
      walls,
    };
  }

  /**
   * Create serializable data associated to a static/assets/symbol/{symbol},
   * e.g. to store inside symbols-meta.json.
   * @param {Geomorph.ParsedSymbol<Poly>} parsed
   * @returns {Geomorph.ParsedSymbol<Geom.GeoJsonPolygon>}
   */
  serializeSymbol(parsed) {
    return {
      key: parsed.key,
      hullWalls: parsed.hullWalls?.map((x) => x.geoJson),
      obstacles: parsed.obstacles.map(({ meta, poly }) => ({ meta, poly: poly.geoJson })),
      walls: parsed.walls.map((x) => x.geoJson),
      unsorted: parsed.unsorted.map(({ meta, poly }) => ({ meta, poly: poly.geoJson })),
      width: parsed.width,
      height: parsed.height,
      pngRect: parsed.pngRect,
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
