import { MaxRectsPacker, Rectangle } from "maxrects-packer";
import { warn } from "./generic";

/**
 * @template T
 * @param {PrePackedRect<T>[]} rectsToPack
 * @param {object} opts
 * @param {string} opts.logPrefix
 * @param {number} opts.packedPadding
 * @returns {Pick<import("maxrects-packer").Bin<Rectangle>, 'width' | 'height' | 'rects'>}
 */
export default function packRectangles(rectsToPack, opts) {
  const packer = new MaxRectsPacker(4096, 4096, opts.packedPadding, {
    pot: false,
    border: opts.packedPadding,
    // smart: false,
  });
  packer.addArray(rectsToPack.map(x => {
    const rect = new Rectangle(x.width, x.height);
    rect.data = x.data;
    return rect;
  }));
  const { bins } = packer;

  if (bins.length === 0) {
    warn(`${opts.logPrefix}: no rectangles to pack`);
    return { width: 0, height: 0, rects: [] };
  } else if (bins.length > 1) {// 🔔 support more than one sprite-sheet
    // warn(`images: expected exactly one bin (${bins.length})`);
    throw Error(`${opts.logPrefix}: expected exactly one bin (${bins.length})`);
  } else if (bins[0].rects.length !== rectsToPack.length) {
    throw Error(`${opts.logPrefix}: expected every image to be packed (${bins.length} of ${rectsToPack.length})`);
  }

  return bins[0];
}

/**
 * @template T
 * @typedef {{ width: number; height: number; data: T }} PrePackedRect
 */
