/**
 * - Ensure WEBP version of PNGs in static/assets/2d.
 * - Fail if changes need to be committed.
 * 
 * Usage:
 * ```sh
 * npm run ensure-webp
 * yarn ensure-webp
 * ```
 */

import childProcess from 'child_process';
import fs from "fs";
import path from "path";
import { error, info } from '../npc-cli/service/generic';

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const assets2dDir = path.resolve(staticAssetsDir, "2d");
const logPrefix = path.basename(__filename);

(async function main() {

  const assets2dPngPaths = fs.readdirSync(assets2dDir)
    .filter(x => x.endsWith('.png'))
    .map(x => path.resolve(assets2dDir, x))
  ;
  const pngToWebpCommand = `yarn cwebp-fast --quality=50 '${
    JSON.stringify({ files: assets2dPngPaths })
  }'`;

  info(logPrefix, `running:\n\n${pngToWebpCommand}\n`);
  childProcess.execSync(pngToWebpCommand);

  const [modifiedWebps, untrackedWebps, stagedWebps] = [
    `git diff --name-only`,
    `git ls-files --others --exclude-standard`,
    `git diff --name-only --cached`,
  ].map(cmd =>
    `${childProcess.execSync(cmd)}`.trim().split(/\n/)
    .filter(x => x.match(/^static\/assets\/2d\/.+\.webp$/))
  );

  if (modifiedWebps.concat(untrackedWebps, stagedWebps).length) {
    error(logPrefix, 'please commit WEBPs', { modifiedWebps, untrackedWebps, stagedWebps });
    process.exit(1);
  }

})();
