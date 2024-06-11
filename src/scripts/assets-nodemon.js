import nodemon from 'nodemon';
import { runYarnScript } from './service';

let running = false;
/** We pause to allow multiple changes to aggregate */
const delayMs = 300;
/** Absolute path to `Date.now()` */
const changed = /** @type {{ [filename: string]: number }} */ ({});

nodemon({
  // delay: 300, // 🔔 cannot use: `files` is missing changed files
  ext: 'svg',
  runOnChangeOnly: true,
  script: 'src/scripts/noop.js', // 🔔 need to override behaviour 
  watch: [
    'src/scripts/assets.js',
    'src/npc-cli/service/geomorph.js',
    'media/symbol/',
    'media/map/',
  ],
}).on('restart', onRestart).on('quit', onQuit);

/**
 * @param {string[] | undefined} nodemonFiles 
 */
async function onRestart(nodemonFiles) {
  // console.log({ nodemonFiles });
  const startEpochMs = Date.now();
  nodemonFiles?.forEach(file => changed[file] = startEpochMs);
  
  if (!running) {
    running = true;
  } else {
    return;
  }

  await new Promise(resolve => setTimeout(resolve, delayMs));
  
  await runYarnScript(
    'assets-fast',
    JSON.stringify({ changedFiles: Object.keys(changed) }),
    '--staleMs=2000', // 🚧 remove? `changedFiles` should replace it
  );

  Object.keys(changed).forEach(file =>
    changed[file] <= startEpochMs && delete changed[file]
  );

  running = false;

  if (changed.size > 0) {
    await onRestart([]);
  }
}

/**
 * @param {number} code 
 */
function onQuit(code) {
  // console.log('quit', code);
  process.exit();
}
