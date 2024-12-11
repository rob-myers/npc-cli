/**
 * @param {RunArg} ctxt
 */
export async function* awaitWorld({ api, home: { WORLD_KEY } }) {
  api.info(`awaiting ${api.ansi.White}${WORLD_KEY}`);
  
  while (api.getCached(WORLD_KEY)?.isReady() !== true) {
    await api.sleep(0.05);
  }
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
    api.addCleanup(() => w.lib.removeFirst(w.view.clickIds, clickId));
  }

  /** @type {import('rxjs').Subscription} */
  let eventsSub;
  api.addCleanup(() => eventsSub?.unsubscribe());

  while (numClicks-- > 0) {
    clickId && w.view.clickIds.push(clickId);
    
    const e = await /** @type {Promise<NPC.PointerUpEvent>} */ (new Promise((resolve, reject) => {
      eventsSub = w.events.subscribe({ next(e) {
        if (e.key !== "pointerup" || e.distancePx > 5 || !api.isRunning()) {
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

    /** @type {NPC.ClickOutput} */
    const output = {
      ...e.position,
      ...e.keys && { keys: e.keys },
      meta: {
        ...e.meta,
        nav: e.meta.floor === true ? w.npc.isPointInNavmesh(e.point) : false,
        // longClick: e.justLongDown,
      },
      xz: {...e.point},
    };

    yield output;
  }
}

/**
 * Examples:
 * ```ts
 * events | filter 'e => e.npcKey'
 * events | filter /show-context-menu/
 * events /show-context-menu/
 * ```
 * @param {RunArg} ctxt
 */
export async function* events({ api, args, w }) {
  const func = args[0] ? api.generateSelector(
    api.parseFnOrStr(args[0]),
    args.slice(1).map((x) => api.parseJsArg(x))
  ) : undefined;
  
  const asyncIterable = api.observableToAsyncIterable(w.events);
  // could not catch asyncIterable.throw?.(api.getKillError())
  api.addCleanup(() => asyncIterable.return?.());

  for await (const event of asyncIterable) {
    if (func === undefined || func?.(event)) {
      yield event;
    }
  }
  // get here via ctrl-c or `kill`
  throw api.getKillError();
}

/**
 * Make a single hard-coded polygon non-navigable,
 * and also indicate it via debug polygon.
 * ```sh
 * selectPolysDemo [queryFilterType=0]
 * ```
 * @param {RunArg} ctxt
 */
export async function* selectPolysDemo({ w, args }) {
    const queryFilterType = Number(args[0]) || 0;
    const { polyRefs } = w.crowd.navMeshQuery.queryPolygons(
      { x: 3.5 * 1.5, y: 0, z: 7 * 1.5 },
      { x: 0.01, y: 0.1, z: 0.01 },
      { maxPolys: 1 },
    );
    console.log({ polyRefs });

    const filter = w.crowd.getFilter(queryFilterType);
    const { navPolyFlag } = w.lib;
    // by default all polys should not match this bitmask:
    filter.excludeFlags = navPolyFlag.unWalkable;
    polyRefs.forEach(polyRef => w.nav.navMesh.setPolyFlags(polyRef, navPolyFlag.unWalkable));
    w.debug.selectNavPolys(...polyRefs); // display via debug
}

/**
 * Usage:
 * ```sh
 * w
 * w 'x => x.crowd'`
 * w crowd
 * w e.toggleDoor g0d0
 * w gmGraph.findRoomContaining $( click 1 | map xz )
 * click 1 | map xz | w --stdin gmGraph.findRoomContaining
 * echo image/webp | w --stdin view.openSnapshot _ 0
 * ```
 *
 * ℹ️ can always `ctrl-c`, even without cleaning up ongoing computations
 * ℹ️ --stdin option assumes stdin arg is represented via `_` (hyphen breaks getopts)
 * 
 * @param {RunArg} ctxt
 */
export async function* w(ctxt) {
  const { api, args, w } = ctxt;
  const getHandleProm = () => new Promise((resolve, reject) => api.addCleanup(
    () => reject("potential ongoing computation")
  ));

  // also support piped inputs via --stdin
  // e.g. `click 1 | w --stdin gmGraph.findRoomContaining`
  const { opts, operands } = api.getOpts(args, {
    boolean: ["stdin"],
  });

  if (opts.stdin !== true) {
    const func = api.generateSelector(
      api.parseFnOrStr(operands[0]),
      operands.slice(1).map(x => api.parseJsArg(x)),
    );
    const v = func(w, ctxt);
    yield v instanceof Promise ? Promise.race([v, getHandleProm()]) : v;
  } else {
    /** @type {*} */ let datum;
    const stdinInputChar = "_";
    if (!operands.includes(stdinInputChar)) operands.push(stdinInputChar);
    while ((datum = await api.read()) !== api.eof) {
      const func = api.generateSelector(
        api.parseFnOrStr(operands[0]),
        operands.slice(1).map(x => x === stdinInputChar ? datum : api.parseJsArg(x)),
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
