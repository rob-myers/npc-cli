import nodemon from 'nodemon';
import { runYarnScript } from './service';

/** Is the script currently running? */
let running = false;
/** We pause to allow multiple changes to aggregate */
const delayMs = 300;
/** Absolute path to `Date.now()` */
const changed = /** @type {Map<string, number>} */ (new Map());

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
  nodemonFiles?.forEach(file => changed.set(file, startEpochMs));
  
  if (!running) {
    running = true;
  } else {
    return;
  }

  await new Promise(resolve => setTimeout(resolve, delayMs));
  
  const changedFiles = Array.from(changed.keys());
  await runYarnScript(
    'assets-fast',
    JSON.stringify(changedFiles),
    '--staleMs=2000', // 🚧 remove? `changedFiles` should replace it
  );

  changed.forEach((epochMs, file) =>
    epochMs <= startEpochMs && changed.delete(file)
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
