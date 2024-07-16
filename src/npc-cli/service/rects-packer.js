import { MaxRectsPacker, Rectangle } from "maxrects-packer";

/**
 * @template T
 * @param {PrePackedRect<T>[]} rectsToPack
 * @param {object} opts
 * @param {string} opts.errorPrefix
 * @param {number} opts.packedPadding
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

  if (bins.length !== 1) {// 🔔 support more than one sprite-sheet
    // warn(`images: expected exactly one bin (${bins.length})`);
    throw Error(`${opts.errorPrefix}: expected exactly one bin (${bins.length})`);
  } else if (bins[0].rects.length !== rectsToPack.length) {
    throw Error(`${opts.errorPrefix}: expected every image to be packed (${bins.length} of ${rectsToPack.length})`);
  }

  return bins[0];
}

/**
 * @template T
 * @typedef {{ width: number; height: number; data: T }} PrePackedRect
 */
