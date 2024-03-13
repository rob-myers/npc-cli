/**
 * @param {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D} ctxt
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
 * @param {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D} ctxt
 * @param {Geom.Poly[]} polys
 * @param {boolean} [stroke]
 */
export function fillPolygons(ctxt, polys, stroke = false) {
  for (const poly of polys) {
    ctxt.beginPath();
    fillRing(ctxt, poly.outline, false);
    for (const hole of poly.holes) {
      fillRing(ctxt, hole, false);
    }
    ctxt.fill();
    stroke && ctxt.stroke();
  }
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
