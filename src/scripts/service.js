import fs from 'fs';
import childProcess from 'child_process';
import stream from 'stream/promises';
import { info } from '../npc-cli/service/generic';

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

/**
 * Options can be provided as single args like `--quality=75`.
 * @param {string} scriptName
 * @param {string[]} args
 */
export async function runYarnScript(scriptName, ...args) {
  await /** @type {Promise<void>} */ (new Promise((resolve, reject) => {
      const proc = childProcess.spawn('yarn', [scriptName, ...args]);
      proc.stdout.on('data', (data) => info(scriptName, data.toString()));
      // stderr needn't contain error messages
      proc.stderr.on('data', (data) => info(scriptName, data.toString()));
      // proc.stdout.on('close', () => resolve());
      proc.on('error', (e) => reject(e));
      proc.on('exit', (errorCode) => {
        if (typeof errorCode === 'number' && errorCode !== 0) {
          reject({ errorCode });
        } else {
          resolve();
        }
      });
  }));
}
