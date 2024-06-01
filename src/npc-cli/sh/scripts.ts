/**
 * - Index in array denotes version
 * - We further populate using raw-loader.js below.
 */
export const utilFunctions = [
  {
    range: `{
  call '({args}) =>
    [...Array(Number(args[0]))].map((_, i) => i)
  ' "$1"
}`,

    seq: `{
  range "$1" | split
}`,

    pretty: `{
  map '(x, { api }) => api.pretty(x)'
}`,

    keys: `{
  map Object.keys
}`,

    // cat: `get "$@" | split`,
    cat: `get "$@"`,

    /**
     * - initially logs args, afterwards logs stdin
     * - `map console.log` would log 2nd arg too
     * - logs chunks larger than 1000, so e.g. `seq 1000000 | log` works
     */
    log: `{
  run '({ api, args, datum }) {
    args.forEach(arg => console.log(arg))
    if (api.isTtyAt(0)) return
    while ((datum = await api.read(true)) !== api.eof) {
      if (api.isDataChunk(datum) && datum.items.length <= 1000) {
        datum.items.forEach(x => console.log(x));
      } else {
        console.log(datum);
      }
    }
  }' $@
}`,

    //   empty: `{
    //     return $(
    //       call '({ args }) => args.some(Boolean) ? 1 : 0' "$@"
    //     )
    // }`,

    clone: `{
  map 'x => JSON.parse(JSON.stringify(x))'
}`,

    readtty: `{
  call '({ api, args }) => api.isTtyAt(...args.map(Number))' $1
}`,
  },
];

/**
 * - Index in array denotes version
 * - We further populate using raw-loader.js below.
 */
export const gameFunctions = [
  {
    look: `{
  npc $1 lookAt
}`,

    /** Usage: doLoop {npcKey} */
    doLoop: `{
  click |
    filter 'p => p.meta.do || p.meta.nav || p.meta.door' |
    npc $1 do
}`,

    /**
     * Usage: goLoop {npcKey}
     * - ℹ️ when off-mesh, starts from closest navigable
     */
    goLoop: `{
  click |
    filter '({ meta }) => meta.nav && !meta.ui && !meta.do && !meta.longClick' |
    nav $1 |
    walk $1
}`,

    // /** Usage: goOnce {npcKey} */
    // goOnce: `{
    //   nav $1 $(click 1) | walk $1
    // }`,

    /** Usage: lookLoop {npcKey} */
    lookLoop: `{
  click |
    # do not look towards navigable or doable points
    filter 'x => !x.meta.nav && !x.meta.do' |
    look $1
}`,

    /** Usage: thinkLoop {npcKey} */
    thinkLoop: `{
  click |
    filter 'x => x.meta.npc && x.meta.npcKey === "'$1'"' |
    run '({ api, home }) {
      const { fov } = api.getCached(home.WORLD_KEY)
      while (await api.read(true) !== api.eof)
        fov.mapAct("show-for", 3000)
    }'
}`,

    /**
     * Usage:
     * - `world`
     * - `world 'x => x.fov'`
     * - `world fov`
     * - `world doors.toggleLock 0 8`
     * - `world "x => x.gmGraph.findRoomContaining($( click 1 ))"`
     * - `world gmGraph.findRoomContaining $( click 1 )`
     * - `click | world gmGraph.findRoomContaining`
     *
     * Supports `Ctrl-C` without cleaning ongoing computations.
     */
    // world: `{
    //   local selector
    //   selector="$\{1:-x=>x}"
    //   shift
    //   call '({ api, home }) => api.getCached(home.WORLD_KEY)' |
    //     map "$selector" "$@"
    // }`,
    world: `{
  run '(ctxt) {
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
      let datum;
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
          api.info(\`\${e}\`);
        }
      }
    }
  }' "$@"
}`,

    api: `world "$@"`,

    /**
     * Usage: gm {gmId} [selector]
     */
    gm: `{
  local gmId selector
  gmId="$\{1:-0}"
  selector="$\{2:-x=>x}"
  shift 2
  call '({ api, home }) => api.getCached(home.WORLD_KEY).gmGraph.gms['$gmId']' |
    map "$selector" "$@"
}`,

    /**
     * Usage:
     * - longClick 1
     * - longClick
     */
    longClick: `{
  click | filter meta.longClick | take $1
}`,

    pausableNpcs: `click |
  filter '({ meta }) => meta.npc && !meta.longClick' |
  map '(p, { w }) => {
    const npc = w.npcs.getNpc(p.meta.npcKey)
    npc.forcePaused ? npc.resume() : npc.pause()
}'`,
  },
];

/**
 * Possible values for env.PROFILE.
 * Use functions so can reference other profiles.
 * Remember to invoke function (MDX lacks intellisense).
 */
export const profileLookup = {
  util_0: () =>
    `

source /etc/util-1

`.trim(),

  game_0: () =>
    `

source /etc/util-1
source /etc/game-1

`.trim(),

  game_1: (npcKey = "rob") =>
    `

source /etc/util-1
source /etc/game-1

awaitWorld
spawn ${npcKey} '{"x":210,"y":390}'
npc set-player ${npcKey}
# npc map show-for 2
npc map hide-labels

pausableNpcs &
track ${npcKey} &
click | controlNpc ${npcKey} &

`.trim(),
  // # goLoop ${npcKey} &
  // # lookLoop ${npcKey} &
  // # doLoop ${npcKey} &
  // # thinkLoop ${npcKey} &

  game_2: () => `
${profileLookup.game_1()}

npc config '{
  debugPlayer: true,
  hideGms: false,
  colliders: false,
  logTags: false,
}'
`,

  // 🚧 pixi profile
  game_3: (npcKey = "rob") => `
source /etc/util-1
source /etc/game-1

awaitWorld
spawn ${npcKey} '{"x":210,"y":390}' --zhodani
npc set-player ${npcKey}
npc config '{verbose:true}'

click | controlNpc ${npcKey} &
pausableNpcs &
# track2 ${npcKey} &
`,
};

import rawLoaderJs from "!!raw-loader!./raw-loader";
Function("utilFunctions", "gameFunctions", rawLoaderJs)(utilFunctions, gameFunctions);

/**
 * This is `/etc`.
 * It must be computed after we've extended {util,game}Functions via raw-loader.
 */
export const scriptLookup = {
  "util-1": Object.entries(utilFunctions[0])
    .map(([funcName, funcBody]) => `${funcName} () ${funcBody.trim()}`)
    .join("\n\n"),

  "game-1": Object.entries(gameFunctions[0])
    .map(([funcName, funcBody]) => `${funcName} () ${funcBody.trim()}`)
    .join("\n\n"),
};
