/**
 * e.g. 
 * - `yarn cwebp '{ "files": ["/path/to/file.png"] }'`
 * - `yarn cwebp-fast '{ "files": ["/path/to/file.png"] }'`
 */
import path from "path";
import childProcess from "child_process";
import { error, safeJsonParse } from "../npc-cli/service/generic";

const repoRootDir = path.resolve(__dirname, "../..");
const [,, filesJsonStr] = process.argv;

const fileJson = /** @type {FilesJson} */ (safeJsonParse(filesJsonStr));
if (!(fileJson && fileJson.files?.every(item => typeof item === 'string') )) {
  error(`usage: yarn cwebp '{ files: ["path/to/file.png"] }'`);
  process.exit(1);
}

if (childProcess.execSync(`cwebp -version >/dev/null && echo $?`).toString().trim() !== '0') {
  error("error: please install cwebp e.g. `brew install webp`");
  process.exit(1);
}

(async function main() {

  // 🚧 clarify relative paths

  const nlFiles = fileJson.files.map(x => `${path.resolve(repoRootDir, x)}`).join('\n');
  // console.log(nlFiles);
  const quality = 75;

  childProcess.execSync(`
    time echo ${nlFiles} |
      xargs -I{} -n 1 -P 3 cwebp -q ${quality} -noasm "{}" -o "{}".webp
  `);

})();

/**
 * @typedef FilesJson
 * @property {string[]} files
 * @property {any} [opts] // 🚧
 */
