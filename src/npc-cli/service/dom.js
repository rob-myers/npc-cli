/**
 * @typedef {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | import('canvas').CanvasRenderingContext2D} CanvasContext2DType
 */

import { isDevelopment } from './generic';

/**
 * @param {CanvasContext2DType} ct
 * @param {Geom.VectJson} center
 * @param {number} radius
 * @param {[fillStyle?: string | null, strokeStyle?: string | null, lineWidth?: number | null]} [style]
 */
export function drawCircle(ct, center, radius, [fillStyle, strokeStyle, lineWidth] = []) {
  ct.fillStyle = fillStyle || ct.fillStyle;
  ct.strokeStyle = strokeStyle || ct.strokeStyle;
  ct.lineWidth = lineWidth || ct.lineWidth;
  ct.beginPath();
  ct.ellipse(center.x, center.y, radius, radius, 0, 0, 2 * Math.PI);
  fillStyle !== null && ct.fill();
  strokeStyle !== null && ct.stroke();
}

/**
 * @param {CanvasContext2DType} ct
 * @param {Geom.Poly | Geom.Poly[]} polys
 * @param {[fillStyle?: string | null, strokeStyle?: string | null, lineWidth?: number | null]} [style]
 * @param {false | 'clip'} [clip]
 */
export function drawPolygons(ct, polys, [fillStyle, strokeStyle, lineWidth] = [], clip = false) {
  polys = Array.isArray(polys) ? polys : [polys];
  ct.fillStyle = fillStyle || ct.fillStyle;
  ct.strokeStyle = strokeStyle || ct.strokeStyle;
  ct.lineWidth = lineWidth || ct.lineWidth;
  for (const poly of polys) {
    ct.beginPath();
    fillRing(ct, poly.outline, false);
    for (const hole of poly.holes) {
      fillRing(ct, hole, false);
    }
    fillStyle !== null && clip === false ? ct.fill() : ct.clip();
    strokeStyle !== null && ct.stroke();
  }
}

/**
 * @param {CanvasContext2DType} ct
 * @param  {Geom.VectJson[]} ring
 */
export function fillRing(ct, ring, fill = true) {
  if (ring.length) {
    ct.moveTo(ring[0].x, ring[0].y);
    ring.forEach((p) => ct.lineTo(p.x, p.y));
    fill && ct.fill();
    ct.closePath();
  }
}

/** Override cache in development */
export function getAssetQueryParam() {
  return isDevelopment() ? `?v=${Date.now()}` : '';
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

/**
 * @param {CanvasContext2DType} ct
 * @param {Geom.VectJson} from
 * @param {Geom.VectJson} to
 */
export function strokeLine(ct, from, to) {
  ct.beginPath();
  ct.moveTo(from.x, from.y);
  ct.lineTo(to.x, to.y);
  ct.stroke();
}
