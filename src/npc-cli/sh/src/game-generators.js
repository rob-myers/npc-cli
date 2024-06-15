/**
 * Usage:
 * - `api`
 * - `api 'x => x.crowd'` 
 * - `api crowd`
 * - `api vert.toggleDoor 15`
 * - 🚧 `api "x => x.gmGraph.findRoomContaining($( click 1 ))"`
 * - 🚧 `api gmGraph.findRoomContaining $( click 1 )`
 * - 🚧 `click | api gmGraph.findRoomContaining`
 *
 * ℹ️ supports `ctrl-c` without cleaning ongoing computations
 * @param {RunArg} ctxt
 */
export async function* api(ctxt) {
  const { api, args, home } = ctxt;
  const world = api.getCached(home.WORLD_KEY);
  const getHandleProm = () => new Promise((resolve, reject) => api.addCleanup(
    () => reject("potential ongoing computation")
  ));

  if (api.isTtyAt(0)) {
    const func = api.generateSelector(
      api.parseFnOrStr(args[0]),
      args.slice(1).map(x => api.parseJsArg(x)),
    );
    const v = func(world, ctxt);
    yield v instanceof Promise ? Promise.race([v, getHandleProm()]) : v;
  } else {
    /** @type {*} */ let datum;
    !args.includes("-") && args.push("-");
    while ((datum = await api.read()) !== api.eof) {
      const func = api.generateSelector(
        api.parseFnOrStr(args[0]),
        args.slice(1).map(x => x === "-" ? datum : api.parseJsArg(x)),
      );
      try {
        const v = func(world, ctxt);
        yield v instanceof Promise ? Promise.race([v, getHandleProm()]) : v;
      } catch (e) {
        api.info(`${e}`);
      }
    }
  }
}

/**
 * @param {RunArg} ctxt
 */
export async function* awaitWorld({ api, home: { WORLD_KEY } }) {
  while (!api.getCached(WORLD_KEY)?.isReady()) {
    api.info(`polling for ${api.ansi.White}${WORLD_KEY}`)
    yield* api.sleep(0.5)
  }
  // api.getCached(WORLD_KEY).npc.connectSession(api.meta.sessionKey)
  api.info(`found ${api.ansi.White}${WORLD_KEY}`)
}

/**
 * @param {RunArg} ctxt
 */
export async function* setupDemo1({ w: api }) {

    // create an obstacle (before query)
    const obstacle = api.npc.addBoxObstacle({ x: 1 * 1.5, y: 0.5 + 0.01, z: 5 * 1.5 }, { x: 0.5, y: 0.5, z: 0.5 }, 0);

    // find and exclude a poly
    const { polyRefs } =  api.crowd.navMeshQuery.queryPolygons(
      // { x: (1 + 0.5) * 1.5, y: 0, z: 4 * 1.5  },
      // { x: (2 + 0.5) * 1.5, y: 0, z: 4 * 1.5 },
      // { x: (1 + 0.5) * 1.5, y: 0, z: 6 * 1.5 },
      // { x: (1 + 0.5) * 1.5, y: 0, z: 7 * 1.5 },
      // { x: (3 + 0.5) * 1.5, y: 0, z: 6 * 1.5 },
      { x: (3 + 0.5) * 1.5, y: 0, z: 7 * 1.5 },
      { x: 0.2, y: 0.1, z: 0.01 },
    );
    console.log({ polyRefs });
    const filter = api.crowd.getFilter(0);
    filter.excludeFlags = 2 ** 0; // all polys should already be set differently
    polyRefs.forEach(polyRef => api.nav.navMesh.setPolyFlags(polyRef, 2 ** 0));
    api.debug.selectNavPolys(polyRefs); // display via debug
    
    api.update(); // Show obstacle
}



/**
 * @typedef RunArg
 * @property {import('../cmd.service').CmdService['processApi'] & {
*   getCached(key: '__WORLD_KEY_VALUE__'): import('../../world/World').State;
* }} api
* @property {string[]} args
* @property {{ [key: string]: any; WORLD_KEY: '__WORLD_KEY_VALUE__' }} home
* @property {import('../../world/World').State} w See CACHE_SHORTCUTS
* @property {*} [datum] A shortcut for declaring a variable
*/
