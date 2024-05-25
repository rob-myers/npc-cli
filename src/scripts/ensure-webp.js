/**
 * Ensure WEBP version of PNGs in static/assets/2d.
 * This should be run as part of pre-push hook.
 * 
 * - Generates WEBP in /static/assets/2d
 * - Commits changed WEBP files (assuming nothing staged)
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

import { runYarnScript } from "./service"
import { error, info } from '../npc-cli/service/generic';

const staticAssetsDir = path.resolve(__dirname, "../../static/assets");
const assets2dDir = path.resolve(staticAssetsDir, "2d");
const logPrefix = path.basename(__filename);

(async function main() {

  // 🚧 ignore files where webp exists and is older than png
  const assets2dPngPaths = fs.readdirSync(assets2dDir)
    .filter(x => x.endsWith('.png'))
    .map(x => path.resolve(assets2dDir, x))
  ;

  await runYarnScript(// png -> webp
    'cwebp-fast',
    JSON.stringify({ files: assets2dPngPaths }),
    '--quality=50',
  );

  const [modifiedPaths, untrackedPaths, stagedPaths] = [
    `git diff --name-only`,
    `git ls-files --others --exclude-standard`,
    `git diff --name-only --cached`,
  ].map(cmd =>
    `${childProcess.execSync(cmd)}`.trim().split(/\n/).filter(Boolean)
  );

  const [modifiedWebps, untrackedWebps, stagedWebps] = [
    modifiedPaths,
    untrackedPaths,
    stagedPaths,
  ].map(x => x.filter(y => y.match(/(^|\/)static\/assets\/2d\/.+\.webp$/)));

  if (modifiedWebps.length || untrackedWebps.length) {
    info(logPrefix, { modifiedWebps, untrackedWebps, stagedPaths });

    /**
     * We'd like to commit any `modifiedWebps` or `untrackedWebps`,
     * but only if there are no other staged files.
     */
    if (stagedWebps.length < stagedPaths.length) {
      error(logPrefix, 'cannot commit due to other staged files');
      process.exit(1);
    }

    childProcess.execSync(`git add ${
      modifiedWebps.concat(untrackedWebps).map(x => `'${x}'`).join(' ')
    }`);

    childProcess.execSync(`git commit -m 'update webp'`);

    /**
     * Must fail push because we cannot add an extra commit, nor
     * can we `git push --no-verify` without breaking subsequent.
     */
    info('generated missing *.webp, please push again...');
    process.exit(1);

  }

})();
