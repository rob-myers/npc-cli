/**
 * @param {RunArg} ctxt
 */
export async function* awaitWorld({ api, home: { WORLD_KEY } }) {
  while (!api.getCached(WORLD_KEY)?.isReady()) {
    api.info(`polling for ${api.ansi.White}${WORLD_KEY}`);
    yield* api.sleep(0.5);
  }
  // api.getCached(WORLD_KEY).npc.connectSession(api.meta.sessionKey)
  api.info(`found ${api.ansi.White}${WORLD_KEY}`);
}

/**
 * @param {RunArg} ctxt
 */
export async function* click({ api, args, world }) {
  let numClicks = Number(args[0] || Number.MAX_SAFE_INTEGER);
  if (!Number.isFinite(numClicks)) {
    throw new Error("format: \`click [{numberOfClicks}]\`");
  }

  const clickId = args[0] ? api.getUid() : undefined;
  if (clickId) {
    api.addCleanup(() => world.lib.removeFirst(world.ui.clickIds, clickId));
  }

  /** @type {import('rxjs').Subscription} */
  let eventsSub;
  api.addCleanup(() => eventsSub?.unsubscribe());

  while (numClicks-- > 0) {
    clickId && world.ui.clickIds.push(clickId);
    
    const e = await /** @type {Promise<NPC.PointerUp3DEvent>} */ (new Promise((resolve, reject) => {
      eventsSub = world.events.subscribe({ next(e) {
        if (e.key !== "pointerup" || e.is3d === false || e.distancePx > 5 || !api.isRunning()) {
          return;
        } else if (e.clickId && !clickId) {
          return; // `click {n}` overrides `click`
        } else if (e.clickId && clickId !== e.clickId) {
          return; // later `click {n}` overrides earlier `click {n}`
        }
        resolve(e); // Must resolve before tear-down induced by unsubscribe 
        eventsSub.unsubscribe();
      }});
      eventsSub.add(() => reject(api.getKillError()));
    }));

    yield {
      x: world.lib.precision(e.point.x),
      y: world.lib.precision(e.point.y),
      z: world.lib.precision(e.point.z),
      meta: { ...e.meta,
        // ...world.gmGraph.findRoomContaining(e.point) ?? { roomId: null }, // 🚧
        navigable: world.npc.isPointInNavmesh(e.point),
      },
    };
  }
}

/**
 * @param {RunArg} ctxt
 */
export async function* setupDemo1({ world }) {

    // create an obstacle (before query)
    const obstacle = world.npc.addBoxObstacle({ x: 1 * 1.5, y: 0.5 + 0.01, z: 5 * 1.5 }, { x: 0.5, y: 0.5, z: 0.5 }, 0);

    // find and exclude a poly
    const { polyRefs } =  world.crowd.navMeshQuery.queryPolygons(
      // { x: (1 + 0.5) * 1.5, y: 0, z: 4 * 1.5  },
      // { x: (2 + 0.5) * 1.5, y: 0, z: 4 * 1.5 },
      // { x: (1 + 0.5) * 1.5, y: 0, z: 6 * 1.5 },
      // { x: (1 + 0.5) * 1.5, y: 0, z: 7 * 1.5 },
      // { x: (3 + 0.5) * 1.5, y: 0, z: 6 * 1.5 },
      { x: (3 + 0.5) * 1.5, y: 0, z: 7 * 1.5 },
      { x: 0.2, y: 0.1, z: 0.01 },
    );
    console.log({ polyRefs });
    const filter = world.crowd.getFilter(0);
    filter.excludeFlags = 2 ** 0; // all polys should already be set differently
    polyRefs.forEach(polyRef => world.nav.navMesh.setPolyFlags(polyRef, 2 ** 0));
    world.debug.selectNavPolys(polyRefs); // display via debug
    
    world.update(); // Show obstacle
}

/**
 * Usage:
 * ```sh
 * world
 * world 'x => x.crowd'`
 * world crowd
 * world vert.toggleDoor 15
 * ```
 * - 🚧 `world "x => x.gmGraph.findRoomContaining($( click 1 ))"`
 * - 🚧 `world gmGraph.findRoomContaining $( click 1 )`
 * - 🚧 `click | world gmGraph.findRoomContaining`
 *
 * ℹ️ can always `ctrl-c`, even without cleaning up ongoing computations
 * @param {RunArg} ctxt
 */
export async function* world(ctxt) {
  const { api, args, world } = ctxt;
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
 * @typedef RunArg
 * @property {import('../cmd.service').CmdService['processApi'] & {
*   getCached(key: '__WORLD_KEY_VALUE__'): import('../../world/World').State;
* }} api
* @property {string[]} args
* @property {{ [key: string]: any; WORLD_KEY: '__WORLD_KEY_VALUE__' }} home
* @property {import('../../world/World').State} world See `CACHE_SHORTCUTS`
* @property {*} [datum] A shortcut for declaring a variable
*/
