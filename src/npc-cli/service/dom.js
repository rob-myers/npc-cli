/**
 * @typedef {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | import('canvas').CanvasRenderingContext2D} CanvasContext2DType
 */

/**
 * @param {CanvasContext2DType} ctxt
 * @param {Geom.Poly | Geom.Poly[]} polys
 * @param {[fillStyle?: string | null, strokeStyle?: string | null, lineWidth?: number | null]} [style]
 * @param {false | 'clip'} [clip]
 */
export function drawPolygons(ctxt, polys, [fillStyle, strokeStyle, lineWidth] = [], clip = false) {
  polys = Array.isArray(polys) ? polys : [polys];
  ctxt.fillStyle = fillStyle || ctxt.fillStyle;
  ctxt.strokeStyle = strokeStyle || ctxt.strokeStyle;
  ctxt.lineWidth = lineWidth || ctxt.lineWidth;
  for (const poly of polys) {
    ctxt.beginPath();
    fillRing(ctxt, poly.outline, false);
    for (const hole of poly.holes) {
      fillRing(ctxt, hole, false);
    }
    fillStyle !== null && clip === false ? ctxt.fill() : ctxt.clip();
    strokeStyle !== null && ctxt.stroke();
  }
}

/**
 * @param {CanvasContext2DType} ctxt
 * @param  {Geom.VectJson[]} ring
 */
export function fillRing(ctxt, ring, fill = true) {
  if (ring.length) {
    ctxt.moveTo(ring[0].x, ring[0].y);
    ring.forEach((p) => ctxt.lineTo(p.x, p.y));
    fill && ctxt.fill();
    ctxt.closePath();
  }
}

/**
 * @param {CanvasContext2DType} ctxt
 * @param {Geom.VectJson} from
 * @param {Geom.VectJson} to
 */
export function strokeLine(ctxt, from, to) {
  ctxt.beginPath();
  ctxt.moveTo(from.x, from.y);
  ctxt.lineTo(to.x, to.y);
  ctxt.stroke();
}

/**
 * https://stackoverflow.com/a/4819886/2917822
 * If Chrome devtool initially open as mobile device,
 * `'ontouchstart' in window` continues to be true if switch to desktop.
 */
export function isTouchDevice() {
  return (
    typeof window !== "undefined" &&
    ("ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      /** @type {*} */ (navigator).msMaxTouchPoints > 0)
  );
}
