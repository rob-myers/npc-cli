import nodemon from 'nodemon';
import { labelledSpawn } from './service';
import { info } from '../npc-cli/service/generic';

/** Is the script currently running? */
let running = false;
/** We pause to allow multiple changes to aggregate */
const delayMs = 300;
/** Absolute path to `Date.now()` */
const changed = /** @type {Map<string, number>} */ (new Map());

nodemon({
  // delay: 300, // 🔔 doesn't track files within interval
  ext: 'svg',
  runOnChangeOnly: true,
  script: 'src/scripts/noop.js', // 🔔 must override default behaviour 
  watch: [
    'src/scripts/assets.js',
    'src/npc-cli/service/geomorph.js',
    'media/symbol/',
    'media/map/',
  ],
}).on('restart', onRestart).on('quit', onQuit);

info('watching assets...');

/**
 * @param {string[]} [nodemonFiles] 
 */
async function onRestart(nodemonFiles = []) {
  nodemonFiles.forEach(file => changed.set(file, Date.now()));
  
  if (!running) {
    running = true;
  } else {
    return;
  }

  await new Promise(resolve => setTimeout(resolve, delayMs));
  
  const startEpochMs = Date.now();
  const changedFiles = Array.from(changed.keys());
  await labelledSpawn('assets',
    'sucrase-node', 'src/scripts/assets', `--changedFiles=${JSON.stringify(changedFiles)}`,
  );
  const seconds = ((Date.now() - startEpochMs) / 1000).toFixed(1);
  info(`took ${seconds}s`);
  changed.forEach((epochMs, file) =>
    epochMs <= startEpochMs && changed.delete(file)
  );

  running = false;

  if (changed.size > 0) {
    await onRestart();
  }
}

/**
 * @param {number} code 
 */
function onQuit(code) {
  // console.log('quit', code);
  process.exit();
}
