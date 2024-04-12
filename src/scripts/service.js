import fs from 'fs';
import stream from 'stream/promises';

/**
 * @param {import('canvas').Canvas} canvas 
 * @param {string} outputPath 
 */
export async function saveCanvasAsFile(canvas, outputPath) {
  return stream.pipeline(
    canvas.createPNGStream(), 
    fs.createWriteStream(outputPath),
  );
}
