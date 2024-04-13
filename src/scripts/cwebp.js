/**
 * Usage
 * - yarn cwebp '{ "files": ["static/assets/2d/g-101--multipurpose.floor.png", "static/assets/2d/g-301--bridge.floor.png"] }'
 * - yarn cwebp-fast '{ "files": ["static/assets/2d/g-101--multipurpose.floor.png", "static/assets/2d/g-301--bridge.floor.png"] }'
 * 
 * Paths are relative to repo root.
 * 
 * Depends on `cwebp` e.g. `brew install cwebp`.
 */
import path from "path";
import childProcess from "child_process";
import { error, safeJsonParse } from "../npc-cli/service/generic";

const [,, filesJsonStr] = process.argv;
const repoRootDir = path.resolve(__dirname, "../..");
const fileJson = /** @type {FilesJson} */ (safeJsonParse(filesJsonStr));
if (!(fileJson && fileJson.files?.every(item => typeof item === 'string') )) {
  error(`usage: yarn cwebp '{ files: ["path/to/file1.png"] }'`);
  process.exit(1);
}

const quality = 75;

(async function main() {
  const delimFiles = fileJson.files.map(x => `${path.resolve(repoRootDir, x)}`).join('\n');

  childProcess.execSync(`
    time echo "${delimFiles}" |
      xargs -L 1 -I {} -n 1 -P 3 cwebp -q ${quality} -noasm "{}" -o "{}".webp
  `);
})();

/**
 * @typedef FilesJson
 * @property {string[]} files
 * @property {any} [opts] // 🚧
 */
