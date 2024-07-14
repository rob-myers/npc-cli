/**
 * @param {RunArg} ctxt
 */
export async function* awaitWorld({ api, home: { WORLD_KEY }, w }) {

  api.info(`polling ${api.ansi.White}${WORLD_KEY}`)
  while (!(w = api.getCached(WORLD_KEY))) {
    yield* api.sleep(0.5);
  }

  api.info(`awaiting ${api.ansi.White}${WORLD_KEY}`);
  await Promise.race([
    w.awaitReady(),
    new Promise((_, reject) => api.addCleanup(reject)),
  ]);
  // w.npc.connectSession(api.meta.sessionKey)
}

/**
 * ```sh
 * click
 * click 1
 * click --right
 * click --any
 * ```
 * @param {RunArg} ctxt
 */
export async function* click({ api, args, w }) {
  const { opts, operands } = api.getOpts(args, {
    boolean: ["left", "right", "any", "long"],
    // --left (left only) --right (right only) --any (either)
    // --long (long-press only)
  });
  if (!opts["left"] && !opts["right"] && !opts["any"]) {
    opts.left = true; // default to left clicks only
  }

  let numClicks = Number(operands[0] || Number.MAX_SAFE_INTEGER);
  if (!Number.isFinite(numClicks)) {
    throw new Error("format: \`click [{numberOfClicks}]\`");
  }

  const clickId = operands[0] ? api.getUid() : undefined;
  if (clickId) {
    api.addCleanup(() => w.lib.removeFirst(w.ui.clickIds, clickId));
  }

  /** @type {import('rxjs').Subscription} */
  let eventsSub;
  api.addCleanup(() => eventsSub?.unsubscribe());

  while (numClicks-- > 0) {
    clickId && w.ui.clickIds.push(clickId);
    
    const e = await /** @type {Promise<NPC.PointerUp3DEvent>} */ (new Promise((resolve, reject) => {
      eventsSub = w.events.subscribe({ next(e) {
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

    if (
      (opts.left === true && e.rmb === true)
      || (opts.right === true && e.rmb === false)
      || (opts.long !== e.justLongDown)
    ) {
      continue;
    }

    const v3 = {
      x: w.lib.precision(e.point.x),
      y: w.lib.precision(e.point.y),
      z: w.lib.precision(e.point.z),
    };

    /** @type {NPC.ClickMeta} */
    const output = {
      x: v3.x,
      y: v3.z, // project to XZ plane
      ...e.keys && { keys: e.keys },
      meta: { ...e.meta,
        navigable: w.npc.isPointInNavmesh(e.point),
        // 🚧 ...world.gmGraph.findRoomContaining(e.point) ?? { roomId: null },
      },
      v3,
    };

    yield output;
  }
}

/**
 * @param {RunArg} ctxt
 */
export async function* setupDemo1({ w }) {

    // create an obstacle (before query)
    const obstacle = w.npc.addBoxObstacle({ x: 1 * 1.5, y: 0.5 + 0.01, z: 5 * 1.5 }, { x: 0.5, y: 0.5, z: 0.5 }, 0);

    // find and exclude a poly
    const { polyRefs } =  w.crowd.navMeshQuery.queryPolygons(
      // { x: (1 + 0.5) * 1.5, y: 0, z: 4 * 1.5  },
      // { x: (2 + 0.5) * 1.5, y: 0, z: 4 * 1.5 },
      // { x: (1 + 0.5) * 1.5, y: 0, z: 6 * 1.5 },
      // { x: (1 + 0.5) * 1.5, y: 0, z: 7 * 1.5 },
      // { x: (3 + 0.5) * 1.5, y: 0, z: 6 * 1.5 },
      { x: (3 + 0.5) * 1.5, y: 0, z: 7 * 1.5 },
      { x: 0.2, y: 0.1, z: 0.01 },
    );
    console.log({ polyRefs });
    const filter = w.crowd.getFilter(0);
    filter.excludeFlags = 2 ** 0; // all polys should already be set differently
    polyRefs.forEach(polyRef => w.nav.navMesh.setPolyFlags(polyRef, 2 ** 0));
    w.debug.selectNavPolys(polyRefs); // display via debug
    
    w.update(); // Show obstacle
}

/**
 * 🔔 non-generators are interpreted as `map '{myFunction}'`
 * @param {NPC.ClickMeta} input
 * @param {RunArg} ctxt
 */
export async function walkTest(input, { w, home })  {
  const { selectedNpcKey } = home;
  const npc = w.npc.npc[selectedNpcKey];
  if (npc) {
    // npc.agent?.updateParameters({ maxSpeed: npc.getMaxSpeed() });
    npc.s.run = input.keys?.includes("shift") ?? false;
    npc.walkTo(input.v3);
  }
}

/**
 * Usage:
 * ```sh
 * w
 * w 'x => x.crowd'`
 * w crowd
 * w vert.toggleDoor 15
 * ```
 * - 🚧 `w "x => x.gmGraph.findRoomContaining($( click 1 ))"`
 * - 🚧 `w gmGraph.findRoomContaining $( click 1 )`
 * - 🚧 `click | w gmGraph.findRoomContaining`
 *
 * ℹ️ can always `ctrl-c`, even without cleaning up ongoing computations
 * @param {RunArg} ctxt
 */
export async function* w(ctxt) {
  const { api, args, w } = ctxt;
  const getHandleProm = () => new Promise((resolve, reject) => api.addCleanup(
    () => reject("potential ongoing computation")
  ));

  if (api.isTtyAt(0)) {
    const func = api.generateSelector(
      api.parseFnOrStr(args[0]),
      args.slice(1).map(x => api.parseJsArg(x)),
    );
    const v = func(w, ctxt);
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
        const v = func(w, ctxt);
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
* @property {import('../../world/World').State} w See `CACHE_SHORTCUTS`
* @property {*} [datum] A shortcut for declaring a variable
*/
