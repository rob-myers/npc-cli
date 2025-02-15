/**
 * @param {RunArg} ctxt
 */
export async function* awaitWorld({ api, home: { WORLD_KEY } }) {
  api.info(`awaiting ${api.ansi.White}${WORLD_KEY}`);

  while (api.getCached(WORLD_KEY)?.isReady(api.meta.sessionKey) !== true) {
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
  if (clickId !== undefined) {
    api.addCleanup(() => w.lib.removeFirst(w.view.clickIds, clickId));
  }

  /** @type {import('rxjs').Subscription} */
  let eventsSub;
  api.addCleanup(() => eventsSub?.unsubscribe());

  while (numClicks > 0) {
    clickId !== undefined && w.view.clickIds.push(clickId);
    
    const e = await /** @type {Promise<NPC.PointerUpEvent>} */ (new Promise((resolve, reject) => {
      eventsSub = w.events.subscribe({ next(e) {
        if (e.key !== "pointerup" || w.view.isPointerEventDrag(e) === true || api.isRunning() === false) {
          return;
        } else if (e.clickId !== undefined && clickId === undefined) {
          return; // `click {n}` overrides `click`
        } else if (e.clickId !== undefined && clickId !== e.clickId) {
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

    numClicks--;
    yield output;
  }
}

/**
 * Examples:
 * ```ts
 * events | filter 'e => e.npcKey'
 * events | filter /pointerup/
 * events /pointerup/
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
 * selectPolysDemo [{queryFilterType}=0]
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
 * 🔔 "export const" uses `call` rather than `map`
 * @param {RunArg} ctxt
 */
export const setupContextMenu = ({ w }) => {

  w.cm.match.door = ({ meta }) => {
    const showLinks = /** @type {NPC.ContextMenuLink[]} */ ([]);

    showLinks.push({ key: "look", label: "look" });

    if (typeof meta.switch === "number") {
      showLinks.push(
        { key: "open", label: "open" },
        { key: "close", label: "close" },
        { key: "lock", label: "lock" },
        { key: "unlock", label: "unlock" },
        // 🚧 ring bell
      );
    }

    if (meta.door === true) {
      showLinks.push(
        { key: "open", label: "open" },
        { key: "close", label: "close" },
        // GM only...
        { key: "lock", label: "lock" },
        { key: "unlock", label: "unlock" },
        // 🚧 knock
      );
    }

    if (typeof meta.npcKey === "string") {
      showLinks.push({ key: "follow", label: "follow" });
    }

    return { showLinks };
  };

  w.cm.toggleDocked(true);
}

/**
 * e.g. events | handleContextMenu
 * @param {RunArg<NPC.Event>} ctxt
 */
export async function* handleContextMenu({ api, w, datum: e }) {
  while ((e = await api.read()) !== api.eof) {
    if (e.key !== "contextmenu-link") {
      continue;
    }

    const { meta } = w.cm;
    const npcKey = w.cm.npcKey;

    switch (e.linkKey) {
      case "look":
        if (typeof meta.npcKey === "string") {
          w.view.lookAt(w.n[meta.npcKey].position).catch(() => {});
        } else {
          w.view.lookAt(w.cm.position).catch(() => {});
        }
        break;
      case "follow":
        if (typeof meta.npcKey === "string") {
          w.view.followPosition(w.n[meta.npcKey].position);
        }
        break;
      case "open":
      case "close":
        w.e.toggleDoor(meta.gdKey, {
          npcKey,
          [e.linkKey]: true,
          access: npcKey === undefined || (meta.inner === true && meta.secure !== true)
            ? true
            : w.e.npcCanAccess(npcKey, meta.gdKey),
        });
        break;
      case "lock":
      case "unlock":
        w.e.toggleLock(meta.gdKey, {
          npcKey: undefined,
          [e.linkKey]: true,
          access: npcKey === undefined
            ? true
            : w.e.npcCanAccess(npcKey, meta.gdKey),
          // point,
        });
        break;
    }
  }
}

/**
 * e.g. events | handleLoggerLinks
 * @param {RunArg<NPC.Event>} ctxt
 */
export async function* handleLoggerLinks({ api, datum: e, w }) {
  while ((e = await api.read()) !== api.eof) {
    if (e.key !== "logger-link") {
      continue;
    }
    
    // 🚧
    // if (e.viewportRange.start.x - 1 === 0 && e.viewportRange.start.y - 1 === e.startRow) {
    //   // clicked initial link
    // }
    if (e.linkText === e.npcKey) {
      w.view.lookAt(w.n[e.npcKey].position).catch(() => {});
    }

  }
}

/**
 * @param {RunArg} ctxt
 */
export const setupOnSlowNpc = ({ w, args }) => {

  w.npc.onStuckCustom = (npc, agent) => {
    // warn(`${npc.key}: going slow`);

    switch (args[0]) {
      case 'closest-nei': {
        const nei = agent.raw.get_neis(0); // 0th is closest
        const other = w.npc.byAgId[nei.idx];
        const target = /** @type {import('three').Vector3} */ (npc.s.target);
        if (target.distanceTo(other.lastTarget) < 3 * w.lib.defaults.radius) {
          npc.stopMoving();
        }
        break;
      }
      default:
        npc.stopMoving();
        break;
    }
  };

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

  // also support piped inputs via hyphen args -
  // e.g. `click 1 | map xz | w gmGraph.findRoomContaining -`
  // const { opts, operands } = api.getOpts(args);

  const stdinInputChar = "-";
  const stdin = args.slice(1).some(arg => arg === stdinInputChar);

  if (stdin !== true) {
    const func = api.generateSelector(
      api.parseFnOrStr(args[0]),
      args.slice(1).map(x => api.parseJsArg(x)),
    );
    const v = func(w, ctxt);
    yield v instanceof Promise ? Promise.race([v, getHandleProm()]) : v;
  } else {
    /** @type {*} */ let datum;
    while ((datum = await api.read()) !== api.eof) {
      const func = api.generateSelector(
        api.parseFnOrStr(args[0]),
        args.slice(1).map(x => x === stdinInputChar ? datum : api.parseJsArg(x)),
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
 * @template {any} [T=any]
 * @typedef RunArg
 * @property {import('../cmd.service').CmdService['processApi'] & {
*   getCached(key: '__WORLD_KEY_VALUE__'): import('../../world/World').State;
* }} api
* @property {string[]} args
* @property {{ [key: string]: any; WORLD_KEY: '__WORLD_KEY_VALUE__' }} home
* @property {import('../../world/World').State} w See `CACHE_SHORTCUTS`
* @property {T} datum A shortcut for declaring a variable
*/
