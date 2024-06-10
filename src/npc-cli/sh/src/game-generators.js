/**
 * @param {RunArg} ctxt
 */
export async function* awaitWorld({ api, home: { WORLD_KEY } }) {
  while (!api.getCached(WORLD_KEY)?.isReady()) {
    api.info(`polling for ${api.ansi.White}${WORLD_KEY}`)
    yield* api.sleep(1)
  }
  // api.getCached(WORLD_KEY).npc.connectSession(api.meta.sessionKey)
  api.info(`found ${api.ansi.White}${WORLD_KEY}`)
}

/**
 * @typedef RunArg
 * @property {import('../cmd.service').CmdService['processApi'] & {
*   getCached(key: '__WORLD_KEY_VALUE__'): import('../../aux/TestWorld').State;
* }} api
* @property {string[]} args
* @property {{ [key: string]: any; WORLD_KEY: '__WORLD_KEY_VALUE__' }} home
* @property {*} [datum] A shortcut for declaring a variable
*/
