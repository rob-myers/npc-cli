/**
 * @param {string} key
 */
export function getCanvas(key) {
  return canvasLookup[key] ??= document.createElement('canvas');
}

/**
 * @param {string} key
 * @param {CanvasRenderingContext2DSettings} [opts]
 */
export function getContext2d(key, opts) {
  return /** @type {CanvasRenderingContext2D} */ ((
    canvasLookup[key] ??= document.createElement('canvas')
  ).getContext('2d', opts));
}

/** Cache to avoid re-creation on HMR */
const canvasLookup = /** @type {Record<string, HTMLCanvasElement>} */ ({});

const patternLookup = /** @type {Record<string, CanvasPattern>} */ ({});

/**
 * @param {number} dim
 * @param {string} color
 */
export function getGridPattern(dim, color) {
  const key = `grid-pattern-${dim}-${color}`;
  return patternLookup[key] ??= createGridPattern(dim, color);
}

/**
 * @param {PointerEvent | React.PointerEvent | React.MouseEvent} e 
 */
export function getRelativePointer(e) {
  const targetRect = (/** @type {HTMLElement} */ (e.target)).getBoundingClientRect();
  return { x: e.clientX - targetRect.left, y: e.clientY - targetRect.top };
}

/**
 * @param {number} dim
 * @param {string} color
 */
function createGridPattern(dim, color) {
  const tmpCtxt = getContext2d('create-grid-pattern');
  tmpCtxt.canvas.width = tmpCtxt.canvas.height = dim;
  tmpCtxt.resetTransform();
  tmpCtxt.clearRect(0, 0, dim, dim);
  tmpCtxt.strokeStyle = color;
  tmpCtxt.lineWidth = 1;
  tmpCtxt.strokeRect(0, 0, dim, dim);
  tmpCtxt.resetTransform();
  return /** @type {CanvasPattern} */ (tmpCtxt.createPattern(tmpCtxt.canvas, 'repeat'));
}

/**
 * Draw opaque part of `image` in colour `fillColour`
 * @param {HTMLImageElement | HTMLCanvasElement} image 
 * @param {CanvasRenderingContext2D} ctxt
 * @param {string} fillColor
 */
function createMonochromeMask(image, ctxt, fillColor) {
	ctxt.canvas.width = image.width;
	ctxt.canvas.height = image.height;
	ctxt.globalCompositeOperation = 'source-over';
	ctxt.drawImage(/** @type {*} */ (image), 0, 0);
	ctxt.globalCompositeOperation = 'source-in';
	ctxt.fillStyle = fillColor;
	ctxt.fillRect(0, 0, image.width, image.height);
	ctxt.globalCompositeOperation = 'source-over';
}

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
    ct.closePath();
    if (strokeStyle !== null) {
      ct.stroke();
    }
    if (fillStyle !== null) {
      clip === false ? ct.fill() : ct.clip();
    }
  }
}

/**
 * Draw a simple polygon sans holes.
 * @param {CanvasContext2DType} ct
 * @param {Geom.VectJson[]} outline
 * @param {[fillStyle?: string | null, strokeStyle?: string | null, lineWidth?: number | null]} [style]
 * @param {false | 'clip'} [clip]
 */
export function drawSimplePoly(ct, outline, [fillStyle, strokeStyle, lineWidth] = [], clip = false) {
  ct.fillStyle = fillStyle || ct.fillStyle;
  ct.strokeStyle = strokeStyle || ct.strokeStyle;
  ct.lineWidth = lineWidth || ct.lineWidth;
  ct.beginPath();
  fillRing(ct, outline, false);
  if (strokeStyle !== null) {
    ct.closePath();
    ct.stroke();
  }
  if (fillStyle !== null) {
    clip === false ? ct.fill() : ct.clip();
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

/**
 * Invert `canvas`, overwriting it, while also preserving alpha=0.
 * @param {HTMLCanvasElement} canvas 
 * @param {CanvasRenderingContext2D} copyCtxt
 * This will contain a copy of `canvas`.
 * @param {CanvasRenderingContext2D} maskCtxt
 * This will contain a monochrome mask (preserving alpha=0)
 */
export function invertCanvas(canvas, copyCtxt, maskCtxt) {
  const dstCtxt = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

  copyCtxt.canvas.width = canvas.width;
  copyCtxt.canvas.height = canvas.height;
  copyCtxt.drawImage(canvas, 0, 0);
  
	createMonochromeMask(copyCtxt.canvas, maskCtxt, '#ffffff');

	// Take difference to obtain inverted image
	dstCtxt.globalCompositeOperation = 'difference';
	dstCtxt.drawImage(maskCtxt.canvas, 0, 0);
	dstCtxt.globalCompositeOperation = 'source-over';
}

/**
 * Is Ctrl/Shift/Cmd down?
 * @param {MouseEvent} e 
 */
export function isModifierKey(e) {
  return e.shiftKey || e.ctrlKey || e.metaKey;
}

/**
 * Get array of modifier keys that are currently pressed.
 * @param {MouseEvent} e 
 */
export function getModifierKeys(e) {
  const keysDown = /** @type {( 'ctrl' | 'meta' | 'shift' )[]} */ ([]);
  if (e.ctrlKey === true) {
    keysDown.push('ctrl')
  }
  if (e.metaKey === true) {
    keysDown.push('meta')
  }
  if (e.shiftKey === true) {
    keysDown.push('shift')
  }
  return keysDown.length === 0 ? undefined : keysDown;
}


/**
 * Is Right Mouse Button (RMB) down?
 * @param {MouseEvent} e 
 */
export function isRMB(e) {
  // return (e.buttons & 2) !== 0;
  return e.button === 2;
}

/**
 * https://stackoverflow.com/a/4819886/2917822
 * ℹ️ If Chrome devtool initially open as mobile device,
 * `'ontouchstart' in window` continues to be true if switch to desktop.
 */
export function isTouchDevice() {
  return typeof window !== "undefined" && (
    "ontouchstart" in window || navigator.maxTouchPoints > 0 ||
    /** @type {*} */ (navigator).msMaxTouchPoints > 0
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

/**
 * @typedef {CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | import('canvas').CanvasRenderingContext2D} CanvasContext2DType
 */

export function isSmallViewport() {
  return typeof window !== "undefined" && window.matchMedia(`(max-width: ${'700px'})`).matches;
}

/**
 * https://stackoverflow.com/a/12300351/2917822
 * @param {string} dataUrl 
 */
export function dataUrlToBlobUrl(dataUrl) {
  const blob = dataUrlToBlob(dataUrl);
  return URL.createObjectURL(blob);
}

/**
 * https://stackoverflow.com/a/12300351/2917822
 * @param {string} dataUrl 
 */
function dataUrlToBlob(dataUrl) {
  // convert base64 to raw binary data held in a string
  // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
  const byteString = atob(dataUrl.split(',')[1]);

  // separate out the mime component
  const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0]

  // write the bytes of the string to an ArrayBuffer
  const ab = new ArrayBuffer(byteString.length);

  // create a view into the buffer
  const ia = new Uint8Array(ab);

  // set the bytes of the buffer to the correct values
  for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
  }

  // write the ArrayBuffer to a blob, and you're done
  const blob = new Blob([ab], {type: mimeString});
  return blob;

}