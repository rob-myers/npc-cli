# TODO

## Migration to Next.js (npc-cli-next)

- keep in sync e.g. glsl.js, Logger
  - `git diff --name-only "@{Sat 18 Sep}"`
- get Decor working

## WIP

- 🚧 Logger also records speech and provides link options
  - ✅ Logger is always pinned
  - ✅ Implement demo link
    - ℹ️ https://github.com/xtermjs/xterm.js/issues/5222
    - ℹ️ https://github.com/xtermjs/xterm.js/tree/master/addons/addon-web-links
    - ℹ️ https://github.com/xtermjs/xterm.js/discussions/5223#discussioncomment-11762329
  - ✅ infer link meta on click link
    - ✅ linkText is "uri" e.g. `[ test link ]` (with brackets, sans escape-codes)
    - ✅ lineText follows from "hover location"
    - ✅ linkStartIndex follows from "hover location"
    - ✅ lineNumber follows from "hover location"
    - ✅ construct lineText, startRow, endRow from IViewportRange
      - ℹ️ this means finding the whole "wrapped line" that the link is part of
  - ✅ setup matching system (lineText, linkText)
    - ✅ can `w.menu.say(npcKey, line)`
      - `w menu.say rob foo bar baz`
    - ✅ speech always has initial link `[ {npcKey} ]`
    - ✅ send event `click-npc-link` with `{ npcKey, line, link }`
  - ✅ can clear Logger
  - ✅ link NpcSpeechBubble "say" to Logger
  - ✅ Draggable component
  - ✅ Split ContextMenus into DefaultContextMenu, NpcSpeechBubbles
    - ✅ DefaultContextMenu.jsx
    - ✅ NpcSpeechBubbles.jsx
    - ℹ️ `w bubble.say rob Hello everyone!{1..5}`
    - ❌ Only send DefaultContextMenu thru portal
      - we are sending Logger thru portal
  - ✅ Logger fixed at bottom
  - ✅ DefaultContextMenu bottom right
  - ℹ️ https://stackoverflow.com/questions/20926551/recommended-way-of-making-react-component-div-draggable
  - 🚧 can move DefaultContextMenu whilst docked via Draggable
    - ✅ can drag around while docked
    - 🚧 remember position
    - 🚧 responsive i.e. keeps in view
    - 🚧 test Draggable on mobile
  - can move Logger
  - can resize Logger
  - Logger logs disconnected/connected message
  - Paused "Opts" with PopUp and Logger measure option
  - X-ray slider always visible
  - move `w.c.say` -> `w.e.say`
  - profile-1 has link listener

- x-ray should be default view (?)
  - could have manual slider

- ✅ pre next.js migration
  - ✅ finish/close wip todos
  - ✅ avoid stationary npc push through door
    - ✅ create a queryFilter with a doorway excluded and prevent a single agent from moving through it
    - ℹ️ `ch: 0.05` broke "door triangles"
    - ℹ️ `cs: 0.9` fixed bridge symbol disconnected component
    - ✅ npc.s.moving -> npc.s.target !== null
    - ✅ moved "stationary agents" should trigger sensor
    - ✅ on trigger nearby door, ensure excludeDoor queryFilter includes doors
    - ✅ maintain excludeDoors query filter where seen doorways are excluded
    - ✅ in case agent stops inside a door, prevent them from "moving aside" instead
  - ✅ avoid spinning targetless NPCs
    - collision could cause other to look but only at a "higher level of behaviour"
  - ✅ support windows
    - ✅ still need wall, implicit via window
    - ✅ exclude complex outer window: `window` -> `external-window`
    - ✅ fix object-pick
    - ✅ can specify window structure via `y` and `h`
    - ✅ Obstacles hmr not working i.e. onchange obstacle y=0 or y=0.5
    - ✅ need top of low wall e.g. via obstacle in symbol `window--007--0x2.4`
    - ✅ finish lab windows
    - finish other windows
  - ✅ touch indicator for mobile
    - ℹ️ https://codepen.io/mike_hendriks/pen/JjoxrON
    - ✅ cancel on move a bit
    - ✅ clean into own component
    - ✅ test on phone
  - ✅ refactor ContextMenu as own component
  - ✅ restyle ContextMenu
  - ✅ ContextMenu has "select" with nearby npc keys
  - ✅ ContextMenu moves in 3D
    - fix click on ContextMenu
    - fix right click on ContextMenu
    - fix unfocus tab then click
  - ✅ ContextMenu
    - ✅ has close button
    - ✅ has options panel
    - ✅ start options panel
      - ✅ has persist checkbox
      - ✅ auto-close if persist checkbox not ticked
        - ℹ️ see old `state.hide()`
      - ✅ can toggle mini view
      - ✅ SideNote "data root" should be World
      - ❌ can choose left/right/top/bottom to not block door?
        - ℹ️ too complex? e.g. doesn't
    - ✅ has small sphere indicating contact point
    - ✅ can track moving NPC?
      - ✅ `w n.rob.m.group | w --stdin cm.track`
      - ✅ `w cm.track`
      - auto track npcs
    - ❌ transparent for doors/walls when "behind contact normal"
  - ✅ ContextMenu: resize -> lock
  - ✅ ContextMenu: customize @react-three/drei Html
    - ✅ create JavaScript projection
    - ✅ expose object3d
    - ✅ can force update
    - ✅ can CSS animate scale
  - ❌ ContextMenu: preserve open SideNote during HMR of Html3d
    - ℹ️ happens because we root.unmount() in useLayoutEffect
    - ℹ️ don't want to start caching roots per instance
  - ❌ ContextMenu simplify "key values"
    - ✅ switch decor have gdKey
    - ❌ picked value, grKey, gdKey, symbolKey
    - ❌ complex values optionally showable
  - ✅ object-pick provides normal
    - ✅ Walls material should be one-sided i.e. walls + lintels + windows
    - ✅ compute lastDown.normal
    - ✅ Decor quads
      - ❌ material should be one-sided (subtle e.g. need to flip document icons)
      - ✅ fix normal direction (flip) using camera direction
    - ✅ Decor cuboids
    - ✅ Doors should be two quads so get correct normal
  - ✅ ContextMenu use circle instead of sphere
  - ✅ fix 301 room 11 i.e. bridge room should be split in two
  - ✅ ContextMenu has select with possible actions
    - ✅ switches: can open doors
    - ✅ switches: can close doors
    - ✅ switches: can lock/unlock doors
    - ✅ switch `inner` but not `secure` can be opened by anyone
      - on leave room refresh ContextMenu
    - ✅ npc in room with locked door can still leave
    - ✅ BUG unlocked auto door
      - ℹ️ trigger auto doors in case they've been manually closed
    - ✅ BUG closed auto door
      - ℹ️ trigger auto doors in case they've been manually closed
    - ✅ ContextMenu strategy
      - ✅ hide when camera normal has +ve dot product with normal
      - ✅ list all npcs ever seen i.e. keep adding
      - ✅ show actions independently of npc distance
      - ✅ acts fail if npc too far
      - ✅ acts fail if npc in another room
      - ✅ if acts fail/succeed then coloured red/green
      - ❌ can open/close directly from door
        - cannot infer `meta.inner` unlike switches
      - ℹ️ for Player would probably hide ContextMenu on exit room/area (via sensor)
    - ✅ updateFromLastDown -> useHandleEvents
  - ✅ long press do point: actual nav mesh may be strictly smaller
    - ✅ from off-mesh closest point on nav mesh
    - ✅ still seeing long-press issues on mobile e.g. to bed from floor
  - ✅ meta.doPoint should be defined on all do points
  - ✅ World shows closable message until `awaitWorld` resolves
    - ℹ️ "connect a tty e.g. by clicking its tab then coming back"
  - ❌ fix stationary npc without access trapped next to closed door
    - no repro
  - ✅ can turn transparent walls on/off
  - ✅ ContextMenu: move "pin" inside pop-up
  - ✅ assets.js also converts icon--* directly to PNGs and WEBPs
  - ✅ ContextMenu: icons for open/close/lock/unlock
  - fire event onchange agent neighbours
    - ℹ️ could use it to reposition stationary npc (via process)
  - stationary npcs should rotate a bit when they move out of the way
    - ℹ️ use desiredVelocity to move ±5deg base direction
  - ✅ auto-open accessible door earlier
    - e.g. check up to two corners in this case

- 🚧 integrate Viewer into blog
  - 🚧 screenshots in 1st blog
    - ✅ screenshot data-url i.e. `w view.toDataURL`
    - ✅ open in browser i.e. `w view.openSnapshot`
    - ℹ️ our api only captures the canvas e.g. no ContextMenu, logger, Tabs, tty etc.
    - ℹ️ chrome devtool supports select node then >capture node screenshot
    - 🚧 1st image goes after explanation of "underlying problem"
  - blog has ui to mutate Viewer
    - can totally overwrite
    - can change World mapKey
    - can change tty env (e.g. PROFILE) and reboot
  - 🚧 clean up profile-1
    - e.g. `spawn rob $( click 1 ) --degrees=90`
    - e.g. `npc rob --showSelector=true --setLabel=Robbo`

### On hold

- can only spawn onto navigable floor or do point
- spawn onto do point uses orient
- redo cuboid-man: lower-spine-bone (for sit), independent face quad, clean skin
- redo cuboid-pet
- represent skins as single TexArray
- improve alternate character faces
- improve alternate character icons
- clean overwritten attributes using patched three.js:
  > `w.r3f.gl.getAttributes().remove(attribute)`
- ❌ clean away off-mesh-connection if we don't use them
- reconsider npc speech bubble style
  - ℹ️ keep npc label, even though speech bubble performance good for 100 npcs
- support different themes (floor colors, ceiling colors, obstacles diffuse, ...)
  - mobile vs desktop
  - default theme
  - dark theme
- ✅ tty should restore variables on full-page-refresh
  - currently only working on refresh Tabs
- npc label (e.g. `kate`) sometimes not updated in prod after reload
  - fixed by manually changing `npc.epochMs` then `w.npc.update()`
- ❌ avoid line rendering issues of Ceiling at large distances
- ✅ avoid creating gmGraph in nav.worker
  - create offMeshDefs in main thread and send
- change npc label height onchange animation
- smaller npc label
- ✅ allow multiple npcs through hull doors via different offMeshConnections
- ❌ npc stops on try nav to inaccessible-via-off-mesh-connection room
  - eventually?
- ✅ try align tiles with geomorph grid by extending navMesh slightly
- clarify/clean/simplify service/uv
- put into example-commands
  ```sh
  c=0
  while true; do
    w npc.spawn "{ npcKey: \"rob_${c}\", point: $( click 1 ) }" >/dev/null
    call 'x => x.home.c++'
  done
  ```
- sh: multi-line edit using Option+Enter not working
- remove stale examples from example-commands.md
- easier way to reboot control scripts
  - ℹ️ currently if edit `click` need to manually kill processes then run PROFILE
  - sh: can tag process e.g. as part of controls
  - sh: can kill processes based on tags
  - sub-script CONTROLS of PROFILE, which kills existing process and tags new ones
- better texture for cuboid
- prevent two different npcs from fading to same do point
- BUG saw e.npcToDoor missing key
  - ℹ️ maybe physics.worker broke on hmr
- Game Master option for partially transparent walls, where object-pick ignores walls
- useStateRef provides `state.ref(key)` which deletes sub-refs on null
  - maybe `useStateRef(() => state, { refs: ... })` to avoid re-creation
- ✅ profile-1.sh edit should not hmr Viewer
  - Viewer tabs def should not hmr Tabs
  - downgraded flexlayout-react
- ceiling shader lit according to camera angle
- can select npc while paused e.g. click npc causes single frame update?
  - ✅ via manually resumed process which controls selection
  - better way?
- npc should look ahead 2 segs and don't re-test
- Example of `state.crowd.raw.setObstacleAvoidanceParams(1, new Recast.dtObstacleAvoidanceParams())`?
  - recast-navigation-js discussion?
- hmr sometimes breaks npc opacity/selector
- skins: can remap "cuboid" head/body too
- ❌ try animate ceiling diffuse i.e. more/less white
- ✅ try avoid recreate decor/obstacles CanvasTexture by fixing texture size
- consider using rapier for raycasting, rather than adding three-mesh-bvh
  - try adding static non-colliding "walls and doors" and raycast against them
  - could filter out doors which are open
- decor hmr while paused broke decor quads instanceId?
- auto reduce fov when World canvas wide with short height?
  > `w update 'w => w.view.targetFov = 5'`
- ℹ️ to use `await ...` inside `map` we must write `async` in def (unlike `run`)
  - e.g. `echo foo | map 'async x => { await new Promise(r => r()); return x }'`
- ❌ Tabs: can specify initially awake background tabs e.g. tty for mobile
  - background tab never was rendered
- useGLTFsAsync hook
  - replaces synchronous useGLTF
  - supports multiple and provides each when ready
  - hmr: can provide hash (e.g. lastModified) triggering reload
- ongoing "large Chrome memory in tab" issue
  - ℹ️ https://support.google.com/chrome/a/answer/6271282?hl=en#zippy=%2Cmac
  - ℹ️ `/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --enable-logging --v=1 --verbose`
  - ℹ️ `cat '/Users/robmyers/Library/Application Support/Google/Chrome/chrome_debug.log'`
  - create a branch and repro without workers/crowd
- bug: tty: ctrl + w while multiple input: goes back a line
- bug: sh: paste multiline command and start Cmd-Deleting midway
- tty pause/resume should remember cursor position
- ✅ tty resize while multiline input still bit broken
  - resize small, then resize big and see broken line, resize bigger seems fixed
  - ℹ️ but native terminal has same issue
- ❌ change fov with camera distance? e.g. 15 far, 30 close
- decor labels should be instancedmesh with custom shader
- support click switch to open door, instead of click door
  - mobile has difficulty pressing switches, so
    try provide "echo circle" for touch devices
- stationary npc with agent uses navQuery with blocked doors?
  - to avoid being pushed through doors by other npcs
- ❌ hmr issue with Connector class
  - we don't support it
- ❌ hull door enter-room triggers late?
  - stale
- ContextMenu for door has button redirecting "lastDown" to nearby switch
  - easier for mobile users
- towards faster raycast against instancedmesh
  - https://github.com/gkjohnson/three-mesh-bvh
  - https://github.com/pmndrs/drei/blob/master/src/core/Bvh.tsx
  - Walls has `useBvhRaycast` which constructs static geom and hijacks raycast
  - Doors has `useBvhRaycast` which constructs geom (doors closed) and hijacks raycast
    - will need "door open ratios"
  - 🤔 maybe use object-picking + canonical point instead
- doors can slide in specific direction
  - try scaling door and changing uv map
- maybe "move" constants into geomorphs.json
  - to avoid HMR versus geomorphs.json "alternate routes"
- workers should only hot reload when directly edited or geomorphs.json changes
  - workers should get constants from geomorphs.json
  - otherwise might restart early, retrieving old geomorphs.json
- ✅ can color obstacles
- request new nav-mesh onchange base "getTileCacheGeneratorConfig()"
- can choose colour of obstacle instances
- permit single quotes inside e.g. game-generators
- ❌ rebuild animation actions `IdleLeftLead`, `IdleRightLead`
- ❌ shoulder mesh (extend from chest), or arms closer to chest ❌
- decor sprite bounds issue on edit decor
  - e.g. resize extant decor sprite
- ✅ support recursive stringified Set
  - `expr 'new Set([new Set([0,0,1,1])])'`
- running `source PROFILE` twice breaks e.g. toggle door
  - maybe detect/warn "duplicate process def"
- duplicate walls in a symbol seemed to cancel each other out
- careful that world query doesn't "run twice at once"
  - e.g. by focusing window whilst ongoing?
- `Tabs` css should not reference src/const
  - try refactor `faderOverlayCss` e.g. merge into `<figure>`
- ❌ change camera fov based on camera height and/or visible-world
- Boxy rounding errors issue
  - https://boxy-svg.com/bugs/382/grouped-duplicate-then-snap-has-errors
- 🚧 memory leaks
  - ℹ️ use incognito to avoid extensions memory leak
    > https://superuser.com/questions/1843134/my-chrome-tab-memory-usage-increases-with-every-tab-reload-going-up-to-2gb-per-t
  - ℹ️ https://superuser.com/questions/1817473/what-accounts-for-the-discrepancy-between-the-memory-use-shown-when-hovering-on
  - ℹ️ can also use three.js stats UI which has a memory indicator
  - 🚧 interact, then take memory snapshot of both workers
  - geometry attributes are a possible memory leak
    - could update geometry attributes rather than create new attributes
      - see https://github.com/mrdoob/three.js/issues/26835#issuecomment-1733180984
      - i.e. preset large bounds, and use geometry.setDrawRange
    - could use underlying gl api to remove attributes
WorldMenu log extras
  - permit resize (mobile too)
  - resize observer fits
  - checkboxes: pin ✅ show debug logs 🚧
- 🚧 Tabs: support keyboard shortcut to switch tabs: `ctrl+[`, `ctrl+]`
  - ✅ shortcut works in active tabset
  - ✅ clicking tab header sets active tabset
    - ℹ️ started working after npm upgrade
  - had to downgrade because profile edit remounts all tabs
    - https://github.com/caplin/FlexLayout/issues/456#issuecomment-2499190906

- could clean navMesh by
  - ℹ️ ongoing problem; we are "composing" recast-detour
  - adjusting geometry e.g. table in briefing room
  - adding custom areas
    - like existing door polys
    - tried "all room" already
- BUG obstacles.png slightly different onchange
  - no visible difference, probably due to "quick approach"
- verify HMR which propagates from assets -> geomorphs.json -> gmsData
- avoid connector re-computation i.e. extend serialization
- currently single quotes are breaking game-generators
- 🚧 Boxy SVG can be slow to save
  - https://boxy-svg.com/bugs/370/intermittent-slow-saving
  - 🚧 try replicate again in Chrome vs Incognito Chrome
  - 🚧 try turn off "FileVault" on Mac OS
- ✅ `w` command by itself should not throw
- syntax highlighting in the shell
  - https://github.com/wooorm/emphasize
  - for `declare -f foo`
  - for `PROFILE` via "hash-bang prefix"
  - for `/etc/game-generators.sh` via "hash-bang prefix"
- ignore certain tags e.g. `s`, `obsId`, `obstacleId`
- machinery less white
  - they have large white borders
  - try instance color

- prevent NPCs going through closed doors
  - i.e. color nav query
- ✅ use rapier physics 3d in web worker
  - i.e. static triggers

- next.js repo continued
  - migrate Viewer

- 🚧 more decor images
  - computer
  - speaker
  - communicator
  - fabricator
- place decor points on many tables
- more tables in 301
- more tables in 101
- verifyDecor inside CLI (previously did inside Decor)
- gatsby: somehow reconfigure `TerserPlugin` to exclude `npc-cli/sh/src/*`
  - already tried using extension `.min.js`
  ```js
  /**
   * https://github.com/gatsbyjs/gatsby/blob/519e88db154d1fc3c9a91c8ad2e139c61491fb02/packages/gatsby/src/utils/webpack.config.js#L770
   * https://github.com/gatsbyjs/gatsby/blob/519e88db154d1fc3c9a91c8ad2e139c61491fb02/packages/gatsby/src/utils/webpack-utils.ts#L686
   */
  const terserOptions: TerserOptions = {
    keep_classnames: true,
    keep_fnames: true,
  };
  opts.plugins.minifyJs({
    terserOptions,
    exclude: , // 👈
  });

  const webpackCfg = opts.getConfig() as Configuration;
  const minimizer = webpackCfg.optimization?.minimizer;
  if (Array.isArray(minimizer) && minimizer[0] instanceof TerserPlugin) {
    console.log('🔔 detected TerserPlugin');
    // 🚧 create new TerserPlugin, excluding certain files
  }
  console.log({ minimizer: webpackCfg.optimization?.minimizer })
  ```
- 🚧 🔥 sometimes during development restarting stops working,
  - can see 3d floor but console logs `THREE.WebGLRenderer: Context Lost`
  - observed that worker was not running
  - 🚧 try saving memory in web-worker, following recast-navigation-js
- TTY windows ctrl-c conflict: abort vs copy selection
  - take same approach as Windows itself
  - in Windows, when `this.xterm.hasSelection()`, ctrl-c should copy, not abort
- try leaving one logged-in window open before go offline, see how long it works
  > https://boxy-svg.com/questions/283/ability-to-use-while-offline
- distinguish symbols:
  - some extend beyond viewbox (e.g. stateroom),
  - some do not (e.g. table)
- ❌ static obstacles can specify color or shade
- tag `hull-wall` -> `wall hull`
- use decor cuboids under e.g. machines and desks
- closed doors have filtered doorPolys
- can make agent look at point
- prevent agent going through door
  - e.g. when avoiding another agent, could use obstacle
  - e.g. use gmRoomGraph to avoid going thru closed door
- show toast while navmesh loading
  - also show results e.g. number of tiles

- ❌ improve `yarn ensure-webp` by detecting webp older than png
- initially force complete assets recompute
- permit holes in symbol walls?
  - currently supported
  - ✅ eliminated only examples (2)
- ❌ images script avoids recomputing
- mobile extra space at bottom again (?)
  - probably caused by new sticky header
- ❌ create smaller-pngs.js and compare to https://tinypng.com/
- ❌ scripts assets/images trigger different useQuery
- ❌ Player view could be top-down with high walls
  - try fixing door height with black wall above
- optionally increase floor image resolution e.g. 2x
- avoid recomputing npcs/obstacles in TestNpcs
- fix open/close non-aligning hull doors
- ℹ️ boxy svg: when undo move-then-duplicate, need to undo both!
- can directly change a single door's material e.g. make wireframe
  - https://www.npmjs.com/package/three-instanced-uniforms-mesh
  - https://codesandbox.io/p/sandbox/instanceduniformsmesh-r3f-lss90?file=%2Fsrc%2Findex.js
- extend door/window connectors with correct roomIds
- clarify handling of windows
- simplify polygon JSON format e.g. flat arrays
- start using cypress
- saw slow resize on maximize desktop (but not mobile)
- try fix sporadic missing updates
  - ✅ move maps to `media/map`
  - ✅ improve remount keys
  - still seeing occasional issues?
- sh `test {fn}` evaluates function with `map` args
- Terminal crashing during HMR
  - possibly fixed via `xterm-addon-webgl@beta`
  - ℹ️ haven't seen for a while
- need to remove labels from hull symbol image?
- Firefox android allows unbounded scrolling on "interact"
  - debug locally using about:debugging#/runtime/this-firefox
- 🚧 Boxy SVG: can we avoid creating new `<pattern>` when copy/dup then transform?
  - https://boxy-svg.com/ideas/371/transform-tool-preserve-pattern-geometry-option

- in parallel, start going through https://github.com/recastnavigation/recastnavigation
  - to understand what recast outputs
  - to understand what detour inputs

- ❌ only show ContextMenu on right click on desktop
- ❌ show ContextMenu on double tap instead of long tap

- if Viewer maximised and choose menu item, halve size of the Viewer

- if only open Viewer a tiny amount then it should close itself

- fix multi-touch flicker on drag
  - setup local dev on phone to debug this
- can add Tabs via links in blog posts
  - without remounting other tabs!
- open Viewer should enable Tabs initially
- how does shell function versioning work in sh/scripts.ts?
- fix vertical tab drag on mobile
  - need repro

- iOS issues:
  - ✅ Nav wasn't centred
  - ✅ Viewer initially partially occluded
  - seems fixed on iPhone 13

- ✅ World WebGL rendering pauses on pause Tabs

- install cypress to test terminal
- netlify site `npc-cli` at https://lastredoubt.co


## Scratch Pad

### Terminology

The system involves three parties:
- the _Player_.
- the _Game Master_ (GM).
- the _Environment_ (Env).

The Player is human.
The GM is either human or a computer program.
The Env is the underlying computer program where games are played/created by the Player/GM.

### Recast Detour Analysis

- https://recastnav.com/
- https://github.com/isaac-mason/recast-navigation-js/tree/main
- https://github.com/recastnavigation/recastnavigation/issues/641#issuecomment-1622583548

### Shell and JavaScript

```sh
# represent selected npc
click | map meta.npcKey >selectedNpcKey &

# selected npc does on long click
click --long | run '({ api, home, w, datum }) {
  while ((datum = await api.read()) !== api.eof) {
    const npc = w.npc.npc[home.selectedNpcKey];
    await npc.do(datum).catch(() => {});
  }
}' &

# selected npc does/look on long click
click --long | while take 1 >lastClick; do
  selectedNpc=$( w npc.npc.${selectedNpcKey} )
  if get lastClick/meta/floor && ! test $( get selectedNpc/s/doMeta ); then
    selectedNpc | map '(npc, {home}) => npc.look(home.lastClick)'
  else
    selectedNpc | map '(npc, {home}) => npc.do(home.lastClick)'
  fi
done &
```

```js
/**
 * 🔔 non-generators are interpreted as `map '{myFunction}'`
 * @param {NPC.ClickMeta} input
 * @param {RunArg} ctxt
 */
export async function walkTest(input, { w, home })  {
  const npc = w.n[home.selectedNpcKey];
  if (npc) {
    npc.s.run = input.keys?.includes("shift") ?? false;
    // do not await so can override
    npc.moveTo(input).catch(() => {});
  }
}
```

## Done

- ✅ rename current netlify site `npc->cli` -> `the-last-redoubt`
  - https://the-last-redoubt.netlify.app/test/
  - https://staging.lastredoubt.co
- ✅ connect new netlify deploy, named `npc-cli`
  - https://npc-cli.netlify.app/
- ✅ fix initial font load: svg fontawesome
- ✅ start new desktop layout i.e. with right-pane
- ✅ use system fonts instead of web fonts

- ✅ add mobile layout i.e. with lower-pane
- ✅ mobile layout fixes

- ✅ easier to close Nav
- ✅ easier to close Viewer

- ✅ Viewer has Tabs
  - try avoid "cannot update component" error
- ✅ fix Viewer side-by-side Tabs minimize in large viewport

- ✅ fix layout height on mobile device

- ✅ useSiteStore drives Nav
- ✅ open Viewer closes Nav
- ✅ open Nav darkens Main
- ✅ Viewer Tabs has id `{articleKey}-viewer-tabs` (for persist)

- ✅ Tabs has controls
  - ✅ small viewport ui
  - ✅ large viewport ui
  - ✅ disable/enable
  - ✅ reset
  - ✅ maximise/minimise
    - by expanding Viewer

- ✅ can reset while paused
- ✅ close Viewer disables Tabs
- ✅ can max/min while paused
- ✅ can make Viewer larger

- ✅ fix max Viewer in large viewport
- ✅ Viewer tabs does not need to know articleKey
- ✅ fix darken overlay in small viewport
- ✅ move Controls outside Tabs as ViewerControls
- ✅ move Toggle inside ViewerControls
- ✅ ViewerControls always visible
- ✅ ViewerControls buttons/Toggle not positioned absolute
- ✅ remember if Viewer is open and trigger client-side

- ✅ can drag Viewer bar
  - ✅ can drag "drag-bar" instead
  - ✅ drag to 0% and let go => sets viewOpen `false`
  - ✅ when viewOpen false can start dragging
  - ✅ add overlay when dragging (body can be covered by iframe)
  - ✅ get resize working on mobile
  - ❌ CSS var --view-size driven by useSite

- ✅ Couldn't scroll iframe in `<Comments>`
  - Problem disappeared after restarting Chrome

- ✅ Nav icons for Blog, Dev, Help, About

  - Blog: `robot`
  - Dev: `code`
  - Help: `circle-question`
  - About: `circle-info`

- ❌ toasts indicate loading assets/components

- ✅ copy over sh folder
  - comment out references to e.g. World, NPC, Geom, PanZoom,
- ✅ rename src/js -> src/npc-cli
- ✅ add Terminal
  - ✅ add files to src/npc-cli/terminal
  - ✅ move tabs inside npc-cli
  - ✅ can see component in Tabs

- ✅ ensure Tab components are lazy-loaded

- ❌ pivot to NPC fixes in repo `the-last-redoubt`
  - Spine-based animation not good enough
  - too many other issues e.g. collisions

- ✅ add `npc-cli/geom`
- ✅ starting migrating `npc-cli/graph`

- ✅ setup SVG symbols (simplify existing system)
  - ✅ hull symbol
  - ✅ non-hull symbol
  - ✅ `yarn symbols-meta`
    - ✅ try universal replacement for cheerio `htmlparser2`
  - ✅ script watches files
  - ✅ other hull symbols
  - ✅ can extract `gm.pngRect`
    - ✅ given def `gms` construct each `gm.pngRect`
      - i.e. `layout.items[0].pngRect` (hull symbol)
      - i.e. from symbolLookup generated by `yarn svg-meta`

- ✅ add working react-three-fiber demo R3FDemo

- ✅ Tab doesn't need to use react-query
- ✅ If Tabs enabled, Reset does not disable
- ✅ Tabs should go disabled on when leave view
- ❌ No resize Canvas when not rendering
  - part of `Canvas`

- ✅ R3FDemo (TestWorld) improvements
  - ✅ renderer stops when paused
  - ✅ mouse zooms to point under cursor
  - ✅ initially rotates
  - ✅ fix z-fighting (hack)
  - ✅ rename as TestWorld; rename worker demo as TestWorker
  - ✅ fix z-fighting properly: additive blending, depthWrite false
  - ✅ "Preserve" R3FDemo height when disabled
  - ❌ start migrating character controller with soldier.fbx
    - https://discourse.threejs.org/t/character-controller/46936

- ✅ try https://github.com/pmndrs/react-three-offscreen
  - ✅ create simple demo
  - ✅ fixing resizing
  - ✅ add prop-passing via messaging
    - ✅ keep worker in another file
    - ✅ test patch
    - https://github.com/pmndrs/react-three-offscreen/issues/8#issuecomment-1975397224

- ✅ non-terminal tab disabled when other tab maximized
  - TestWorker was showing when Tab was minimized

- ✅ Can Esc/Enter to enable/disable in Terminal/Tabs
- ✅ Terminal rendered using WebGL
  - fix HMR via `npm i xterm-addon-webgl` https://github.com/xtermjs/xterm.js/issues/4757

- ✅ abstract `TestWorld` as `TestCanvas`
  - ✅ `TestCanvas` has generic prop `childComponent` e.g. `Scene` not `<Scene />`
  - ✅ `TestCanvas` has prop `sceneProps` to be used as `<Scene {...sceneProps} />`
  - ✅ create test scene `TestCharacter` and hook up to `Viewer`

- ✅ Fix remount issue
  - `TestScene` was exporting `customQuadGeometry` which broke HMR

- ✅ geomorph 301 position slightly wrong?

- ❌ start "GeomorphEdit" in TestWorld
  - ✅ `TestWorld` -> `TestWorldScene` in `TestCanvas`
  - ✅ remove `TestWorld`
  - ❌ start map-level UI with `HTMLSelectElement`s
  - ✅ THREE gridHelper -> single quad infiniteGridHelper
    - fix jsx type
  - ❌ can detect click geomorphs or hull doors
  - ℹ️ use SVG editor instead, rep gms as e.g. 1200 * 1200 boxes

- ✅ `TestCanvas` has div ContextMenu shown on LongPress or RMB
    - ✅ when click outside scene
    - ✅ when click on floor in TestScene

- ✅ Don't use a web worker, here's why:
  - `<NPC>` should use react-three-fiber
  - But then js representation `state` inaccessible from main thread
  - TTY code runs in main thread, so would need another rep + communication
  - More generally would have to wrap THREE in a communication API.
  - We can return to "web worker approach" once the project is more mature

- ✅ can layout map using SVG with geomorph placeholders (rects)
  - ✅ create example layout svg
  - ✅ `symbols-meta.json` -> `assets-meta.json`
  - ✅ parse maps and store in `assets-meta.json`
  - ✅ why is loaded map "in wrong position" ?
    - was referencing stale prop
  - ✅ `TestScene` reads from JSON and updates onchange
    - requires window refocus
  - ✅ avoid window refocus
    - ✅ can extend gatsby with dev-only endpoints
    - ❌ endpoint `GET /dev-events` (for EventSource) and `POST /dev-files-changed`
    - ✅ create websocket server and test browser connect
      ```js
      const url = "ws://localhost:8012/echo"
      const wsClient = new WebSocket(url)
      wsClient.onmessage = e => console.log('message', e)
      wsClient.send(JSON.stringify({ yo: 'dawg' }))
      ```
    - ✅ can trigger websocket via curl
      ```sh
      curl -XPOST -H 'content-type: application/json' \
        localhost:8012/send-dev-event \
        --data '{ "hello": "world!" }'
      ```
    - ✅ script assets-meta triggers websocket (if it exists)
    - ✅ browser triggers react-query refetch

- ✅ hull symbols have folder `symbols`, using placeholders
  - ℹ️ placeholders are partially transparent boxes of symbol filename's dimension
  - ✅ add stateroom symbol
  - ✅ extract during `yarn assets-meta`
  - ✅ maps: represent geomorph as single rect (via pattern)
  - ✅ clarify conversion { rect, transform } -> transform
  - ✅ compute affine transform we could apply to rect [0, 0, width, height]
    - ℹ️ want to eliminate rect.x, rect.y and transform-origin
      - let t_M be top-left of rect transformed under affine transform M
      - let t_S be top-left of [0, 0, rect.width, rect.height] transformed under 2x2 submatrix S of M
      - new affine transform is S plus translation (-t_{S,x} + t_{M,x}, -t_{S,y} + t_{M,y})

- ✅ maps parsing should support transform-origin too
  - ℹ️ can arise if rect starts with x, y attribs

- ✅ improve title

- ✅ fix HMR by moving consts elsewhere
- ✅ prevent multiple websocket connections on HMR

- ✅ New setup: `TestWorld` -> `TestWorldCanvas` -> `TestWorldScene`
  - ✅ create files
  - ✅ get infinite grid working
  - ✅ add geomorph canvases

- ✅ avoid blending THREE.AdditiveBlend geomorph PNGs i.e. depthWrite false only
  - ❌ try fix z-fighting by manually adding black rects
  - ✅ try fix z-fighting by drawing into canvas
  - ✅ fix edge geomorphs
  - ✅ try fix edge mismatches
  - ✅ handle edge geomorphs

- ✅ fix HMR full-refresh onchange `src/const`
- ✅ fix HMR full-refresh onchange `layout.js`

- ✅ recompute layout on `assets.meta[gmKey].lastModified` change
  - ✅ compute `assets.meta[gmKey].lastModified`

- ✅ websocket connection reconnects on close/open laptop

- ✅ remove childComponent feature from Tabs
- assume `demo-map-1` always available as fallback
  - ✅ `api.map` should only be null before assets-meta.json loaded
  - document it somewhere

- ✅ avoid recomputing unchanged symbols via content hash

- ✅ show hull 3d walls
  - ✅ TestGeomorphs can see `api.scene` in TestCanvasContext
  - ✅ remove `transform` from `Geomorph.Layout`
  - ✅ precompute symbols "floor"
    - hull defaults to union of hullWalls sans holes, insetted
    - non-hull likewise, with fallback `(0, 0, width, height)`
  - ✅ render floor polys in `TestScene`
    - ✅ use canvas texture
    - ❌ canvas -> image -> texture
    - ✅ move debug.image into canvas
    - ✅ hull symbol floor polys 
    - ✅ non-hull symbols scaled down to world coords in assets-meta.json
    - ✅ sub-symbol floor polys 
  - ✅ try draw hull doors on canvas
    - ✅ api.assets is deserialized
    - ✅ change hull doors back to original size
  - ✅ precompute wallEdges per symbols
    - rect -> edge(s) inside "symbol floor"
    - path -> edge(s) inside "symbol floor"
  - ✅ show wallEdges
  - ✅ precompute layout wallSegs in hull symbol
  - ✅ instanced two-sided quads for one geomorph
    - need wallSegs local gm -> world coords
  - ✅ instanced two-sided quads for all geomorphs
- ✅ show sub-symbol 3d walls
- ✅ wall segs change on edit map
- ✅ compute layout wallSegs in browser
- ✅ restrict doors in browser too
  - ✅ avoid origWalls i.e. store missing wall in symbol
- ✅ fix degenerate wallSeg
- ❌ show sub-symbol chairs, beds
  - ❌ use floating XZ planes
  - ℹ️ try single raised floor-sized texture
- ✅ changing map should change walls

- ✅ support optional walls e.g. `wall optional n`
  - ✅ `walls` does not include optional one
  - ✅ can add in optional ones based on sub-symbols

- ✅ avoid dev-server crash on save symbol to static/assets
  ```sh
  [1]   Error: ENOENT: no such file or directory, lstat '/Users/Robert.Myers/coding/np
  [1]   c-cli/static/assets/symbol/301--hull.svg.crswap'
  ```
  - ✅ store and read from media/symbols instead
  - ✅ still save to static/assets/assets-meta.json (so can fetch)

- ✅ on computeLayoutInBrowser change then layout should reload
  - ✅ onchange `geomorphService.computeLayoutInBrowser` recompute assets-meta
  - ✅ hash computeLayoutInBrowser function and provide in assets-meta

- ✅ show doors
  - ✅ try four segs (flickers)
  - ✅ doors -> connectors?
    - connector.roomIds unknown until know `rooms` i.e. in browser
    - connector.navGroupId unknown too
  - ✅ try one/two segs

- ✅ clean connector computation
  - ✅ apply transform to connector
  - ✅ cleanup "sign of polygon" issue
  - ✅ ParsedSymbol -> ParsedSymbolGeneric
  - ✅ geomorphService.polyToConnector -> geom.polyToConnector
  - ✅ do not compute connectors in assets-meta json
  -  ✅ Geomorph.{Meta,WithMeta} -> Geom

- ✅ compute navPoly per geomorph
  - ✅ transform connector rects in browser
  - ✅ maybe only provide doors/windows as polys in assets-meta
  - ✅ optional walls are present by default
  - ✅ browser computes `rooms` and `doors`
    - test draw room outlines
  - ✅ try precompute doors/rooms

- ✅ move layout computation to geomorphs.json generated by assets-meta
  - ✅ connector: `Geom.ConnectorRect` -> `Connector` class (geomorph.js)
  - ✅ types Geomorph.Geomorphs, Geomorph.GeomorphsJson
  - ✅ assets-meta.js creates geomorphs.json
  - ✅ compute Geomorph.Layout server-side
  - ✅ connect geomorphs.json to browser
  - ✅ wallsSegs, doorSegs derived from layout
  - ✅ symbol.uncutWalls -> symbol.walls

- ✅ geomorphs.json has navPolys
- ✅ debug draw fast-triangulated navPoly
- ✅ fix auto-update
- ✅ fix navPoly
- ✅ navPoly should include hull doorways
- ✅ uncut walls inherit meta
- ✅ rooms have meta via tag `decor meta`

- ❌ TestCharacter (character controller)
  - ✅ simple demo using https://github.com/pmndrs/ecctrl
  - ❌ BUG ecctrl is panning on drag outside canvas
    - https://github.com/pmndrs/ecctrl/issues/34
    - create patch in the meantime
  - ✅ sporadic issue with pause i.e. scene disappears
    - ❌ `THREE.WebGLRenderer: Context Lost`
    - ✅ pause physics
    - ✅ disable CameraControls
    - ✅ frameloop must be `demand` instead of `never`?
  - ℹ️ we'll only use rapier3d for Kinematic-Position Player vs Sensors

- ✅ fix stellar cartography nav
  - ℹ️ transform-box `fill-box` issue

- ✅ start using recast/detour
  - https://github.com/isaac-mason/recast-navigation-js/tree/main/packages/recast-navigation-three
  - ✅ create `small-map-1` i.e. single 301
  - ✅ generate navPolys as three.js Mesh (earcut triangulation)
  - ✅ try threeToSoloNavMesh
    - ℹ️ failing with single 301
    - ✅ try construct BufferGeometry as OBJ and import into
      https://navmesh.isaacmason.com/
    - ℹ️ normals were geting flipped
  - ✅ fix threeToSoloNavMesh for `demo-map-1`
    - ℹ️ normals getting flipped again
    - ℹ️ seems need BufferGeometry per instance (bad)
    - ❌ try non-three API: recast-navigation/generators seems to block main thread
    - ✅ try @recast-navigation/three with BufferGeometry per instance, then dispose
  - ✅ move to web worker
    - ✅ create web worker test-world-scene.worker.jsx
    - ✅ can send messages from TestWorld to worker e.g. `{ mapKey }`
    - ✅ worker fetches geomorphs.json initially
    - ✅ worker creates initial meshes
    - ✅ worker initializes recast/detour wasm
    - ✅ worker constructs threeToSoloNavMesh
    - ✅ worker serializes and main thread deserializes
    - ❌ TestWorldCanvas provides ref (State) to parent TestWorld
      - already provides state as ctxt.view
    - ✅ main thread shows navMesh via helper
    - ✅ remove orig approach in TestWorldScene
  - ✅ try threeToTiledNavMesh
  - ✅ fix disconnect at a 301 hull door
    - bridge--042 has many transform-box: fill-box
  - ✅ try threeToTileCache
  - ✅ test against `small-map-1` + `demo-map-1`

- ✅ try shader for instanced walls/doors
  - https://blog.maximeheckel.com/posts/the-study-of-shaders-with-react-three-fiber/
  - ✅ try gradient fill shader for doors
    - works, but the instance ordering is broken!
  - ✅ why does meshBasicMaterial order things correctly, but not my custom shader?
    > It's the shader material you're using. Three materials have routines build in that handle instanced meshes, the instancing is done in shaders
    > You can piece a working shader together from 'shaderchunks', or modify an existing shader with material.onbeforecompile
    > https://www.reddit.com/r/threejs/comments/scwjwb/comment/huafmn6/?utm_source=share&utm_medium=web2x&context=3
  - ℹ️ https://github.com/mrdoob/three.js/tree/master/src/renderers/shaders/ShaderLib
  - ℹ️ https://github.com/mrdoob/three.js/blob/master/src/renderers/shaders/ShaderLib/meshbasic.glsl.js
  - ✅ create `<shaderMaterial>` using copies of mesh basic material vertex/fragment shaders
  - ✅ create simplified versions with just enough
  - ✅ doors have gradient fill

- ✅ can open doors on direct click (DEMO only)
  - ✅ onPointerUp provides point and instanceId
  - ✅ can directly open a single door (sans animation)
  - ✅ can directly open a single door (animated)
    - can directly mutate instanceMatrix.array
    - https://github.com/mrdoob/three.js/blob/b7015c89d57e24c5a2d4cdaad34559bc8d5c599a/src/objects/InstancedMesh.js#L218


- ✅ PR for recast-navigation-js extending dtNavMeshQuery
  - ℹ️ https://github.com/isaac-mason/recast-navigation-js/discussions/298
  - ✅ https://github.com/isaac-mason/recast-navigation-js/blob/main/DEVELOPMENT.md
  - ✅ re-build @recast-navigation/wasm 
  - ✅ add findPolysAroundCircle
  - ✅ add queryPolygons
  - ✅ test findPolysAroundCircle
  - ✅ test queryPolygons
  - https://github.com/isaac-mason/recast-navigation-js/pull/300

- ✅ fix transform-box parsing
  - ✅ transform-box`fill-box` working for `rect`
  - ✅ transform-box `fill-box` working for `path`
- ✅ fix scale i.e. pre-scale by worldScale so tileSize 30 correct
  - Seems tileSize 30 was already correct.
    We thought there were many extra tiles by inspecting tile `dataSize`, but seems it can be non-zero without meaning anything

- ✅ get obstacle working again
  - https://github.com/isaac-mason/recast-navigation-js/discussions/272#discussioncomment-9020184

- ✅ count number of tiles we're using
  - verify `tile.header()?.polyCount` truthy
  - way too many i.e. `1382`
  - currently `105`

- ✅ something is wrong with polygon selection
  - polygon selection is fine
  - seems sometimes doorway polys have hidden extras connections

- ❌ reduce number of tiles used...
  - ℹ️ single 301 has `137` tiles, each with at most `5` polygons
  - ❌ try restricting single 301 geometry to (0, 0, 0) -> (30, 0, 15)
  - ❌ try modifying input geometry
    - ❌ widen navigable doorways slightly to preserve door polygons (?)
    - ❌ add y-raised points in doorways to preserve door polygons (?) 👈
    - wider doors, so can use larger `cs`
  - ❌ try removing doors and using off-mesh connections
    - unclear if can enable/disable

- ✅ try feeding different triangulation into recast
  - ❌ try a qualityTriangulate fed into recast
  - ❌ try piece-wise constructed triangulation 
  - ❌ try Triangle-generated triangulation

- ❌ try "cuts" i.e. non-outset alterations to symbols
  - possibly auto-added

- ✅ split hull doors in two for easier doorPolys

- ✅ fix obstacle outsets in hull symbols
  - we now fixOrientation in extractGeom

- ✅ HMR issues
  - ✅ onchange mapKey in Viewer
  - ✅ obstacles stop working
  - ❌ onchange map sometimes animation doesn't restart
    - no repro

- ✅ recast/detour continued
  - ✅ single agent crowd seen via CrowdHelper
  - ✅ iterate crowd.update, pausing on disable Tabs
  - ✅ visualize navPath
    - https://github.com/donmccurdy/three-pathfinding/blob/main/src/PathfindingHelper.js
    - https://github.com/mrdoob/three.js/blob/master/examples/webgl_lines_fat.html
  - ✅ can navigate single agent to a clicked point
    - ℹ️ off-mesh target produced different paths via crowd vs query
    - ✅ works when edit map
  - ✅ can preserve agent position across HMR edit
  - ✅ add obstacle and depict using TileCacheHelper
  - ✅ two agents and can navigate both
    - ✅ crowd helper -> TestNpcs
    - ✅ fix HMR
    - ✅ add two agents
    - ✅ can select agent and navigate selected
  - ✅ tileCache helper -> TestNpcs
  - ✅ api.help.navMesh -> TestDebug
  - ✅ navPath helper -> TestDebug
  - 🚧 can make polygon un-walkable e.g. closed door
    - https://recastnav.com/classdtNavMeshQuery.html#details
    - https://github.com/isaac-mason/recast-navigation-js/issues/286
    - https://groups.google.com/g/recastnavigation/c/OqJRHFoiVX8
    - https://github.com/isaac-mason/recast-navigation-js/blob/d64fa867361a316b53c2da1251820a0bd6567f82/packages/recast-navigation/.storybook/stories/advanced/custom-areas-generator.ts#L371
    - https://github.com/isaac-mason/recast-navigation-js/blob/d64fa867361a316b53c2da1251820a0bd6567f82/packages/recast-navigation-core/src/nav-mesh.ts#L429
    - https://www.gamedev.net/blog/33/entry-2210775-more-recast-and-detour/
    - ✅ retrieve polygon points (messy)
    - ✅ get filter working
    - ℹ️ first attempt probably failed because we didn't "get enough" polygons?
    - ✅ navMesh has polys roughly corresponding to doors
    - ✅ can indicate found poly
      - packages/recast-navigation-core/src/nav-mesh.ts
      - seems we need exactly what's in `getDebugNavMesh` i.e. extra triangles inside poly is exactly so-called detailed-mesh (?)
    - ✅ cleanup
  - ✅ can re-plan moving agent path on HMR edit

  - ❌ TestCharacter:
  - ✅ use @react-three/rapier
  - ✅ extract basics from:
    - ℹ️ https://github.com/pmndrs/ecctrl/tree/main
    - ℹ️ https://github.com/visionary-3d/advanced-character-controller/tree/main
    - ℹ️ no need for: keyboard controls, ray, ...
    - ✅ kinematic-position-based
  - ❌ check anything is missing
  - ℹ️ we'll use rapier 3d in webworker i.e. kinematics vs sensors

  - ✅ recast/detour try use areas to preserve door polygons
  - https://github.com/isaac-mason/recast-navigation-js/discussions/306#discussioncomment-9069840
  - ✅ construct triangulation where door-triangles known
  - ✅ forward triangulation to recast
  - ✅ flatten layout.nav
  - ✅ mark door triangles for recast
  - ✅ working for a single geomorph
  - ✅ working for transformed geomorphs

- ✅ start generating geomorphs *.webp ourselves
- ✅ floor images: one per geomorph (first attempt)
  - ✅ fix cwebp.js
  - ❌ replace nodemon with nodemon.js
  - ✅ check file timestamps in assets.js
  - ✅ avoid recomputing symbols in assets.js
  - ✅ images script generates simplified floors
    - ✅ floor
    - ✅ navPoly
    - ✅ walls

- ✅ can show origNavPoly via floor image
- ✅ remove origNavPoly from geomorphs.json
- ✅ draw doors in floor images (e.g. over hull door debug flicker)

- ✅ stop using prettier i.e. use eslint instead
  - prettier ignore everything
- start using eslint with auto-format if possible

- ✅ install tailwind
- ✅ use tailwind/typography in mdx
- ✅ css fixes
  - ✅ improve layout width
  - ✅ fix header css change
- ✅ adjust nav toggle
- ✅ header `NPC CLI` -> top bar
  - FontAwesomeIcon beat was visible over position sticky

- ✅ script get-pngs extracts starship symbols from source
  - ✅ extract from media/Symbols
  - ✅ extract a folder from media/Geomorphs/
  - ✅ extract a folder from media/Symbols/
  - ✅ extract from media/Small Craft

- new source material from Robert Pearce?
  - https://drive.google.com/drive/folders/1apcZgZKXV5qOxNtQxtnQG0QNpkLzor-f

- ✅ towards recursive non-hull symbols
  - ✅ base-graph stratify (tested)
  - ✅ a non-hull symbol has sub-symbols
  - ✅ split fresher--001--0.6x1 into extra--fresher--*
  - ✅ more non-hull symbols have sub-symbols
  - ✅ non-hull sub-symbols are parsed
  - ✅ warn if sub-symbols dimension does not match original
  - ✅ define symbol dependency graph
  - ✅ build symbol dependency graph
  - ✅ depict graph using graphviz
    - ✅ base-graph generates `dot` digraph
    - https://graphviz.org/doc/info/lang.html
    - https://dreampuf.github.io/GraphvizOnline
  - ✅ stratify symbol dependency graph

- ✅ generate recursive symbols
  - ✅ instantiateFlatLayout transforms a FlatSymbol without connectors
  - ✅ assets.js applies this function in a loop
  - ✅ flattenSymbol combines `symbol` with instantiations of existing FlatSymbols
  - ✅ after `flattened` is complete, create layout
  - ✅ understand/fix stateroom--036
    - symbol `<g>` was transformed

- ✅ refine recursive symbol example i.e. stateroom--036
- ✅ sub-symbol decor meta.orient (degrees) is transformed too
  - ✅ layout.decor exists
  - ℹ️ see modifySinglesMeta in repo the-last-redoubt
- ✅ meta.orient not working
  - reduceAffineTransform
- ✅ layout.decor are points, rects or circles
- ✅ more recursive symbols
  - extra--fresher--001
  - extra--fresher--002
  - fresher-002
  - bed--003
  - bed--004
  - bed--005
  - console--019
  - console--031
  - console--051
  - stateroom--014
  - stateroom--036
  - stateroom--014--2x2 e.g. use bed--003--1x1.6
  - ✅ decompose desk--003--0.8x1 as two symbols
  -   ✅ extra--003--chair--0.25x0.25
  -   ✅ extra--004--desk--0.5x1
  - ✅ table--004--1.2x2.4
  - ✅ bridge--042--8x9
- ✅ only one lookup needs to be extended when adding symbols
  - SymbolKey derived from it

- ✅ PR for recast-navigation-js
  - https://github.com/isaac-mason/recast-navigation-js/pull/325

- ✅ switch back to TestCharacter
  - ✅ initially use model from https://github.com/abhicominin/Character-Controller-three.js
    - https://discourse.threejs.org/t/character-controller/46936
    - https://character-controller-three.netlify.app/
  - ✅ CharacterController does not depend on orbitControls
  - ✅ can click to move
    - ✅ on click ground set CharacterController target
    - ✅ move to target
    - ✅ turn to target
  - ✅ remove keyboard controls

- ❌ try unify parseMaps and parseSymbols
- ❌ migrate Triangle
  - png -> webp script applied to assets/debug
- ❌ learn about WebGl RenderTargets
  - Towards "Pixi.js RenderTexture" functionality
  - https://blog.maximeheckel.com/posts/beautiful-and-mind-bending-effects-with-webgl-render-targets/
- ❌ try migrate R3FDemo to react-three-offscreen
- ❌ improve MapControls zoomToCursor on mobile
  - two fingers leftwards to rotate
  - two fingers upwards to set polar
- ❌ (hull) walls -> quads
  - ℹ️ trying alternative i.e. "edges outside floor"
- ❌ try avoid alphaBlend geomorphs via alphaMap
  - we only need depthWrite false
- ❌ react-three-fiber onPointerUp not updating when instance transformed
  - ❌ possibly related closed issue:  https://github.com/pmndrs/react-three-fiber/issues/1937
- ❌ world editor in new repo
  - instead we use Boxy SVG to make `media/map/{mapKey}.svg`
- ❌ geomorph editor in new repo
- ❌ despite our "generic aim" (fabricating game masters),
  some context will help e.g. The Last Redoubt
  
- ❌ show tables via raised "floor texture"

- ✅ Restart TestCharacter: animation, no physics
  - ✅ clean away `@react-three/rapier`
  - ✅ show custom character FBX
  - ✅ scale character to desired height
  - ✅ import FBX into Blender and export as GLTF
    - ✅ install blender 4.1 (latest)
  - ✅ download three FBX animations from mixamo and somehow load into GLTF
    - show a Mixamo animation (use Blender to combine animations)
    - https://www.youtube.com/watch?v=y1er4qFQlCw&ab_channel=Valentin%27scodingbook

- ✅ raised obstacles
  - ✅ obstacle polys can `y={y}`
  - ✅ sub-symbols can `dy={dy}` and it aggregates
  - ✅ link layout obstacle to symbol obstacle
  - ❌ given symbol obstacle poly, and transformed obstacle poly, infer the affine transform
  - ✅ maintain transform in obstacle.meta
  - ✅ layout.obstacles as { origPoly, transform }
  - ✅ verify by drawing into floor canvas
  - ✅ InstancedMesh with unit XZ plane
    - ✅ show (possibly raised) rects
  - ✅ obstacles induce sprite-sheet with uv-map
    - ✅ create sprite-sheet json
    - ✅ name -> { symbolKey, obstacleKey, type }
    - ✅ one rect per (symbolKey, obstacleId)
    - ✅ packed rects should be in Starship Geomorphs units
    - ✅ create sprite-sheet png/webp
      - ✅ draw images as filled squares
      - ✅ extract PNG from SVG symbol
      - ✅ packed rects scale x2.5 for non-hull symbols
      - ✅ extract polygonal mask
      - ✅ avoid drawing white poly underneath
  - ✅ InstancedMesh uses uvs
    - https://discourse.threejs.org/t/sprite-instancing-with-uv-mapping/17234/2
    - https://stackoverflow.com/questions/48607931/per-instance-uv-texture-mapping-in-three-js-instancedbuffergeometry
    - https://github.com/mrdoob/three.js/blob/bf267925f7a96f576f781416624d78876b1ec42f/src/renderers/shaders/ShaderChunk/map_fragment.glsl.js#L4
    - ✅ single image applied to every instance
    - ✅ assets script includes `spritesheet.json` in `geomorphs.json`
    - ✅ images script mutates `geomorphs.json`
    - ✅ compute uvs for every obstacle in world (untested)
    - 🚧 try attach uvs in vertex shader
      - ✅ get custom shader working in same way as meshStandardMaterial
      - ✅ get `map` working in a custom shader (non-instanced mesh)
        - https://stackoverflow.com/questions/59448702/map-image-as-texture-to-plane-in-a-custom-shader-in-three-js
      - ✅ get `map` working in custom shader based on meshBasicMaterial (non-instanced mesh)
      - ✅ get `map` working in custom shader based on meshBasicMaterial (instanced mesh)
    - ✅ switch to manually specified custom shader with working map/instances
    - ✅ get custom shader working which uses `uvOffsets`, `uvDimensions`

- ✅ clean custom shader approach
- ✅ clean custom shaders again
- ✅ draw top of walls e.g. to obscure piercing obstacles
  - ✅ remove over-approx from floor images
  - ❌ could union walls, triangulate, use InstancedMesh triangles
  - ✅ could use ceiling texture per gmKey
    - could extend with labels
    - could change to per gmId and hide rooms via ceilings (Player FOV)
  - ✅ clean e.g. table seen in bridge
- ✅ fix symbol height convention
  - ✅ chair, sink, table have `obstacle y=0` for seat/surface
  - ✅ symbols height set via tag e.g. `dy=0.5`
- ✅ simplify symbol height convention
  - only use `y`
  - applies to all obstacles

- ✅ HMR issues
  - ✅ compute mapsHash, geomorphsHash, sheetsHash using `stringify(json)`
    - i.e. same as file contents.
  - ✅ avoid recomputing obstacles.png
  - ✅ can `yarn images-fast --all`
  - ✅ `yarn images-fast --staleMs=2000`
  - ✅ obstacles sprite-sheet needs to update
  - ✅ merge images.js into assets.js
    - ✅ draw floors
    - ✅ create spritesheet
    - ✅ draw spritesheet
    - ✅ avoid redrawing unchanged obstacle sprites
    - ✅ changed symbol obstacle detected
    - ✅ remove images.js
  - not-found sprite i.e. small red rect
  - ✅ obstacles sprite-sheet out of sync
    - ℹ️ texture size needs to change!
    - ✅ try force 4096 x 4096
    - ✅ recreate texture with different size on-the-fly
  - ✅ try serve images separately in development i.e. avoid gatsby /assets endpoints
    - ✅ ws-server serves images
    - ✅ remove delay from site.store
    - ✅ `yarn develop` still works
  - ✅ out-of-sync sprite-sheet persists
    - ✅ might have fix i.e. state.geomorphs was stale
  - ✅ geomorphs.hash
  - ✅ clean assets query
  - ✅ clean up hashes
  - ✅ avoid recomputing png -> webp
    - ✅ dev uses pngs
    - ✅ pre-push hook runs `npm run assets-fast --all`
    - ✅ images fallback from `webp` to `png`
    - ✅ pre-push hook should not commit if generates new webp

- ✅ fix sprite-sheet creation i.e. account for `<image>` offset properly
  - seems fixed, not sure why

- ✅ create Character demo with options Outline/Wireframe/CustomShaderWireframe
  - CustomShaderWireframe doesn't work, so ask https://discourse.threejs.org
  - get working shareable CodeSandbox link

- ✅ fix floor texture HMR
  - ✅ on edit TestGeomorphs
  - ✅ on change map
  - ✅ on change geomorph
  - ✅ on change spritesheet

- ✅ map switching not working?
- ✅ reset still not working on mobile (not loading)
  - works when leave and return to tab
- ✅ no need for CanvasTexture for obstacles sprite-sheet
- ✅ missing symbolKey in geomorphsService can break script i.e. have to `yarn clean-assets`

- ✅ get a blender minecraft rig working in mixamo
  - ℹ️ https://www.nari3d.com/boxscape
  - ℹ️ https://www.dropbox.com/s/mr1l5fb48rdwnwx/Cycles_Minecraft_Rig%20BSS%20Edit%20V6.5.zip?dl=0&e=1&file_subpath=%2FCycles_Minecraft_Rig+BSS+Edit+V6.5%2FAdvanced_Mob_Rig
  - ✅ select armature; pose mode; select {l,r}-arm and g-x-{-1,+1} upload to mixamo
  - triangle count
    - https://poly.pizza/m/isC73B8SKq ~`2000`
    - https://www.youtube.com/watch?v=8Ox6EUxYqzA ~`2200`
    - https://ridz25.itch.io/low-poly-minecraft-like-character ~ `520`, ~`360` without gloves (?)
      - ✅ can rig when add cubes: Groin, Neck, Left/Right Shoulder
    - https://sketchfab.com/3d-models/ultra-low-poly-animated-character-mixamo-based-186f3f7ffc30449a9bfce39f647abc92 `324`
      - ✅ auto-rigs from mesh

- ❌ mixamo minecraft again
  - https://ridz25.itch.io/low-poly-minecraft-like-character
  - ℹ️ will make our own animations, but maybe use provided idle/walk/run
    - focus on npc behaviour sort-of demands it?
  - ❌ clean veryminecraftylookingman
    - jpg skin -> png; delete gloves
    - center edit mesh?
  - ❌ Fixing transformed Body
    - Problem: `Body` inside group has z transform `-4.06447 m`
    - Seems we'd need to (a) undo this, (b) transform every frame (changing initial pose won't work)
    - But maybe doesn't matter
    - Btw mesh/bones align as follows: "Object mode; Click Armature, Shift-Click Body; Edit mode"
  - ℹ️ Minecraft measurements
    - 1 block means 1m³ means 16³ pixels
      - **BUT** seems 1m ~ 16pixels does not apply to character models
    - Player height: 1.8 blocks i.e. 1.8m
      - https://gaming.stackexchange.com/questions/398125/what-is-the-scale-of-the-minecraft-skin-overlay
    - Player heights:
      - head ~ 8 pixels ~ 8/32 * 1.8 = 0.45m
      - arms/legs ~ 12 pixels = 12/32 * 1.8 = 0.675m
- ❌ create rig ourselves:
  - https://www.youtube.com/watch?v=GB9phnNlzjQ&ab_channel=SharpWind
  - https://www.youtube.com/watch?v=JlzzU_dxp3c&list=PLGKIkAXk1OeQWaDCO0sYdgT2nN_Qu46HO&index=3&ab_channel=TutsByKai
- ❌ simplify high poly rig
  - https://www.dropbox.com/s/mr1l5fb48rdwnwx/Cycles_Minecraft_Rig%20BSS%20Edit%20V6.5.zip?e=1&dl=0
  - too complex; possibly incorrect dimensions
- ❌ try UV mapping `base-mesh-246-tri`
  - blender uv map tutorial
    - https://www.youtube.com/watch?v=nLJK2ExMhxU&ab_channel=IronbarkGamesStudio

- ✅ rename `extra--{foo}--{number}--*` as `extra--{number}--{foo}--*`
- ✅ walls can have different base-height and height e.g. for privacy-screen
  - ✅ can `wall y={baseHeight} h={height}`
  - ✅ can `{symbolKey} wallsY={baseHeight} wallsH={height}`
  - ✅ only draw ceiling if wall touches ceiling

- ℹ️ minecraft copyright issues
  - https://www.minecraft.net/en-us/usage-guidelines
  > We are very relaxed about things you create for yourself. Pretty much anything goes there - so go for it and have fun, just remember the policies and don’t do anything illegal or infringing on others.
  > ...
  > This applies, for example, if you want to set up and run any non-commercial blogs, servers, community forums, fan sites, fan clubs, news groups, events, and gatherings.

- ✅ go through minecraft rig tutorial after all
  - ✅ 1/4 modelling https://www.youtube.com/watch?app=desktop&v=7EW8TnN2BfY&ab_channel=ZAMination
    - don't subdivide until after uv-mapping
  - ✅ 2/4 uv-mapping https://www.youtube.com/watch?v=iMU_xnfKCpE&ab_channel=TutsByKai
    - found original uv map textures in Cycles_Minecraft_Rig BSS Edit V6.5
      - https://www.nari3d.com/boxscape
      - Cycles_Minecraft_Rig BSS Edit V6.5 > Textures > Mobs
  - ✅ 3/4 https://www.youtube.com/watch?v=JlzzU_dxp3c&ab_channel=TutsByKai
  - ❌ Shape keys for knee 90 degree leg bends
    - i.e. "morph targets" in three.js, requiring manually animation
  - ✅ slightly scale "back of knee" inwards to avoid z-fighting
    - maybe our "view from above" will hide the issue
  - ✅ IK bones for feet e.g. keep them still
    - https://www.youtube.com/watch?v=OMwFPBoXiMw&t=101s&ab_channel=Nekomatata

- ✅ adjust rig
  - ✅ bone naming convention `*_L` and `*_R`
  - ✅ work out how to do foot rigging i.e. heel roll
    - https://youtu.be/OMwFPBoXiMw?si=qns-Wq4Q6L2MjDd5&t=164
    - ❌ try pivot constraint on bones
    - ❌ try move leg backwards
    - ❌ try two foot bones: leg-base -> heel -> toe
    - ✅ try one ik bone with weight-painting, with head at heel
  - ❌ extra vertices above foot?
  - ✅ decided against foot (and extra vertices)
  - ✅ sharper knees

- ✅ minecraft walk cycle (first attempt)
  - https://www.youtube.com/watch?v=7EW8TnN2BfY&ab_channel=ZAMination
  - use mirroring https://www.youtube.com/watch?v=dms6Xy5gueE&ab_channel=Zallusions
  - our mesh is 2.5 larger than `Zamination_Rig_V4`
  - timeline > keying > Location and Rotation
  - ✅ control feet rotation via ik
  - ✅ foot should pivot around heel
    - to pivot around toe, set IK position first, set IK angle second 
  - ✅ revert to foot in the middle
  - ❌ maybe add vertices above foot
  - ✅ merge feet position/rotation into same ik bone
    - to pivot around toe/heel, set IK angle first, set IK position second
  - ✅ 1st attempt at 1st frame
  - ✅ rename bones to align with Blender naming convention
  - ✅ Cmd-C, Cmd-Shift-V to mirror 1st to 12; dup 1st at 24
  - ✅ continue from frame 12

- ✅ adjust rig again
  - ✅ remove dup vertices
  - ❌ try remove knees/elbows
  - ℹ️ can avoid bent elbow z-fighting per animation

- ✅ minecraft walk cycle (2nd attempt)
  - https://www.youtube.com/watch?v=e_COc0ZVHr0&ab_channel=MarkMasters
  - https://youtu.be/nRtT7Gr6S2o?si=bN2xQQ7XdXcBGvqL&t=717
  - do arms last to avoid hip adjustments causing conflicts
  - head https://www.youtube.com/watch?v=nRtT7Gr6S2o&ab_channel=JoeyCarlino
  - arms https://youtu.be/nRtT7Gr6S2o?si=TbFcm0wRxxHcs04O&t=1148
  - graph editor https://youtu.be/nRtT7Gr6S2o?si=kyDo19TLbpWdkzC1&t=1236

- ✅ copy minecraft-anim-test.2.blend -> minecraft-anim.blend
- ✅ try gltf export
  - ✅ scale: 8m (blender) -> 2m (three.js) i.e. 0.25
  - ✅ textures: must use `Principled BSDF material`
    - https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html#usage

- ✅ test gltf export does not need ik bones (feet, knees)
  - ✅ avoid many `SkinnedMesh` by joining meshes in Blender
  - ✅ must ALSO key {upper,lower}-leg bones for each keyframe
  - ✅ must uncheck `Properties > Bone > Deform` for IK bones
  - ✅ export gltf options > Data > Armature > Export deformation bones only
- ✅ multiple animations in one file
- ✅ minecraft idle animation

- ✅ minecraft run-cycle
  - ℹ️ body 0.3 down
  - ℹ️ arms strategy
    - rest-pose elbows initially pointing backwards
    - bend elbow via upper/lower arms initially
    - can rotate around local y afterwards
  - ✅ apply every keyframe to lower/upper legs, since we'll remove ik
  - https://www.youtube.com/watch?v=60Tn5ljVoDg&ab_channel=TheDuckCow
  - https://youtu.be/60Tn5ljVoDg?si=sikCrT9fosYESD2l&t=109

- ✅ fix TestCharacter foot-sliding
  - ✅ add root bone with Deform unchecked
  - ℹ️ must also mute (linear) root motion before export
  - ✅ walk cycle root motion ~ 5m
    - `.25 * 5 = 1.25m` after scaling i.e. speed `1.25m / s` (24 frames, 24 fps)
  - ✅ run cycle root motion ~ 10m
    - root motion `.25 * 10 = 2.5m` after scaling
    - 20 frames -> 24 frames via scale `24 / 20 = 1.2`
    - https://devtalk.blender.org/t/animating-in-blender-changing-the-frame-rate-should-have-the-option-to-preserve-animation-timing/21629/3


- ✅ infinite-grid-helper -> @react-three/drei shaderMaterial
- ❌ can color obstacle instances
  - should alter image directly instead
- ✅ change mapKey should request-nav-mesh but shouldn't restart worker

- ✅ extend TestCharacterDemo to multiple characters
  - ✅ try convert into jsx `npx gltfjsx minecraft-anim.glb`
  - ✅ rename -> TestCharacterDemo, TestCharacterOld
  - ✅ TestCharacters
    - ✅ don't use transform glb i.e. no `--transform`
    - ✅ support multiple instances via `SkeletonUtils.clone`
      - https://discourse.threejs.org/t/multiple-instances-of-skinned-mesh-wont-show-react-three-fiber/47678/2
    - ✅ only one instance of hook `useGLTF`
    - ✅ hook up to TestCharacterDemo
  - ✅ can click character and make it walk

  - ✅ office--061--3x4
  - table obstacles -> 2 symbols

- ✅ support obstacle tag `no-shadow`
- ❌ support sub-symbol tag `no-shadow`
- ✅ take union when drawing obstacle drop shadows

- ✅ support alternate sub-symbol approach:
  - label (title) of `use` remains the same
  - all symbols refer to same pattern (hopefully not duped by Boxy)
  - ✅ create actual `symbol` and `use` it
  - ✅ parse new structure
  - ✅ fix extra unsorted poly: ignore everthing inside a `<defs>`
  - ✅ another test + cleanup
- ✅ migrate 301 to new sub-symbol approach

- ✅  TestCharacterDemo skins
  - ✅ can change skin

- ✅ understand number of verts in mesh i.e. 278 is too many
  - ℹ️ 96 vertices in Blender:
    > `96 = 8 + (8*2*4) + 6*4`
    > i.e. head + (2 * arms + 2 * legs) + body
  - extras come from UVs i.e. need to duplicate vertex if has different UV
  - ✅ reduce to 241
  - ✅ reduce to 236
  - can probably reduce vertices more by re-arranging UVs, but:
    triangle count (168) and bone count (13) are probably dominating factor

- ✅ context menu
  - ❌ use `tunnel-rat`
  - ✅ move into own component TestContextMenu
  - ✅ works when right-click walls
  - ✅ avoid navigating when right-click floor
  - ✅ rethink mobile long-press

- ❌ can change sub-skin
  - ℹ️ wait until we have a skin where we need to do this
  - know uv body part ordering
    - either via Blender or node-ordering?

- ✅ clarify pointer{down,up} i.e. 2d, 3d
  - ✅ pointerdown, pointerup have boolean `is3d`
  - ✅ pointerup-outside has `is3d` `false`
  - ✅ infiniteGrid has onPointer{Down,Up}
  - ✅ walls, doors has onPointer{Down,Up}
  - ✅ api.view.lastDown
    - ℹ️ r3f onPointerMissed only for pointerup, not pointerdown
    - 3d onPointerDown sets
    - 2d onPointerDown clears 3d stuff if 2d point doesn't match
  - ✅ obstacles has onPointer{Down,Up}
    - will decode actual obstacle hit later

- ✅ more raised obstacles
  - ℹ️ raising to wall height can cause flicker
  - ✅ 301
  - ✅ 101
  - ✅ 102
  - ✅ 302
  - ✅ 303

- ❌ minecraft model supports overlays
  - prefer to avoid "doubling" 168 triangle count
  - can directly mutate textures e.g. apply coat to body

- ✅ 6+ minecraft skins, avoiding default skins
  - ✅ [scientist-dabeyt](https://namemc.com/skin/7161dce64d6b12be)
    - maybe glasses via alternate head?
  - ✅ [scientist-4w4ny4](https://namemc.com/skin/a01f93c820b84892)
  - ✅ [soldier-_Markovka123_](https://namemc.com/skin/e0f2962a8ebf02b0)
  - ✅ [robot-vaccino](https://www.planetminecraft.com/skin/vaccino/)
  - ✅ [soldier-russia](https://namemc.com/skin/8597fe8d0b3248a0)
  - ✅ [soldier-darkleonard2](https://namemc.com/skin/702ae8d8d9492ef8)

- ✅ fix Viewer horizontal drag "initial jump" when Nav is open


- ✅ fix webp generation
  - ✅ on push generate webp and fail anything new detected
  - ✅ assets.js script ensures webp
  - ✅ assets.js script avoids recomputing webp
  - ✅ `assets-fast` avoids over-computation (sans `--staleMs={ms}`)
  - ✅ absorb `ensure-webp` into `assets-fast --prePush`
  - ✅ fix VSCode UI push node version
    - via `.bashrc`

- ✅ integrate TestCharacter into TestWorld
  - ℹ️ can use `currAnim.timeScale` to slow down animation to reflect detour speed
  - ℹ️ can use Blender to pull in alternate textures
  - ✅ api.npc.npc exists
  - ✅ implement `api.npc.spawn`
  - ❌ `<NPC>` exists and can show unanimated character
    - no hooks inside `<NPC>`
  - ✅ can connect terminal to world via `awaitWorld`
  - ℹ️ `api npc` takes non-trivial time to be non-null
    - can test `awaitWorld` or `api isReady` first
  - ✅ can spawn un-animated character via terminal
  - ✅ can see `npc` in terminal 
  - ✅ attach npcs directly to `<group/>` via js
    - tty command: `api npc.spawn '{ npcKey: "foo", point: {x:0, y:0} }'`
  - ✅ improve un-animated character spawn
  - ❌ api.npc.npc drives character render
  - ✅ api.npc.npc drives agents
  - ✅ merge character controller into `Npc`
  - ✅ characters are animated (Idle)
  - ✅ detect when stop walking (1st attempt)
  - ✅ characters are animated (Walk)
  - ✅ try fix `Npc` class HMR
  - ✅ fix jerky collisions
  - ✅ animation frame rate driven by agent speed
  - ✅ can run on cmd/ctrl/shift click
  - ✅ fix final turn
  - ✅ fix initial turn

- ✅ world api inputs should be Vector3Like (3d) not VectJson (2d) 

- ✅ obstacle right-click/long-press shows clicked type e.g. `bed`
  - ✅ clicked point -> unit XZ square -> sprite-sheet
  - ✅ clicked if respective pixel is non-transparent
  - ✅ meta enriched with respective obstacle's data
  - ✅ show data in ContextMenu

- ✅ remove `symId`

- ✅ on change `create-npc.js`, Idle NPCs should not lose their target `this.agent.raw.get_targetRef() === 0`
  - ✅ try moving crowdAgentParams elsewhere
  - ✅ HMR TestWorld should not reload navMesh
  - ✅ TestWorld invokes requestMovePosition for Idle NPCs too

- ✅ fix `expr 42 | say`
- ✅ fix contextmenu hide on long press pointerup over contextmenu
- ✅ try improve stopping animation by overshoot/stop-early
  - detect when only one corner left, change position, stop early
- ✅ try improve stopping animation via `this.api.crowd.raw.requestMoveVelocity`
  - this avoids using the "overshoot hack"
- ✅ migrate to `@recast-navigation/three@latest`
- ❌ try fix "target too close to border" by returning to overshoot hack
- ✅ try fix foot step on finish walk
  - ✅ try changing idle legs pose 
  - ✅ Idle, IdleLeftLead, IdleRightLead
  - ✅ On stop, choose animation via approach
- ✅ agent.teleport on reach target to suppress velocity

- ✅ sh/scripts.ts -> sh/functions.sh
  - ℹ️ currently HMR restarts session, but we only want function defs to be overridden
  - ✅ `<Terminal>` can receive new functions without restarting session
    - via `<WrappedTerminal>`
  - ✅ `source` code
  - ✅ store as /etc/functions.sh
  - ✅ migrate scripts from sh/scripts.sh
  - ✅ migrate a profile

- ✅ sh/raw-loader.js -> sh/{util,game}-generators.js
  - ✅ on HMR overwrite function defs
  - ✅ migrate remaining util generators
  - ✅ setup nodemon via js, somehow providing changed filenames as arg to script
  - ✅ create script `assets-nodemon.js` and npm script `watch-assets-new`
  - ✅ assets.js should use `changedFiles` arg
  - ✅ migrate from npm script `watch-assets`

- ✅ assets-nodemon.js avoids invoking `yarn`
- ✅ change hull doors back to original size

- ❌ turn down gl.toneMappingExposure, try brightening skin texture directly
- ✅ try 50% thinner arms/legs

- ✅ clean TestWorld restoreCrowdAgents
- ✅ replace TestNpcs demo with profile
  - henceforth will need TTY to start things up
- ✅ `~/PROFILE` keeps in-sync with `sh/src/profile1.sh`
  - can e.g. manually run `source PROFILE` after HMR update
- ✅ faster `awaitWorld`
  - now poll every 0.5s
- ✅ issue re-running `api npc.spawn` e.g. position, should idle
- ✅ `source PROFILE` issue finding process during `spawn`
  - seems `pid` is `ppid` is `8` which terminated during previous `source PROFILE`
  - was mutating leading process meta, because `source` did not recognise was being executed there

- ✅ TestWorld -> World etc.
- ✅ Put something else in game-functions.sh
- ✅ Move `api` from game-functions.sh -> game-generators.js


- ✅ create decor spritesheet
  - ℹ️ media/decor/* -> static/assets/decor.{png,webp}
  - ✅ basic door images
    - height `2m` (`80sgu`)
      - `x5` (png-scale-up) -> `400sgu` (can scale down for spritesheet)
    - ✅ hull door width `100 * worldScale` i.e. `2.5m`
      - `500 x 400 sgu` (width x height)
    - ✅ non-hull door width `220/5 * worldScale` i.e. `1.1m`
      - `220 x 400 sgu`
  - ✅ basic wall image
  - ✅ `assets.js` generates sprite-sheet json
  - ✅ `assets.js` generates sprite-sheet png/webp
  - ✅ `assets.js` sprite-sheet generation is `changedFiles` sensitive
    - skip other steps if only changedFiles are in media/decor
  - ❌ combine "create sheet and draw" into single function (decor/obstacle)
    - functions are quite complex, so keep them separate
  - ✅ avoid drawing sheets if nothing changed
  - ✅ avoid parsing maps if nothing changed
  - ✅ doors use uv map (hard-coded)
  - ❌ walls have uvs all pointing to basic wall image

- ✅ `yarn watch-assets` should auto-restart when it crashes (like `nodemon` did)
  - https://stackoverflow.com/a/697064/2917822

- ✅ support shell syntax `until false; do echo foo; sleep 1; done`

- ❌ get eslint working again e.g. for raw-loader.js
- ✅ start a new repo based on next js
  - ✅ https://github.com/rob-myers/npc-cli-next
  - ✅ get mdx working

- ✅ investigate slow down when npc walks towards/up-to edge
  - `nvel` changes
  - DT_CROWD_OBSTACLE_AVOIDANCE = 2
  - ✅ change ag->params.updateFlags to not intersect DT_CROWD_OBSTACLE_AVOIDANCE

- ✅ start writing first article
  - ℹ️ manually associate `Nav` items with pages (wait until next.js)
  - ✅ strip down "frontmatter" to `key`, with lookup for rest
  - ✅ migrate SideNote component
  - ✅ start writing index.mdx
  - ✅ intro should begin with "npcs controlled by user"

- ✅ fix decor sheet HMR
  - ✅ file decor.png gets updated
  - ✅ World gets updated
  - ✅ Doors texture should be right way up

- ✅ obstacle disappearing on decor sheet HMR
  - ✅ redo obstacles in `<Npcs>`
  - ✅ ensure obstacles re-added when nav-mesh updates


- ✅ try dark mode e.g. for better doors
  - ✅ dark standard door
  - ✅ dark hull door
  - ✅ can invert obstacles sprite-sheet
    - ❌ image magick `convert input.png -channel RGB -negate output.png`
    - ❌ in assets.js
    - ✅ in browser after load texture
  - ✅ lighter ceiling + minor clean
  - ✅ draw gm floors inside browser instead of assets.js
  - ✅ remove unused code from World/assets
  - ✅ x2 resolution floor
  - ✅ fix `World` break on comment out WallsAndDoors
  - ✅ api.gmClass -> api.{floor,ceiling}
    - ✅ move `debugNavPoly` into Debug and compute lazily
    - ✅ remove `layout`
    - ✅ merge into api.floor
    - ✅ merge into api.ceiling
  - ✅ draw grid on floor
  - ✅ fix "low fuel" via `y=1.01 wallsH=1`
  - ✅ move api.debug.navPoly -> api.derived.navPoly
  - ✅ ceiling flicker issues
    - can solve via fill = stroke
    - ✅ draw hull walls differently
  - ✅ try thicker ceiling tops via inset (avoid stroke going outside)
  - ✅ different ceiling shades e.g. bridge
    - ✅ can specify polygon outlines in SVG symbol
    - ✅ api.gmsData[gmKey].polyDecals
    - ✅ draw polyDecals in ceiling (fixing HMR)

- ✅ prevent coinciding doors (flicker)
  - ✅ non-hull: detect/discard during flatten symbols
  - ✅ separate WallsAndDoors
  - ✅ understand why doors open in the way they do (local)
    - hull normals face outwards
    - e/w open up, n/s open right
  - ✅ understand why doors open in the way they do (transformed)
    - hull normal still face outwards
    - aligned hull doors can open in different directions
  - ✅ ensure two doors do not coincide
  - ✅ use gmDoorKey format `g{gmId}d{doorId}`

- ✅ implement `click`
- ✅ test `click`
  - ✅ fix false positive
- ✅ "NPC click to select" should be a script
  - ✅ `click` detects npc clicks
  ```sh
  click | filter meta.npcKey |
    map '({meta},{home}) => { home.selectedNpcKey = meta.npcKey }'
  ```
- ✅ "NPC click to move" should be a script
  ```sh
  click | filter meta.navigable | walkTest
  ```
- ✅ "door click to open" should be a script
  ```sh
  click | filter meta.door | map '({meta},{world}) => {
    world.door.toggleDoor(meta.instanceId)
  }'
  ```
- ✅ add background processes to profile

- ✅ can detect/ignore rmb in `click`
  - ❌ forward `rmb` from event
  - ✅ `click --left` (only left, default) `click --right` (only right)
- ✅ click sees modifier key(s) so `walkTest` can run

- ✅ start new branch `use-decor`
- ✅ currently, async generator -> `run`, but what about async function -> `map`?
- ✅ consider naming: shell `api` vs world-level `api`
  - now using `w` for both World api and command

- ✅ clean pointer-events i.e. avoid code duplication

- ✅ decor pipeline based on *.svg
  - ℹ️ svg render will need to be supported by npm module `canvas`
  - ✅ create sprite-sheet using media/decor/*.svg
  - ✅ verify hmr works
  - ✅ key `foo.png` -> `foo`, and use separators `--`
  - ✅ try threshold promises for many svg -> contents -> image

- ✅ migrate `gmGraph.findRoomContaining`
  - ✅ begin migrating `gmGraph`
  - ✅ migrate gm grid
  - ✅ precompute navRects and connector.navRectId
    - connectors have `navRectId` i.e. index into "original navpoly" (pre recast/detour)
  - ✅ service/create-gms-data.js
  - ✅ fix roomGraph errors
    - compute `roomIds` for connectors (doors and windows)
  - ✅ create gmGraph: fix gmGraph errors
    - ✅ hull doors have e.g. `edge=n`
    - ✅ hull doors have navRectId > -1
  - ✅ migrate `api.geomorphs.hit` to `w.gmsData[gmKey].hitCtxt`
    - for fast room/door point-inclusion-test
  - ✅ fewer navRects: only 2 in the case of 102, otherwise only 1
    - 301 ✅ 302 ✅ 303 ✅ 101 ✅ 102 (4) ✅ 103 ✅
    - ✅ implement `decor ignore-nav`
  - ✅ gmGraph.findRoomContaining supports includeDoors
    - draw doors in hitTest canvas, behind rooms 
  - ✅ verify `gmGraph.findRoomContaining` works
    - `w gmGraph.findRoomContaining $( click 1 )`
    - `w gmGraph.findRoomContaining $( click 1 ) true`
    - ✅ fix gmId e.g. gm grid should be in meters
    - ✅ fix hitTest lookup
    - ✅ click is 3d, but `gmGraph.findRoomContaining` expects 2d
      - detect `z` and auto project to `(x, z)`
  - ✅ create gm-room-graph, with breathing space


- ✅ fix HMR for gms-data
  - ℹ️ a bit wasteful e.g. recomputing `w.gmsData` on HMR,
    i.e. could check whether `createGmsData` function has changed.

- ✅ synchronise data changes
  - ℹ️ i.e. geomorphs, mapKey, gms, gmsData, gmGraph, gmRoomGraph
  - ✅ verify HMR still working
    - ✅ map change
    - ✅ symbol change
    - ✅ gmsData change
      - needed to `await import('create-gms-data')` to get it working

- ✅ obstacles have `meta.roomId`
  - ✅ gm.obstacles[i].center
- ✅ initial decor has `meta.roomId`
  - ✅ gm.decor[i].meta

- ✅ decor `rect` -> decor `poly`
  - avoid angled rects for decor (only for Connector)
- ✅ decor.key -> decor.id (string)
  - avoid confusion with `decorKey`
- ✅ decorKey -> decorImgKey
- ✅ decor.id -> decor.key


- ✅ Decor component
  - ✅ `<Decor>` exists
  - ✅ clarify identifiers
    - decorImgKey points into decor sprite-sheet
    - decorKey (string) identifies instance
    - can remove prev via "grouping by gmId" etc.
    - decorKey not same as numeric instanceId (from instanced mesh)
  - ✅ migrate decor grid
  - ✅ decor points have fixed dimension bounds2d
    - maybe should depend on whether they have an associated icon i.e. decorKey
  - ✅ can specify decor `cuboid` in symbols
  - ✅ can see decor cuboids in World
    - ✅ `gms[gmId].decor` induces initial decor
    - ✅ can add cuboid to instancedmesh
    - ✅ can remove cuboid from instancedmesh
      - `w decor.removeDecor g0dec4`
  - ✅ cuboid shader with vertex-normal lighting?
    - https://github.com/mrdoob/three.js/tree/master/src/renderers/shaders/ShaderChunk
    - https://github.com/mrdoob/three.js/blob/master/src/renderers/shaders/ShaderLib/meshphong.glsl.js
    - ✅ try `diffuse * normal`
    - ✅ get "view aligned normals lightest" working
  - ✅ fix decor cuboids in transformed geomorphs
  - ✅ `decor.cuboids`, `decor.quads`
    - ❌ with managed holes, so don't have to recreate
    - ✅ with onPointer{Down,Up}
  - ✅ fix decor cuboid roomId
  - ✅ gmRoomId has `grKey` e.g. `g4r3`
  - ✅ simplify decorGrid i.e. `lookup[x][y]: Set<Decor>`
  - ✅ speed up decor initialization
  - ❌ smaller decor e.g. x1 instead of x5?
    - no, need the detail and don't want to "scale svg" in case uses bitmaps
  - ✅ reconsider decor types
    - ✅ add info icon to decor sprite-sheet
      - 100x100
    - ✅ `point` can have meta.img in `DecorImgKey`
    - ✅ `poly` can have meta.img in `DecorImgKey` 
      - when rotated rect 4-gon
  - ✅ decor points induce quads
  - ✅ all decor points _temp_ show decor info icon
  - ✅ fix HMR on change decor
    - world query was broken (wrong initial key)
    - also, now trigger Decor useEffect using query.status === 'success'
  - ✅ cuboid decor changes height with symbols e.g. d.center.y equals d.meta.y
  - ✅ `gm.decor[i]` has keys like instantiated
  - ✅ fix cuboid instantiation when angle non-zero
  - ✅ track instantiated decor new/changed/removed
    - track per-geomorph only (not per decor)
  - ✅ efficient decor re-instantiation
    - e.g. if map stays same and decor too, won't redo
  - ❌ try absorb Decor query into root query (avoid partial)
    - ℹ️ even if we merge into root query, have to mutate
      `w.decor` over time because `decorGrid` is too large,
      so cannot "apply changes synchronously"
  - ✅ prefer to apply root changes first
  - ✅ ensure decor of removed geomorphs is also removed
    - currently works when gmId ≤ next max gmId
  - ✅ world is not ready until decor ready
  - ✅ world can become "unready" onchange e.g. map, hmr
    - i.e. `w.isReady()` false when `w.decor.queryStatus` not success
  - ❌ wrap world in proxy, guarding by readiness
    - any invocation first await readiness
    - ℹ️ instead, expose API to permit higher-level approach
  - ✅ better decor point heights
  - ✅ move `w.setReady` into useHandleEvents
  - ✅ remove temp "all decor points shown with info icon"
    - ✅ can see labels (InstancedMesh) using decor.labelTex
    - ✅ permit spaces in labels via `label='foo bar'`
    - ✅ move labels from `gm.decors` into `gm.labels`
      - they won't be added to e.g. `w.decor.byKey`
    - ✅ ensure label UVs are updated
    - ✅ move w.labels -> w.decor.label
    - ✅ high-res labels
    - ✅ hide labels by default, show via `w update 'w => w.decor.showLabels = true'`
    - ✅ only show do/button points
  - ✅ rotate decor points according to `orient`
  - ✅ document on desk decor poly
    - ✅ document sprite (`icon--002--doc`)
    - ✅ add a `decor poly` with `img=icon--002--doc`
    - ✅ w.quads includes `decor poly`s
    - ✅ rotated rect 4-gon -> affine transform
      - need to know orientation of image
      - use "decor quad symbol" with axes pattern and dim 10x10
  - ✅ decor point induces quads
    - with fallback image `icon--001--info`
  - ✅ decor quad has fallback image
  - ✅ fix hmr on extend decor sprite-sheet
  - ✅ saw decor disappear when editing symbols
    - hopefully fixed by prevent query re-compute i.e. `retry: false`
  - ✅ fix decor point orient again (in transformed geomorph)
    - d.meta.orient -> d.orient for DecorPoint
  - ✅ decor cuboids can effect nav-mesh via tag `nav`
  - ✅ fix geomorph decor warns e.g. not fuel label not in any room
    - these were all labels, so fixed by moving them out of `w.decor.byKey`
  - ✅ can choose colour of decor cuboids
    - ✅ use InstancedMesh color attribute and forward to custom shader
    - ✅ forward `meta.color` to cuboid
  - ✅ can choose colour of decor quads
    - ✅ use InstancedMesh color attribute and forward to custom shader
    - ✅ forward `meta.color` to quad
  - ✅ change decorImgKey convention e.g. `icon--002--doc` -> `icon--doc`

- ✅ world provides "resolve when ready" api
- ✅ DecorQuad (not DecorPoly) derived from decor `<use>`
  - ✅ infer transform from 1x1 symbol
  - ✅ symbol instances apply to transform
  - ✅ use transform to position InstancedMesh instance
  - ✅ handle transform-origin


- ✅ fix sprite-sheet HMR
  - ℹ️ on add new symbol with obstacles
  - ℹ️ could fix with `yarn clean-assets && yarn assets-fast --all` + refresh
  - ℹ️ definitely data e.g.`geomorphs.json` or sprite-sheet, not program
  - ✅ could be problem with smart-sprite-sheet-update
  - ❌ could relate to adding symbol key to geomorph.js before we're ready?
  - ✅ visualise symbols graph i.e. media/graph/symbols-graph.dot
  - ❌ try repro with single geomorph
  - try fixing sprite-sheet size at 4096 x 4096 and see if re-occurs
  - 🤔 multiple websockets open in single browser tab?
  - ✅ saw issue onchange extant symbol i.e. remove some obstacles, add one symbol
    - ℹ️ this seems wrong 👉 `changedObstacles: Set(0)`
    - ✅ add `removedObstacles` and redraw sprite-sheet if non-empty
  - ✅ saw issue on WARN about mismatched size
    - `WARN medical-bed--006--1.6x3.6: extra--013--privacy-screen--1.5x0.2: unexpected symbol dimension`
  - ✅ saw out-of-sync, possibly Boxy SVG failed to save
  - ✅ saw issue on remove obstacle, then add back in
  - haven't seen any issues for a while, so closing

- ✅ remove `. ~/.bash_profile` from pre-push hook

- ✅ tty: `echo \'` should echo `'` (currently `\'`)
  - related to allowing single-quotes inside js (replace `'` -> `'\''`)
  - tryParseBuffer receives `["echo \\'"]` (which seems correct)
  - ✅ try interpreting Lit differently
- ✅ `SideNote` should wait a bit before showing
- tty should not render `NaN` as `null`
- `say` reading from tty should not terminate early when send a command before utterance finished
- ✅ `foo | map Array.from` failed because `Array.from` takes optional 2nd arg `mapFunc`
  - `map` recognises such cases does NOT pass `ctxt` inside `map` as 2nd argument
- ✅ fix `click 1` i.e. `click | ...` should not fire
- ✅ verify HMR which propagates from geomorphs.json -> gmsData


- ✅ fuel symbol can use single rect for wall
- ✅ thicker door ceiling tops
- ✅ `hull-wall` tag -> `wall hull`
- ✅ hull walls have `meta.hull` `true`
  - 🔔 cannot union with non-hull walls, api.derived.wallCount increased: `2625` to `2813`
- ✅ ContextMenu should work with ceiling
  - approach similar to obstacles
- support camera move via terminal
- improve doors hard-coding in decor sprite-sheet
- ✅ split component WallsAndDoors
- ✅ split component Surfaces
  - Obstacles
  - Floor
  - Ceiling
- ✅ animation from directly above looks weird e.g. arms should bend more
- ❌ TTY can get out of sync when edit cmd.service, tty.shell?
- ✅ can somehow ctrl-c `seq 100000000` (100 million)
  - same problem with `range 100000000`
  - same problem with `Array.from({ length: 100000000 })` (underlying JavaScript)

- ✅ migrate roomGraph per geomorph
- ✅ migrate gmRoomGraph
- ✅ migrate fast gmRoomId lookup via image pixels

- ✅ type worker.postMessage in main thread and worker
  - ✅ main thread
  - ✅ worker
- ✅ get web worker HMR "working"
  - ❌ https://github.com/webpack/webpack/issues/14722
  - ℹ️ gatsby does not support "webpack multi-compiler"
  - ✅ `useEffect` with worker.terminate suffices -- don't need react fast-refresh in worker
- ✅ changing props.mapKey should change map

- ✅ integer accuracy when parsing maps
  - Boxy has rounding errors e.g. when reflect
  - ℹ️ seems fixed after setting Boxy accuracy as maximum (attr + transform)
- ✅ fix case where `transform-box` is ~~`content-box`~~ or `fill-box`
  - https://boxy-svg.com/ideas/409/reset-transform-origin-points-svgz-export-option
  - ℹ️ seen in parseSymbol of hull symbol
  - ℹ️ fixed by updating sphere bounds
- ✅ smaller collapsed nav on mobile
- ✅ can press Escape/Enter to pause/unpause

- ✅ hull symbols should have same scale as non-hull symbols
  - ✅ resize-* 301 ✅ 302 ✅ 303 ✅ 101 ✅ 102 ✅ 103 ✅
  - ✅ careful about duplicating patterns i.e. only use `pattern-0`
  - ✅ replace files, whilst changing scaling i.e. always 1/5
  - ✅ issue with e.g. `<use width height transform="matrix(5, 0, 0, 5, x, y)">`
    - we used browser script (see `dev-info`) plus correctly manually
  - ✅ understand issue with obstacle sprite-sheet
    - 🔔🔔🔔 hull symbol image is scaled-up (unlike other symbols)
    - could add a scaled image, but might add to load time
- ❌ decor point bounds determined by original rect/poly

- ✅ start new branch `use-physics`
  - ✅ web worker with rapier
  - ✅ rapier has `stepWorld` function (untested)
  - ✅ rapier world has static colliders
    - request geomorphs.json and construct in worker
  - ✅ convert numeric ids into strings i.e. npcKey and gmDoorKey
  - ✅ rapier world has kinematic rigid bodies
    - ✅ spawn induces kinematic rigid body
    - ✅ remove npc removes kinematic rigid body
  - ✅ rapier world is stepped per-npcs-position update
    - don't bother trying to send "succinct array" (yet)
  - ✅ rapier triggers worker message on npc collide
  - ❌ could represent many doors as one rigid body e.g. per gm?
    - no need to try this
  - ✅ main thread sends numerical array(s)
    - ✅ do not detect agent vs agent collisions
      - seems already aren't being detected
    - ✅ method for assigning numerical ids to bodyKey/Meta
    - ✅ worker lookup restored on hmr
    - ❌ send array of npc uids which should go to sleep
      - rely on rapier to auto set bodies asleep
      - https://rapier.rs/docs/user_guides/bevy_plugin/rigid_bodies/#sleeping
  - ✅ clean

- ✅ doors open automatically when npc nearby
  - ✅ doors can be open/closed, locked/unlocked, manual/auto
  - ✅ doors can be sealed
  - ✅ track door -> nearby npcs
  - ✅ track npc -> door sensors e.g. for clean-up
  - ❌ toggle other hull door automatically
    - can open them individually
    - sensors already work
  - ✅ don't auto close door when npcs still within sensor range
  - ✅ clarify auto doors
    - ✅ do not auto-close when not auto
    - ✅ do not auto-open when not auto
  - ❌ manual doors are "blocked" inside nav query
    - we'll add physical switches for all doors, usable for manual
  - ✅ move worker handlers into WorldWorker
    - want handler edit to restart workers
  - ✅ clean

- ✅ tty: support recursive stringify of `Set` and `Map`
  - ✅ in tty.xterm output
  - ✅ `declare -x`
  - ✅ in shell expansion
  - ✅ separated shell function `pretty` into `pretty` and `json`
    - `pretty` is essentially `javascriptStringify` with indent 2
    - `json` is essentially `prettyCompact` and projects to JSON
      - e.g. does not support `Set`

- ✅ shell session: support restore Set and Map
  - ✅ serialize via `jsStringify` then re-evaluate
  - ✅ persist session on reset/unload
  - ✅ do not persist variable on run command (only on unload)

- ✅ service/npc -> service/helper
  - ℹ️ available runtime as w.lib.*
  - ℹ️ used by assets script
  - ✅ move key defs into helper
    - avoids totally rebuilding geomorphs.json
  - ✅ helper file should trigger watch script

- ✅ can pipe `w.events` into shell
  - ✅ define `events` in game-generators.js
  - ✅ better error messages on mvdan parse error

- ✅ fix restart while `events | map key`
  - ℹ️ pipe child terminated late, triggering pid 0 cleanups, cancelling next awaitWorld
  - ℹ️ due to pipe semantics i.e. 30ms delay "to permit child cleanup setup"
  - ℹ️ need some delay (setTimeout `0`) e.g. for `take 3 | true` to terminate immediately
  - seems to be fixed, but somewhat hacky

- ✅ start new branch `refine-doors`

- ✅ decor cuboid shader: flipped cuboid has wrong normal/colour
  - ✅ use decor-quad symbol instead (neater)
    - didn't fix problem though
  - ℹ️ no, normals are fine
    - issue also happens when we simply translate stateroom 036
  - ✅ possibly fixed via mvCameraPosition

- ✅ clean extractGeom into `extractDecorPoly` and `extractPoly`

- ✅ clean Decor
  - ✅ can specify decor point via symbol (infer direction)
    - ✅ pattern: single arrow
    - ✅ replace `orient={degrees}` in one symbol
    - ✅ replace `orient={degrees}` for all
  - ✅ simplify cuboid nav outset
  - ✅ decor poly -> decor rect
  - ✅ decor circle can use `<circle>`
    - ✅ add missing iris valves
    - ✅ iris value uses `<circle>`
  - ❌ decor rect uses symbol

- ✅ every door has 2 switches (inner, outer)
  - ✅ some symbol has two switches
  - ✅ can rotate decor quad so in XY plane via `tilt`
  - ✅ efficient computation of "post-rotation-matrix"
    - e.g. via caching
  - ✅ door switches format: `decor switch={symbolDoorId} inner`
    - ℹ️ decor quad because using decor quad symbol
    - ✅ `inner` optional; `y=1 tilt img=icon--square` implied
    - ✅ `switch` localDoorId -> doorId on instantiation
      - ✅ remove switches when "parent door" is identified
      - ✅ for identified doors, assume both switches are `inner`
      - ✅ remove switches when "parent door" is removed
  - ✅ add to hull doors
  - ✅ add to other hull symbol doors
    - 101 ✅ 102 ✅ 301 ✅ 302 ✅ bridge ✅
  - ✅ on remove doors and resp switches, adjust other switches
    - ✅ when doors coincide
    - ✅ when doors are manually removed
    - ✅ fix issue in 302
  - ✅ add to room symbol doors
    - cargo---010 ✅ empty-room 006 ✅ 020 ✅ 039 ✅
    - engineering--047 ✅ fresher--036 ✅ medical 007 ✅ 008 ✅
    - office 001 ✅ 004 ✅ 006 ✅ ...
    - empty-room ✅
    - fresher ✅
    - lab ✅
    - lifeboat ✅ medical ✅ cartography ✅
    - office up to 026 ✅ after 026 ✅
    - ships-locker ✅
    - stateroom ✅
  - ✅ add missing door switches in hull symbols
  - ✅ fix fresher-036 switches

  - ✅ pre-existing issue with gaps around top of doors
- ✅ fix nav-mesh on edge of 303
  - ✅ fixed computeDoorway
  - ✅ cleaner approach?
- ✅ LOD: when zoomed out a lot try making ceiling tops more solid
  - ✅ when far: fill but no stroke
  - ✅ when far: improve "large monochrome areas" e.g. lifeboat
    - tag svg symbols with `broad`
  - ✅ clean + fix HMR
    - seems MapControls onChange prop already supports hmr
  
- ✅ fix npc `way-point` event
  - ✅ event extends { ...current, next }
  - ✅ fires at final waypoint
  - ✅ doors have small wall above them
  - ✅ wall meta should have roomId
    - increase resolution of hitTest canvas
  - ✅ try extending `Walls` with two quads per door
    - i.e. two degenerate "one-segment-walls"
  - ✅ clean
  - ✅ locked indicator could go in center
    - ✅ render them inside `Doors`
    - ✅ green unlocked, red locked
    - ✅ setup initially locked doors
      - 101 ✅ 102 ✅ 103 ✅ 301 ✅ 302 ✅ 303 ✅
    - ✅ preserve locked flag via "door lookup by center"

- ✅ doors are specified as `auto`
  - ✅ temporarily set all doors `auto` 
  - 101 ✅ 102 ✅ 103 ✅ 301 ✅ 302 ✅ 303 ✅
  - ✅ unsealed hull doors implicitly `auto`
  - ✅ unsealed non-hull locked doors default to auto
    - we're setting "public" unlocked doors as auto
    - but e.g. unlocked fresher door inside locked room is not auto
  - ✅ implement "force-open" navigation while we implement navQuery
    - ✅ move door/npc logic outside Doors
    - ✅ move toggleDoor/toggleLock into w.s (shared)
    - ✅ w.s.toggle{Door,Lock} -> w.s.toggle
    - ℹ️ force-opening is distinct from having a key
    - ❌ toggle door opts.force
      - can already set opts.access undefined
    - ✅ npc.strategy 'default' or 'forced'
    - ✅ temp npc.strategy default to 'forced'
  - ✅ fix lock indicator for hull doors
  - ✅ w.s -> w.es
  - ✅ simplify w.es.toggle e.g. expects gdKey
  - ✅ w.es.toggle -> w.es.toggleDoor, w.es.toggleLock

- ✅ physics body keys `npc {npcKey}`, `nearby {gdKey}`
- ✅ physics body keys `inside {gdKey}`

- ✅ BUG onchange mapKey in Viewer
  - ℹ️ w.gmsData was being disposed before it could be used
  - ✅ physics.worker cannot read `world`
  - ✅ Walls/Doors not visible

- ✅ hash refactor
  - ✅ support w.hash[gmKey] and clean up
  - ✅ w.hash[gmKey].{full,nav,decor}
  - ✅ avoid recompute hash.images
  - ✅ can remove hash.images
    - sheets now contains imagesHash
  - ✅ move hash computations to browser
  - ✅ remove w.decor.computeHash
    - w.decor.hash points to last seen w.hash
  - ✅ use gmKey nav hash to avoid clearing npcToRoom
    - ✅ WorldWorkers has state.hash so can compare
    - ✅ send changed gmKeys
  - ℹ️ maybe can improve via murmur, but wait for timings via notifications

- ✅ import icons directly into Menu
  - rather than using `components/Icon`
- ✅ tty: avoid deleting paused line if user has typed something

- ✅ change way tabs are disabled/enabled
  - ✅ initially disabled tty shouldn't run profile
  - ✅ initially disabled World should be greyed out
  - ✅ while disabled, switching to an as-yet-unseen tab should mount it
    - believe this was already working

- ✅ tty: better disabled mount
  - we show message: "initially disabled"
- ✅ tty while disabled can ctrl-c sourced
  - tried sourced by adding `sleep 10` inside game-functions.sh
  - ✅ can pause/resume even when initially disabled
  - ✅ fix pause then resume while initially sourcing
  - ✅ cannot ctrl-c while initially paused
    - ℹ️ on hmr when paused (after resume) get blank tty, but works if resume tabs

- ✅ refactor Terminal without pause/resume
- ✅ refactor Terminal: add pause/resume
- ✅ on hmr `TerminalSession` unpaused tty should reboot
  - ✅ reset state.booted e.g. -> state.ts.booted
- understand error message on restart Tabs with running tty in background
- ✅ init paused:
  - ✅ tty should not run profile
  - ✅ runs profile on resume
  - ✅ cannot be ctrl-c'd
  - ✅ hmr `Terminal` preserves "single line shown"
  - ✅ hmr `TerminalSession` should render `Terminal`
  - ✅ can enter/esc while init paused

- ✅ fix hmr onchange tty.shell while paused (init or not)

- ✅ svg tag `switch={doorId}` -> `switch` and rely upon relative order to doors
  - we convert `meta.switch` into a number during parse

- ✅ can ctrl-c profile while tty paused (not init)
- ✅ fix: do not unpause on ctrl-c while paused
  - this means we cannot start initially paused via enter

- ❌ try merge TtyWithEtc into Tty
- ✅ TtyWithEtc -> TtyWithFunctions simplify forwards props.functionFiles

- ✅ can use terminal whilst paused
  - ✅ can start typing
  - ✅ can ctrl-c out of running process

- ✅ BUG ctrl-c of `echo 'foo\r\n`
  - wrong prompt shown after ctrl-c
- ✅ World pauses in background
  - e.g. try `w npc.npc.rob.moveTo '{x:-6.43,y:0,z:7.3}'`
  - could potentially permit "pause override" in future (e.g. pause one World, not other)
- ✅ BUG scrolling back through history of `echo 'foo\r\n\r\n'` loses a newline
  - happens when scroll back just beyond it

- ✅ Tty: resize-clear-input should also blur xterm

- ❌ pause tty ui issues
  - ℹ️ on switch tab, terminal pauses, and when come back, unclear whether should just continue
  - ℹ️ on continue using terminal when paused, enter can immediately launch unseen command
  - ❌ link choice instead: [ unpause ] or [ debug ]
  - ℹ️ decided on overlay instead

- ✅ World: "enable all" and "debug" overlay
- ✅ Tty: "enable all" and "debug" overlay
  - ✅ overlay fader and buttons
  - ✅ clean away other approach
  - ✅ avoid props.onKey from triggering resize

- ❌ "enable all" is highlighted when hover fader
  - instead, it is always highlighted whilst paused

- ✅ optionally permit camera movement while World paused 
  - ✅ pause/play toggle in viewer controls
  - ✅ remove fader from Tabs
  - ✅ add fader to World
  - ✅ can initially enable via click anywhere
  - ✅ on disable World fades by default; click anywhere to unpause
  - ✅ World has camera icon
  - ✅ can move camera when clicked

- ✅ fire event when npc enters/exits a room
  - ✅ sensor in each doorway, triggered on leave
    e.g. `inside g1d3` vs `nearby g1d3`
  - ✅ update npcToRoom
  - ✅ fix entered-room triggering
    - ℹ️ seen "npc position" not in room when running through hull door
    - possibly exasperated by collider near g0d0?
  - ✅ enter-room ✅ exit-room ✅ enter-doorway ✅ exit-doorway ✅ enter-sensor ✅ exit-sensor ✅
  - ✅ on reload nav.worker, recompute w.es.npcToRoom
    - ❌ clear lookup, except for unchanged gmKeys
    - ❌ lazily compute e.g. `w.es.getNpcRoom('rob')`
    - ℹ️ expect dev to handle this e.g. be in debug mode World/Tty
    - ✅ recompute over time; if not in room set undefined and warn
    - ✅ witness re-computation, and npc outside all rooms
  - ✅ roomToNpcs[gmId][roomId] i.e. inverse of npcToRoom

- ✅ xterm.js selection bug with gold text
  - needed to upgrade to `@xterm/xterm`
- ✅ hmr: support gm-graph
  - can ignore gm-room-graph because shouldn't really change,
    i.e. any "related" methods should inside gm-graph instead
- ✅ hmr issue editing obstacle outline
  - seems fixed by always re-generating obstacle texture, irrespective of size change

- ✅ on reload physics.worker, clear w.es.{npc,door}ToNearby
- ❌ `nav-changed` event for code supporting level-editing
  - ℹ️ dev should pause World while editing nav
  - ℹ️ in 2-player, changing levels shouldn't depend on this event

- ❌ npc move strategy dictates different navQuery
  - ❌ `anywhere`: no restriction (except sealed)
    - ✅ only open non-auto if (a) about to go through, or (b) would intersect
    - ❌ fix case where already nearby then move into/thru doorway
  - ❌ `adjacent`: can only nav to adjacent rooms
    - ❌ prevent nav through locked/closed-non-auto doors via "enter inside"
  - `accessible`:
    - block non-auto closed doors (including locked)
    - block locked auto doors

- ✅ refactor `npc.s.permitNav` i.e. support only one "move strategy"
- ℹ️ "all access" (e.g. `/./`) replaces `anywhere`
- ✅ refactor access keys as regexs
- ✅ remove `npc.s.permitNav`
- ✅ w.e.moveNpc(npcKey, point)
- ✅ assuming all access
  - ✅ fix move into doorway when already nearby
  - ✅ fix move through doorway when already nearby
- ✅ npc move should also work when lack access to door
- ✅ no-access npc should not stop when going through auto door
- ✅ can avoid checking each corner if no intersect and further away
- ℹ️ no-access npc stops early when onEnterSensor
- ✅ clean

- ✅ locked doors should close when
  - ✅ nothing `inside` and no `nearby` npc moving
  - ✅ trigger check when nearby npc stops (currently only on exit nearby sensor)

- ✅ fix bug: cannot close door when npc nearby

- ✅ BUG: tty: xterm paste (fails when line is single newline)
  - pasted newlines are normalized as `\r`: https://github.com/xtermjs/xterm.js/issues/1382#issuecomment-380309962
```sh
# repro
w gms | split | flatMap 'x => x.rooms' | map '({ center }, { w }, i) => {

}'
```
- ✅ BUG: tty: xterm paste then historical up (cursor in wrong place)
  - changed pasting behaviour i.e. previously we ran each line upon encountering newline,
    but now we just insert into to input
- ✅ BUG tty: xterm: cursor should skip over \r (now we normalize as \r\n)

- ✅ BUG: tty: xterm delete from end (moves one line down)
  - commented out "Right-edge detection" in `setInput`
```sh
# repros
echo 'foo {
}'
echo 'bar {

}'
```

- ✅ Support SVG symbol syntax `y=wallHeight`

- ✅ `take n` exits with non-zero code when doesn't take everything
  - so this terminates `{ echo foo; echo bar; } | while take 1 >tmp; do echo $tmp; done`
  - ✅ BUG `seq 5 | while take 1 >pos; do pos; done`
    - seems we cannot handle chunks using this method

- ❌ BUG tty: xterm: delete inside multiline command
  - repro didn't work
```sh
# repro by deleting from !")👈
call '() => {
  console.log("Wowsers!")
}'
```

- ✅ measure ~200 npcs FPS with current setup
  - ℹ️ 120 FPS with 177 without agent
  - ℹ️ 120 FPS with 177 with agent
```sh
# 177 npcs
w gms | split | flatMap 'x => x.rooms' | reduce '(sum, x) => sum + 1' 0

run '({ w, api }) {
  for (const [gmId, gm] of w.gms.entries()) {
    for (const [roomId, { center }] of gm.rooms.entries()) {
      try {
        console.log({gmId, roomId});
        gm.matrix.transformPoint(center);
        await w.npc.spawn({
          npcKey: `room-npc-${gmId}-${roomId}`,
          point: { x: center.x, y: 0, z: center.y },
          agent: true,
        });
      } catch {}
      await api.sleep(0.05);
    }
  }
}'
```

- ✅ investigate GPU object picking via 2 render targets written to by 1 fragment shader
  - ℹ️ PR where render targets first added to three.js:
    > https://github.com/mrdoob/three.js/pull/16390
  - ℹ️ can provide vertex indices via attribute, hence instanceId too
    > e.g. https://discourse.threejs.org/t/how-do-i-get-the-vertex-data-from-my-position-attribute-into-a-shader-with-a-datatexture/52041
  - ℹ️ https://github.com/mrdoob/three.js/blob/master/examples/webgl_interactive_cubes_gpu.html
  - ℹ️ Asked question https://discourse.threejs.org/t/is-gpu-object-picking-possible-with-a-single-render/70228
    - if we use a single shader with 2 outputs, seems we need a render target with 2 textures,
      and our "main scene" would be a full-screen quad, which breaks r3f pointer events
  - ℹ️ could re-use main scene as "picking scene" with different picking materials,
    - https://github.com/bzztbomb/three_js_gpu_picking/blob/main/src/gpupicker.js
    - need to extend approach to support instancedmesh e.g. via extra attribute
    - could avoid different shaders via boolean uniform

- ✅ towards gpu object picking: get walls working
  - ✅ Walls shader has own monochrome shader
  - ✅ Walls shader has boolean uniform `objectPicking` and behaves differently based on it
  - ✅ Walls shader has `gmId` attribute
  - ✅ Walls shader has `wallSegId` attribute
  - ✅ decode clicked pixel when shader turned on
  - ✅ fix hull wall z-fighting
    - ℹ️ object-picking issue (not visually where every wall black)
    - ❌ could omit/set-height-0 "outer overlapping walls"
      - too complex
    - ✅ manually inset outer hull walls slightly  
  - ✅ async read pixel
  - ✅ tidy: still running atm, will extend bit-by-bit
  - ℹ️ rgba is `(1, gmId, ((wallSegId >> 8) & 255)/255, (wallSegId & 255)/255)`

- ✅ add perf logging
  - ✅ assets.js timings
  - ✅ World has pin-able textarea
  - ✅ start writing logs from `World`

- ✅ fix "flipped decor" i.e. if decor quad transform determinant is negative,
  - flip the quad's uvs across "central vertical axis"

- ✅ can dynamically add to label sprite-sheet
  - ℹ️ `w update 'w => w.decor.showLabels = true'`
  - ✅ move `w.decor.label.quad` to `w.decor.labelQuad`
  - ✅ move `w.decor.{label,ensureLabelSheet}` to `w.label`
  - ❌ can incrementally extend
    - doesn't necessarily keep previous rects in same position
    - so, decor label uvs need to be recomputed
  - ✅ two label textures i.e. decor, npc (dynamic)
    - ✅ w.label -> w.decor.label
    - ✅ w.label -> w.npc.label
    - ✅ w.npc.updateLabels(["foo", "bar", "baz"])

- ✅ WorldMenu log should be a partially transparent xterm
  - ❌ use `BaseTty` but readonly
  - ✅ use vanilla `@xterm/xterm` Terminal i.e. `Logger`
  - ✅ clean up


- ✅ first draft of "hyper casual" characters
  - instead of pseudo minecraft character
  - https://assetstore.unity.com/packages/3d/characters/hyper-casual-low-poly-simple-people-175599
  - based on these models e.g. 3 bones: body > head, shadow
  - ✅ unity: create project with imported assets
  - ✅ blender: import exported fbx as static model
  - ℹ️ investigate mesh
    - tris: base_body 280 (head 140, body 140)
    - tris: hair_man 172, cap 128, hair_woman 278, hair_pony 256, knit_hat 144
    - no texture map
  - ℹ️ mesh spec (1st attempt)
    - body: cuboid with split 0.34 * h from base, and another at 0.7 * h inset by 0.185 * w
      - width = depth = 200 (arbitrary units), height 230 (or 245 with top curve)
    - head: cylinder with 3 * 4 sides
      - width = depth = 200 (radius), height 125 (or 170 with curves)
  - ✅ 1st attempt at character
    - facing along negative Y
    - head: 12-side cylinder + bevel modifier
    - body: cuboid (x2 vert split, tapered towards head) + bevel modifier
    - needs shadow too
  - ℹ️ blender:
    - set pivot mode in top menu e.g. as 3d cursor
    - absolute positions: N to toggle
  - ℹ️ blender edit mode:
    - Cmd+R loop cut
    - Option+Click edge for edge loop
  - ✅ texture mapping
    - ✅ UV > mark seams, unwrap
    - ✅ export UV map as SVG and import to Boxy SVG
      - try provide strong outline for body
      - try provide strong outline for face
    - ✅ add new material to mesh (e.g. in shader view)
      - add Texture > Image Texture
      - export Boxy SVG as PNG, as use as image
  - ✅ test import into World
    ```sh
    w debug.char.add
    w debug.char.remove 0
    w debug.char.remove
    # update skin without full page refresh
    w debug.char.setSkin 0
    ```
  - ✅ try inverted colours
  - ✅ improve drop shadow
    - fix transparency by setting floor renderOrder `-1`
  - ✅ should be higher off ground but still ~1.5m total
  - ✅ can reload texture without hard-refresh
  - ✅ try get CameraLightMaterial working
    -  try debug via `<mesh>` instead of `<primitive>`
  - ✅ cleanup media/3d
    - media/npc-old (minecraft)
    - media/npc (ongoing)
  - ✅ cleanup static/assets/3d and related to jsx
    - do not delete minecraft-skins until complete character migration
  - ✅ auto-update test character onchange SVG
    - ✅ media/npc/{x}.tex.svg to static/assets/3d/{x}.tex.png
    - ✅ TestCharacters reads a tex.png
    - ✅ auto update character skin
      - expose hash and `w.debug.char.setSkin(i)`
  - ✅ CameraLightMaterial should support texture map
  - ✅ `w.debug.testChar` --> `w.debug.char`
  - ✅ make cuboid model
    - ℹ️ uv cube: follow active quads > even, then unwrap (?)
    - ℹ️ uv map cube first, before deform scale
    - ℹ️ cuboid-{character,mesh,material}
    - cuboid: head ✅ body ✅
    - quad: shadow (ground) ✅ ring (ground) ✅ label (above) ✅ icon (above) ✅
    - ✅ basic skin i.e. eyes

- ✅ return to next.js project
  - ✅ ensure up to date
  - ✅ work on migrating Root
    - ✅ Main, Nav
    - ✅ Viewer

- ✅ migrate sub-symbols to actual symbols
  - 301 ✅ 302 ✅ 303 ✅ 101 ✅ 102 ✅
  - bridge ✅ lifeboat ✅
  - beds ✅ consoles ✅
  - counter ✅ engineering ✅ extra ✅ fresher ✅ lab ✅ medical ✅ cartography ✅ shop ✅ stateroom ✅ table ✅
  - ✅ remaining:
    - ✅ office--023--2x3
    - ✅ office--061--3x4
    - ✅ office--074--4x4

- ✅ integrate cuboid model
  - ✅ import model into npc-cli TestCharacters
    - ✅ export as cuboid-model.glb
    - ✅ configure TestCharacters for "multiple character meta"
    ```sh
    w debug.char.add $( click 1 ) hcTest
    w debug.char.add $( click 1 ) cuboidChar
    ```
  - ✅ model shader handles label/icon properly
    - ✅ dup cameraLightShader as testCharacterShader sans instancing
    - ✅ identify label/icon quad via attribute/shader (?)
      - ℹ️ vertex ids ≥ 56 (out of 64)
    - ✅ render as sprite i.e. always face camera
      - ℹ️ centre label quad in model (about XZ blender coords)
      - ℹ️ use shader to draw "above" npc
      - ✅ label has transparency
      - ✅ fix label normal, return to cuboid-character.glb
    - ❌ icon quad "normal" and double-sided
      - removed icon quad
  - ✅ improve cuboid model/skin
    - ✅ selector has smaller radius
    - ❌ label text has outline
    - ✅ shadow circular
    - ✅ fix body uv-map
      - ✅ boxy SVG: sketch out more efficient uv-map (0.4 cuboid head, 0.4 * 1 * 1 body)
      - ℹ️ cannot avoid dup vertices: 8 + (3 * 16) = 60
        - https://stackoverflow.com/a/76713671/2917822
      - ✅ redo uv-map using above as guide
    - ✅ change vertex ordering: head < body < selector < shadow < label
      - ℹ️ head < body < selector < shadow < label
        - 60 vertices in total (after 3 * - for cuboid vertices)
        - `head` 3 * 8 [0, 23] < `body` 3 * 8 [24, 47] < `selector` 4 [48, 51] * < `shadow` 4 [52, 55] < `label` 4 [56, 59]
      - ✅ selector < shadow < label via: `p` (key), select in "right-order", re-join (object > join)
    - ✅ head < body < shadow < selector < label
    - ✅ body has icon
      - ℹ️ boxy: cmd+shift to scale uniformly to center 
      - ✅ center-front quad: head < body < shadow < selector < front-icon < label
    - ✅ can toggle selector/label
      - uniforms showSelector, showLabel
    - ✅ can change selector color
    - ✅ label higher so doesn't come through walls?
    - ✅ selector intersection problem
      - ✅ discard alpha < 0.1
      - ✅ higher, so drop shadow always beneath
  - ✅ control vertex ids in Blender
  - ❌ avoid 2 SVGs if possible i.e. uv-bg, tex
    - keep them separate e.g. can label "B-F" for body front
  - ✅ various different icons in character sprite-sheet
    - ℹ️ more in e.g. decor sprite-sheet

- ✅ bug: tty: `map 'x => 2 ** x'` then press delete
  - ✅ also when type 1 char then delete 1st char
- ✅ avoid logging navmesh creation message

- ✅ extend chair/table symbols with chair/table tag on obstacle

- ✅ merge {enter,exit}-sensor into {enter,exit}-collider

- ✅ support non-door sensor i.e. decor circle/rect
  - ✅ can manually add:
    ```sh
    w physics.worker.postMessage '{
      type: "add-colliders",
      colliders: [{
        type: "rect", width: 1.5, height: 1.5, x: 3, y: 7.5,
        colliderKey: "myTestCollider",
      }],
    }'
    ```
  - ✅ can detect collisions: `{npcKey: 'rob', otherKey: 'rect myTestCollider'}`
  - ✅ trigger events `enter-collider` and `exit-collider`
  - ✅ can remove
    ```sh
    w physics.worker.postMessage '{
      type: "remove-bodies",
      bodyKeys: ["rect myTestCollider"],
    }'
    w physics.worker.postMessage '{
      type: "remove-colliders",
      colliders: [{ type: "rect", colliderKey: "myTestCollider"}],
    }'
    ```
  - 🚧 decor circle/rect tagged `collider` induce colliders
    - ℹ️ decor key e.g. `rect[-21,0_01,30]` with meta.gmId and meta.collider
    - ✅ can provide `userData` in "add-colliders"
    - ✅ event `{ key: "gm-decor", type: 'updated', gmId }`
    - ✅ event `{ key: "gm-decor", type: 'removed-all' }`
    - ✅ simplify events i.e. only send one:
      - `{ key: "updated-gm-decor", type: "partial", gmIds }`
      - `{ key: "updated-gm-decor", type: "all" }`
        - clean not necessary, because world recreated?
    - ✅ events forwarded to physics worker
    - ✅ onchange decor rect (add meta.collider)
      - ✅ decor queryKey changed
      - ✅ "updated-gm-decor" emitted
      - ✅ `w.hash.gmHashes` -> `w.hash.mapGmHashes`
      - ✅ fix `{key:"updated-gm-decor",type:"partial",gmIds:[0,1,2,3,4,5,6,7]}` when only 301 changed
    - ❌ physics worker receives message
      - ℹ️ sending too early i.e. worker is being reset?
    - ✅ on reset worker world physics includes gm-decor
      - ℹ️ no need to forward event `updated-gm-decor`
      - ℹ️ wasteful i.e. could partially rebuild physics
    - ❌ events trigger:
      - removal of previous physics bodies with userData.{instanced,gmId}
      - creation of physics bodies with userData.{instanced,gmId}
  - ✅ support angled rect
    - ✅ can specify in `add-colliders`
    - ✅ can handle angled gm-decor rect
  - ✅ simplify add-colliders message
    - ✅ `rect` or `circle` rather than `cuboid` or `cylinder`
    - ✅ reformat
  - ✅ can remove-colliders
    - e.g. no need to specify bodyKey 
  - ✅ bug: remove collider while colliding
  

- ✅ character animation: idle
  - ✅ add skeleton: hips.bone -> head.bone, shadow.bone
  - ✅ import SkinnedMesh
    - ℹ️ blender: select armature + mesh, ctrl + p, with automatic weights
    - ℹ️ blender: weight paint mode (sibling of edit/object/pose)
    - ℹ️ blender: K for keyframe
    - ✅ seems we need an animation first
    - ✅ parent armature + weight paint
  - ✅ bug: blender: gltf export deforms original file (fixable by undoing rotateX)
    - upgraded to blender 4.2 (didn't fix)
    - removed other mesh/armature (didn't fix)
    - removed/added armature (seemed to work)
  - ✅ saw gltf export bug again
    - ℹ️ it was probably due to various "Fake User" animations from deleted armature/meshes
    - ✅ move root bone down to origin
    - ✅ added a keyframe to "Idle" (must do this)
  - ✅ `<mesh>` -> `<skinnedMesh>`
    - ✅ Idle animation is imported
  - ✅ fix frustum culling
    - ✅ compute bounding{Box,Sphere} (did not fix)
    - ✅ temp set frustumCulling false on `<skinnedMesh>`
    - ℹ️ works when use `<primitive>`
    - ✅ try gltf to jsx i.e. add bones
  - ✅ idle animation (1st attempt)
    - ℹ️ blender: graph editor: vertical scale: ctrl + scroll
    - ℹ️ blender: graph editor: interpolation: t
    - ✅ support breathing via root bone scale
      - head_bone: Bone > Relations > Inherit Scale: `None`
    - ✅ create basic idle animation
    - ✅ works with `<meshPhysicalMaterial>`
    - ✅ works with our custom shader
      - https://ycw.github.io/three-shaderlib-skim/dist/#/latest/physical/vertex
      - ✅ probably need skinning_*
      - ✅ fix scaling
    - ✅ clean up
  - ✅ fix initial animation start
  - 🚧 improved idle animation
    - ℹ️ blender: next/prev keyframe: up/down
    - ℹ️ blender: slow down animation:
      - Scene > Output > Time Stretching > 100, 600
      - Given 24 frames (Start=0, End=22), End := 23 * 6 - 1 = 137
    - ℹ️ blender: scale frames by shifting to 1 and setting 1 as current frame
    - ℹ️ blender: center: shift + c
    - ✅ smaller sway
    - ✅ breathing
    - ✅ shadow motion
    - ✅ head motion
      - already some via breathing (scale hips along z)
      - basic head nod

- ✅ parse "uv-map folder" from *.tex.svg
- ✅ [0, 1] * [0, 1] rect lookup:
  - `assets.sheet.skins.uvMap[npcClassKey][uvRectName]`
  - `geomorphs.sheet.skins.uvMap[npcClassKey][uvRectName]`
- ✅ svgBaseName -> npcClassKey
  - e.g. `cuboid-man.tex.svg` -> `cuboid-man`

- ✅ cuboid-man improvements
  - ✅ can set label height
  - ✅ smaller shadow
  - ✅ create some npcs labels
    ```sh
    w npc.updateLabels rob kate will
    w npc.label.tex.image.toDataURL | log
    ```
  - ✅ re-map `ui-label` to something in npc labels tex
    - ℹ️ `w geomorphs.sheet.skins.uvMap.cuboid-man`
    - ✅ can modify label width in shader
      - `mvPosition.x = vId == 61 || vId == 63 ? mvPosition.x - 0.5 : mvPosition.x + 0.5;`
    - ✅ read npc texture from array of textures
    - ✅ understand final 2 tris ~ label quad
      - https://threejs.org/docs/?q=bufferge#api/en/core/BufferGeometry.index
      ```sh
      # ℹ️ final 2 triangles of npc geometry
      w debug.npc.npc.npc-0.mesh.geometry.index
      w debug.npc.npc.npc-0.mesh.geometry.index.toJSON
      w debug.npc.npc.npc-0.mesh.geometry.index.toJSON | map array
      # length 96 i.e. 32 triangles
      # i.e. (6 * 2) + (6 * 2) + (4 * 2)
      # final two triangles: 60,61,63,60,63,62

      # ℹ️ uv rect of final quad ~ final 2 triangles
      w debug.npc.npc.npc-0.mesh.geometry.attributes | keys
      w debug.npc.npc.npc-0.mesh.geometry.attributes.uv.toJSON | map array
      # length 128 i.e. 64 vertices and 2 coords per vertex
      w debug.npc.npc.npc-0.mesh.geometry.attributes.uv.toJSON | map 'x => x.array.slice(-8)'
      # [0.6499999761581421,5.960464477539063e-8,0.15000002086162567,0,0.6499999761581421,0.12500005960464478,0.15000000596046448,0.125]

      w geomorphs.sheet.skins.uvMap.cuboid-man | keys
      w geomorphs.sheet.skins.uvMap.cuboid-man.ui-label
      # {x:0.15,y:0,width:0.5,height:0.125}
      ```
      - ✅ get vIds, get corresponding UVs
        - vIds: [60,61,62,63]
        - UVs (modulo precision): [0.65, 0, 0.15, 0, 0.65, 0.125, 0.15, 0.125]
      - ✅ compare to label uvRect
        - corresponds to rect
    - ℹ️ cannot edit geometry attributes because shared
    - ✅ uv map into 2nd texture
      - ℹ️ https://stackoverflow.com/questions/48503775/storing-data-as-a-texture-for-use-in-vertex-shader-for-instanced-geometry-three
      - ℹ️ https://codepen.io/prisoner849/pen/WNQNdpv?editors=0010
      - ✅ encode existing uvs as DataTexture and read using vertex id
      - ✅ encode texture id too
      - ℹ️ no need for DataTexture
        - use uniforms for face/icon/label instead
        - `uniform int uLabelTexId` (which texture to use)
        - `uniform vec2 uLabelUv[4]` (4 for quad)
      - ✅ pre-compute ±0.5 uv coords for label quad
        ```sh
        w debug.npc.add $( click 1 )
        w debug.npc.testQuadMeta.cuboid-man
        ```
      - ✅ relative to npcClassKey
      - ✅ setup uniforms for label quad, and use them
        - ℹ️ `w geomorphs.sheet.skins.uvMap.cuboid-man.ui-label`
        - ✅ resize default label
        - ✅ use uvs from uniforms for label
        - ✅ can change label
        - ❌ fix label by center-ing uvRect inside geometry rect
        - ❌ npc.label always has a fallback label we point to
        - ✅ default label comes from base skin
        - ✅ can set width/height of label by changing geometry of quad
        - ✅ auto choose width/height for better custom labels
        ```sh
        w debug.npc.add $( click 1 ) rob
        w debug.npc.add $( click 1 ) kate

        w npc.updateLabels rob kate will a-really-long-name
        w npc.label.tex.image.toDataURL | log
        w npc.label.lookup.rob

        w debug.npc.changeUvQuad rob '{ label: "rob" }'
        w debug.npc.changeUvQuad kate '{ label: "kate" }'

        w debug.npc.changeUvQuad kate '{ label: "a-really-long-name" }'
        ```
      - ✅ cleanup

  - ✅ can change label
      - ℹ️ `w npc.updateLabels rob kate will a-really-long-label`
      - ℹ️ `w debug.npc.changeUvQuad npc-0 '{ label: "a-really-long-label" }'`
  - ✅ can change icon/face
    - ✅ feed in uniforms
    - ✅ get alt face uv rect
      - `w geomorphs.sheet.skins.uvMap.cuboid-man.front-face-angry`
    - ✅ get alt icon uv rect
      - `w geomorphs.sheet.skins.uvMap.cuboid-man.front-label-food`
    -  ✅ can change face
      - ✅ `w.geomorphs.sheet.skins.uvMapDim`
      - ✅ augment shader
      - ℹ️ `w debug.npc.changeUvQuad npc-0 '{ face: ["cuboid-man", "front-face-angry"] }'`
    -  ✅ can change icon
      - ℹ️ `w debug.npc.changeUvQuad npc-0 '{ icon: ["cuboid-man", "front-label-food"] }'`
    - ✅ cleanup

- ✅ cuboid-pet improvements
  - ✅ smaller, with head in front of body
  - ✅ fix shadow
  - ✅ smaller head

- ✅ prepare for migration into `<NPCs>`
  - ✅ convert minecraft mesh into jsx format
  - ℹ️ refs get called often if use inline function,
      - use e.g. `ref={state.foo}` instead
      - https://legacy.reactjs.org/docs/refs-and-the-dom.html#caveats-with-callback-refs
  - ✅ fix `<NPCs>` hmr
  - ✅ remove nav-obstacles (not needed)
  - ✅ clean e.g. spawn
    - ✅ npc.onMount does
      - ✅ npc.startAnimation('Idle')
      - ✅ initializes position/angle of npc sans agent
      - ✅ on add agent pins it to current position
    - ❌ w.npc.npcRef invokes npc.onMount, so can avoid invoke on HMR
    - ✅ npc.onMount does minimal setup, instead invoking npc.resolve to continue npc.spawn
  - ✅ use React.memo with epochMs override
  - ✅ rename `cuboidChar` -> `cuboid-man`
  - ✅ replace `hcTest` with another cuboid character i.e. `cuboid-pet`
  - ✅ debug npc respawn should not stop animation
  - ✅ animation: walk
    - ✅ try sway with almost upright head
  
- ✅ bug: tabs: un-maximise tty can resume World while tty stays paused
  - ℹ️ unpaused, maximise tty, pause, un-maximise
- ✅ bug: initially open hull door via spawn does not close
  - seems fixed by npc.spawn cleanup

- ✅ fix blurred curved table in 303
  - ✅ extra--020--table-2x0.66
  - ✅ add placeholder symbol to 303

- ✅ fix symbols in 303 i.e. definitions should have correct size

- ✅ uv-map for label seems wrong i.e. should cover 256 * 128
  - 🔔 seems npm module `canvas` does not support scaled text properly
    when `saveCanvasAsFile`, so change text size instead

- ✅ bug: permitted npc going thru closed door
  - ❌ `state.isUpcomingDoor(npc, door)` is false when should be true
  - ℹ️ 301 npc starts near closed door of office, click adjacent stateroom
    - even worse when another npc is in the way
  - ❌ try smaller nearby sensor 0.9 * x
  - ✅ fallback: open on trigger "inside" sensor
  - ✅ try cuboid "nearby" sensor
  - ℹ️ still happens i.e. door opens at last moment, but will suffice for the moment

- ✅ can debug physics colliders
  - ✅ connect `Debug` to physic.worker
  - ✅ refine userData type: `WW.PhysicsUserData`
  - ✅ can render `nearby` colliders in Debug
  - ✅ can render `inside` colliders in Debug
    - maybe fixed issue with untransformed nearby door `angle` in physics.worker
  - ✅ UserData has type i.e. npc, cuboid or cylinder
  - ✅ can render custom colliders in Debug
  - ✅ can then remove outlines from Floor

- ✅ migrate cuboid-man into `<NPCs>`
  - ℹ️ leave `<TestNpcs>` as is
  - ✅ classKeyToMeta -> const npcClassToMeta
    - NPC.ClassKey
    - NPC.ClassDef
  - ✅ classKeyToGltf -> npc.class[classKey].gltf
  - ✅ service/uv.js
    - ✅ quadMeta -> cmUvService.toQuadMetas
    - ✅ cloneUvQuadInstance ✅ instantiateUvDeltas ✅ changeUvQuad
    - ✅ quad -> npc.s.quad
  - ✅ changeUvQuad infers texId
  - ✅ replace minecraft models with cuboid-man
  - ✅ remove minecraft models
  - ✅ use testCharacterMaterial
    - ✅ migrate npc.setSkin and hot-reloads
    - ✅ npc.textures is [skinTex, labelTex]
    - ✅ skin auto-updates
    - ✅ rename as cuboidManMaterial
    - ✅ clean
  - ✅ adjust animation timeScale after transition
  - ❌ avoid cloning "scene"
    - makes sense to clone i.e. group containing bones and skinnedMesh
  - ✅ npc.m.mesh is mounted SkinnedMesh
  - ✅ npc.m.material is mounted ShaderMaterial
  - ✅ methods directly on npc instances
    - ✅ can toggle selector without re-render: npc.showSelector([bool])
    - ✅ can change selector color
      - `w npc.npc.rob.setSelectorRgb 1 0.5 1`
    - ✅ can change label
      - fix: ensure fresh textures supplied to npc when change w.npc.label
      - `w npc.npc.rob.setLabel rob`
    - ✅ bug: change label twice breaks first change
    - ✅ bug: initial flicker on 1st change label
      - seems shader is reading mutated data
    - ❌ can change label without render
    - ✅ absorb ensureLabels into updateLabels
    - ✅ add clearLabels
    - ✅ uniform `textures` -> uniforms u{Base,Label,Alt1}Texture
     - cleanup lookup `npc.tex`
    - ✅ can change face/icon
    ```sh
    w geomorphs.sheet.skins.uvMap.cuboid-man.front-face-angry
    w npc.npc.rob.setFace null
    w npc.npc.rob.setFace '{ uvMapKey: "cuboid-man", uvQuadKey: "front-face-angry" }'

    w geomorphs.sheet.skins.uvMap.cuboid-man.front-label-food
    w npc.npc.rob.setIcon null
    w npc.npc.rob.setIcon '{ uvMapKey: "cuboid-man", uvQuadKey: "front-label-food" }'
    ```

- ✅ sh: semantics: support e.g. `foo=$( w npc.npc.rob )`
  - ℹ️ we were "javascript stringifying" inside command substitution
  - ℹ️ now, command subst directly inside an assign forwards non-string value/values
  - e.g. `foo=$( seq 3 )`, `foo=$( w npc.npc.rob )`

- ✅ can run e.g. `w npc.npc.rob` inside pipeline.
  - i.e. use syntax `click 1 | w --stdin gmGraph.findRoomContaining`

- ✅ bug: sh: isolate bug involving nested pipelines terminating early, e.g.
  - ℹ️ still happens when we comment out `killPipeChildren`
  - ℹ️ thrown by preProcessWrite i.e. pipeline-between-whiles has finished reading
```sh
# 1st repro
click --long | filter meta.do | while take 1 >lastClick; do
  w npc.npc.rob | map '(npc, {home}) => npc.do(home.lastClick)'
done &

# 2nd repro
while true; do
  echo foo
done | while take 1; do
  # echo bar
  echo bar | echo baz
done
```

- ✅ implement "do points"
  - ℹ️ see repo the-last-redoubt src/projects/world-pixi/create-npc.js
  - ✅ npc.fade (in or out)
    - `w npc.npc.rob.fade 0.2`
    - `w npc.npc.rob.fade 1`
  - ✅ async npc.fade
  - ✅ async npc.fadeSpawn
    - `w npc.npc.rob.fadeSpawn $( click 1 )`
  - ✅ async npc.turn
  - ✅ async npc.onMeshDo
    - ℹ️ for the moment use `startAnimation('Idle')`
  - ✅ turn faster whilst walking
  - ✅ refactor walk onStart callback
  - ✅ async npc.offMeshDo
  - ✅ async npc.do (migrate code)
  - ✅ can spawn to non-nav point
    - ✅ remove agent
    - ✅ restore agent on re-enter nav
  - ✅ restore Walk/Run animations
    - simplified to a single frame i.e. lean forwards
  - ✅ npc.do fix orientation angle
    - seems group.rotation.order `XYZ` rotates about y-axis ccw (x right, -z up)
  - ✅ npc.do can Sit (1st attempt)
  - ✅ npc.do can Lie (1st attempt)
    - use meta.y to raise off ground
  - ✅ fix cuboidManShader when `Lie`
    - ℹ️ not taking bone transforms into account
  - ✅ opacity/showSelector breaking?
    - ℹ️ e.g. ineffective: `w npc.npc.rob.fade 0.5`
    - maybe stale reference to shader?
  - ✅ can `do` via long press
    - ✅ useHandleEvents ignores long press of do point
    - ✅ clarify `click 1` returning nothing on e.g. RMB
      - ℹ️ `click 1` outputs nothing if you do a long click
      - ℹ️ `click --long 1` works instead
    - ✅ profile-1 has custom code
  - ✅ hide shadow for Lie, Sit via animation
  - ✅ one-frame animations: Sit, Lie
  - ✅ npc.startAnimationByMeta handles do meta
  - ✅ fix briefing table do point orients
  - ✅ more centred on do points
    - ✅ onclick do point provide `meta.doPoint` e.g. centre of icon
  - ✅ fix do points at head of briefing table
  - ❌ can specify do point offset e.g. further back for stool
  - ✅ fadeSpawn/spawn can specify agent
    - defaults true when spawn on nav
    - avoid setting doMeta.hadAgent
  - ✅ verify can set initial angle (ccw from east)
  - ✅ fix do point on particular seat on briefing room table
    - seems to think it is in navmesh e.g. small island?
  - ✅ improve shadow for other animations

- ✅ cleanup before merge branch
  - ✅ door click should not propagate to floor
    - ℹ️ `click` will only set `meta.nav` as `true` if `meta.floor`
  - ✅ nearby nav click should cause move to
  - ✅ merge npc.waitUntilStopped into useHandleEvents
  - ✅ reject.turn, reject.fade
  - ✅ npc.turn -> npc.look
  - ✅ cannot spawn to arbitrary off-mesh position from off-mesh do point

- ✅ sh: `map --forever` does not terminate on throw

- ✅ profile-1: long click floor makes npc look towards it
  - ℹ️ `get lastClick/meta/floor` has exit code `0` iff `lastClick.meta.floor` exists
  - ℹ️ `test foo` has exit code `0` iff evaluated JavaScript `foo` is truthy
    > e.g. `test $( w | map 'w => ...' )`
  - e.g. `test $( call '({ home }) => home.lastClick.meta.floor === true' )`
  - e.g. `test $( get lastClick/meta/floor )`
  - ✅ two approaches i.e. `while` or `map`

- ✅ `map` awaits when working with an async function
  - ℹ️ we still require "async" keyword to be manually provided
  - `seq 1000000 | map 'x => x + 1'` (fast)
  - `seq 100000 | map 'async x => x + 1'` (slow: many promises)

- ✅ migrate Floor and Ceiling to single draw-call
  - ℹ️ still need floor pointer events for navigation
  - ✅ positionInstances
  - ✅ specify textureId convention
    - ℹ️ by first seen respective gmKey
  - ✅ addUvs
  - ❌ coverage of MAX_TEXTURE_IMAGE_UNITS at 16 vs min 8?
  - ❌ multiple instancedMesh?
  - ✅ try texture array approach
    - ℹ️ https://discourse.threejs.org/t/how-can-i-color-the-plane-with-different-colors-as-squares-in-the-same-face/53418/8
    - ✅ permits partial rebuild
    - ✅ fix HMR initialisation
    - ✅ must have same resolution `2424 * 2424`
    - ✅ fix brightness
    - ✅ fix hmr
      - ✅ on change ceiling drawGmKey
      - ✅ on change symbol
      - ✅ fix stale texId inside cached CanvasTexMeta
        - ✅ try use a single temp CanvasTexture for floor/ceil
        - ✅ TexArray needn't contain any CanvasTextures
      - ✅ fix on edit create-gms-data
      - ✅ fix on change map
    - ✅ clean
      - ✅ texturesNew -> textures
      - ✅ move floor/ceiling textures into w.gmsData
      - ✅ move TextureAtlas e.g. to fix hmr
      - ✅ reuse TextureAtlas whenever possible
      - ✅ rename TextureAtlas as TexArray
    - ✅ check ceiling pointer events
      - ℹ️ won't fix because will be replaced by object-pick

- ✅ bug: `w npc.remove will` breaks door collision detection
  - must clear positions (surprising didn't have issue)


- ✅ bug: can navigate through locked door
  - ℹ️ improved by testing on each `way-point`
  - ℹ️ could test nextTargetInPath rather than all corners
  - ℹ️ nav mesh via filter is only partial solution due to "going stale during navigation"

- ✅ more efficient door collision testing
  - only check one-step ahead (next target, not corners)

- ✅ spawn near auto door triggers sensor
- ✅ spawn from near auto door triggers sensor

- ✅ physics colliders still aren't rotated correctly
  - ✅ compute and send lines from world.debugRender
  - ✅ draw lines from world.debugRender
  - ✅ fix alignment
  - ❌ fix colliders issue on refresh
    - no repro, might be hmr-related

- ✅ more nav through doorways issues
  - ℹ️ sometimes triggers much too late when "winding round corner of door"
  - ✅ nav seg was outside doorway, so door.doorway -> door.collidePoly,
    which is wider (full door width) yet shallow (slightly less than doorway)
- ✅ consider transparent body skin
  - transparency supported
- ✅ fix flickering hull door base (onchange camera view)
  - suffices to add a matching line

- ✅ instancedUvMappingShader (Doors, Obstacles, Decor quads/labels) -> instancedMultiTextureShader
  - ✅ bin packer supports multiple sheets
  - ✅ decor can have multiple images
    - ✅ static/assets/2d/decor.{sheetId}.png
    - ✅ World loads all into TexArray
    - ✅ decor point/quad has meta.img properly typed
    - ✅ use TexArray instead of CanvasTexture
    - ✅ decor point/quad has meta.sheetId
    - ✅ Doors too
    - ✅ test by forcing small sheets
    - ✅ clean
  - ✅ decor texture array
  - ✅ obstacles can have multiple images
    - ✅ refactor
    - ✅ test by forcing small sheets 
    - ✅ can darken decor/obstacles
    - ✅ clean
      - ℹ️ cannot clean away onPointer{Down,Up} yet
  - ✅ obstacles texture array
  - ✅ decor labels
    - ✅ new labels shader
  - ℹ️ decor cuboids shader won't be migrated
  - ✅ test decor hmr for multiple sheets
  - ✅ test obstacle hmr for multiple sheets


- ✅ gpu object-pick
  - ℹ️ encode (glsl) e.g. gmId, instanceId -> (1, gmId, instanceId >> 8, instanceId)
  - ℹ️ decode (js)   e.g. (r, g, b, a) -> 'wall', gmId, instanceId
  - ✅ walls: glsl encode uses function
  - ✅ walls: js decode uses function
  - ✅ support transparent
  - ✅ handle npcs
    - ✅ npc click detected
    - ✅ npcs need integer uid
      - ℹ️ assume max npcs 256
      - ℹ️ maintain Set([0..255])
  - ✅ floor object-pick
    - must compute non-object-pick opacity
    - `(2, gmId, 0, gl_FragColor.a)`
  - ✅ ceiling object-pick
    - must compute non-object-pick opacity
    - `(3, gmId, 0, gl_FragColor.a)`
  - ✅ w.ceiling uses w.floor quad
  - ✅ doors object-pick
    - `(4, instancedId, 0, gl_FragColor.a)`
  - ✅ decor quad object-pick
    - `(5, quadInstanceId, 0, gl_FragColor.a)`
  - ✅ obstacle object-pick
  - ✅ decor cuboid object-pick
  - ✅ lock light object-pick
  - ✅ on pick floor, raycast against infinite floor plane
    - ℹ️ manual approach needed to avoid raycast large number of instanced meshes
  - ✅ send pointer events
    - ℹ️ must object-pick on "down" e.g. for long press
    - ℹ️ can avoid object-pick on "up" (if close to down then use it)
    - ✅ `click 1` should provide a 3d position
      - all object-pick types have a position
    - ✅ fix RMB click: state.pickObject can end after native "pointerup"
  - ✅ enrich event meta as before
    - WorldCanvas ✅ Floor ✅ Walls ✅ Doors ✅ Obstacles ✅ Ceiling ✅ Decor ✅ Npcs ✅ 
  - ✅ clean

- ✅ cached geometries should have `w.key` prefix
- ✅ clean before merge branch
  - ✅ avoid dup w.ui.rootState, w.r3f
  - ✅ w.ui -> w.view
  - ❌ try alt style
    - ✅ outlined labels
    - ❌ adjust npc lighting
  - ✅ careful about alpha=0 in object-pick encoding
    - ℹ️ e.g. 768 ~ 0 mod 256
    - ✅ fix instancedMonochromeShader

- ✅ support `await api.sleep(1)` inside `map`
  - ℹ️ e.g. `{ echo foo; echo bar; echo baz; } | map 'async (input, {api}) => { await api.sleep(1); return input }'`
  - ✅ simplify `choice` so it does not use `sleep`
  - ✅ refactor underlying `choice` as AsyncFunction 
  - ✅ refactor `sleep` as AsyncFunction
- ✅ avoid initial instanced mesh render
  - ✅ avoid overwriting attributes
  - still seeing issue on mobile, but only on reset
- ✅ understand ~~duplicated~~ coinciding npcs e.g. on edit recast-detour.js
  - ℹ️ seems npc `will` is coinciding with npc `rob`
  - ℹ️ saw happen when changed symbol chairs
  - seems fixed via improved `w.npc.restore()`
- ✅ fix initial shader errors
  - [.WebGL-0x11809663f00] GL_INVALID_OPERATION: Vertex shader input type does not match the type of the bound vertex attribute.
  - ℹ️ useLayoutEffect related
  - ✅ try fix Floor, Walls, Doors, Obstacles, Ceiling (might break initial flicker fix)
  - ✅ replace useLayoutEffect with "mount-shader-when-ready"
- ✅ clarify connected nav issues:
  - ℹ️ inaccessible door should not prevent nav through open door
  - ℹ️ `maxSimplificationError: 0.85` helped, but causes nav kinks, so removed
  - ℹ️ npc should not be able to get too close to inaccessible door

- ✅ pause/resume should not progress motion along navMesh
- ✅ can spawn whilst in debug mode
  - pointerup triggers since update/render

- ✅ Decor/Doors, Floor/Ceil: hmr issue i.e. disappears
  - ℹ️ not dispose
  - ✅ related to TexArray
  - maybe fixed for Decor/Doors (0 width canvas check)
  - maybe fixed for Floor/Ceil (0 width canvas check)

- ❌ try navMesh sans doorways using off-mesh connections instead
  - ✅ add off-mesh connections per non-hull doorway
  - ✅ detect when enter off-mesh connection
    - prevState !== agent.state() and one equals `2`
  - ❌ try using requestMoveVelocity (did not work)
  - ℹ️ unnatural navigation + non-trivial to change on-connection speed

- ✅ `click` is v3 and has `clicked.xz`?
  - ✅ profile-1 click consumers could be 2d/3d agnostic
  - `click 1 | w view.zoomTo --stdin`
  - ℹ️ example where 2d project needed: `click 1 | w gmGraph.findRoomContaining`,
    - could `click 1 | map xz | w gmGraph.findRoomContaining`
    - could `click 1 | map meta`
  - ℹ️ can use `w.lib.toXZ` and `w.lib.toV3`

- ✅ `w --stdin` e.g. `echo image/webp | w --stdin view.openSnapshot - 0` should be low quality
  - ℹ️ should be same as `w view.openSnapshot image/webp 0`
  - ℹ️ getopts is reordering hyphen `-` i.e. need another dummy symbol to represent stdin
  - use underscore `echo image/webp | w --stdin view.openSnapshot _ 0`

- ✅ change const.js hmr issue i.e. floor/ceiling disappears
  - ℹ️ floor comes back if remount material...
  - ℹ️ seems floor data texture `source.data` is all black
  - ✅ `w.texVs.{floor,ceiling}++` in world query
  - ✅ `w.tex{Floor,Ceil}`
  - ℹ️ should try to replace `w.update()`
- ✅ jerky npc movement when pause then unpause while moving
  - ℹ️ Floor/Ceiling were needlessly recomputed

- ❌ try scaling geometry up, using cs=0.15, then scaling down

- ✅ BUG saw npc stuck with: agent, s.act (Walk), s.target (non-null)
  - ℹ️ by running quickly many times
  - ℹ️ `w n.rob.agent.velocity` is `{x:0,y:0,z:0}`
  - ✅ seems to be issue with nav mesh (cs too small)

- ❌ try creating nav tiles to see if it avoids "steiner points"
  - ✅ migrate https://github.com/isaac-mason/sketches/blob/main/sketches/recast-navigation/dynamic-tiled-navmesh/src/navigation/dynamic-tiled-navmesh.ts
    - ✅ dynamic-nav-mesh ts -> js
    - ✅ build-tile ts -> js
    - ✅ move worker code into nav.worker
    - ✅ get demo build working
    - ✅ show demo navmesh
  - ❌ decided against it
- ✅ try improve nav by changing tile size
  - small tile size `0.1` has many Steiner points, yet is pretty good
- ❌ try avoid nav steiner points via large tile size and using areas
  - too "non-canonical"

- ✅ fix npc.setLabel
  - ✅ onchange label sprite-sheet, update *all* effected npc
  - ℹ️ could share uniforms via DataTexture
  - ℹ️ could avoid excessive computation by pre-building `rob_{1..200}`

- ✅ try "off-mesh-connections" again
  - ℹ️ fix push-other-npc-thru-door via separation weight
  - ℹ️ fix lockers in bridge, fix diagonal doors
  - ✅ add off-mesh connections and visualise them
  - ✅ check separation weight cannot push agent into connection
  - ✅ nav.worker iterates through all off-mesh connections
  - ✅ nav.worker provides lookup from `{tile.minX},{tile.minZ}` to `{ offMeshPolysIds }`
  - ✅ detect off-mesh connection enter/exit
    - ✅ `enter-off-mesh`
    - ✅ detect when over (`agent.state() === 2`)
    - ✅ get off-mesh-connection
    - ✅ can detect src --> dst
    - ✅ `exit-off-mesh`
  - ✅ can pause agent by temp setting maxSpeed 0 on exit offMeshConnection,
    - `w n.rob.agent.updateParameters '{ maxSpeed: 0 }'`
    - `w n.rob.agent.updateParameters '{ maxSpeed: 2 }'`
  - ❌ can cancel just before traverse offMeshConnection?
    - ℹ️ once agent has changed state we can't stop it
    - ℹ️ https://github.com/isaac-mason/recast-navigation-js/discussions/458
    - ℹ️ taking new approach i.e. forking recastnavigation
    ```json
    "@recast-navigation/core": "npm:@rob-myers/recast-navigation__core@0.38.0",
    "@recast-navigation/generators": "npm:@rob-myers/recast-navigation__generators@0.38.0",
    "@recast-navigation/three": "npm:@rob-myers/recast-navigation__three@0.38.0",
    "@recast-navigation/wasm": "npm:@rob-myers/recast-navigation__wasm@0.38.0",
    ```
  - ✅ can see recastnavigation change on prod
  - ✅ use tsconfig.json to alias @recast-navigation/*
    ```js
    // 🔔 might need to `rm -rf .cache` and `yarn build` to see changes,
    //   at least when first switching to this approach
    "paths": {
        "@recast-navigation/core": ["../recast-navigation-js/packages/recast-navigation-core"],
        "@recast-navigation/generators": ["../recast-navigation-js/packages/recast-navigation-generators"],
        "@recast-navigation/three": ["../recast-navigation-js/packages/recast-navigation-three"],
        "@recast-navigation/wasm": ["../recast-navigation-js/packages/recast-navigation-wasm"]
    },
    ```
  - ✅ alter recastnavigation, so offMeshConnection are traversed more slowly
    - ℹ️ faster to directly alter recast-navigation-js/packages/recast-navigation-wasm/recastnavigation then move the changes to recastnavigation repo before commit
    - ✅ rebuild via `cd packages/recast-navigation-wasm && yarn build`
    - ✅ improve both segments of path
    - ✅ publish `@rob-myers/recast-navigation__wasm@0.38.1`:
      - at recast-navigation-js repo, manually change version/dep-versions (core,generators,three,wasm) in package.json to 0.38.1
      - then in repo root `yarn publish`
      - then in this repo `rm -rf .cache` `npm i` and `yarn dev`
  - ✅ bump versions in this repo and verify local build
  - ✅ can stop agent smoothly on enter-off-mesh
    - thanks to smoothening of off-mesh traversal and `crowd.raw.getAgentAnimation(agent.agentId)`
  - ✅ fix slight jerk when exit offMeshConnection
    - ✅ try specifying max velocity on leave
    - ✅ publish new version `0.38.2`
  - ✅ fix npc turn target for offMeshConnection
    - ✅ works smoothly
    - ✅ even smoother
      - ℹ️ agent.raw.get_cornerVerts(0..2) is "src" even after entered
      - ℹ️ "calcSmoothSteerDirection approach" does not seem to work
        - uses next two corners relative to current position
        - maybe it's making assumptions about how we steer
      - ✅ linear incoming bezier
    - ❌ could change final desired velocity in C++
    - ℹ️ straightness of offMeshConnection lacks smoothness of original approach, but has many advantages
    - ✅ clean
      - npc.s.offMesh.seg is `initial` or `main`
  - ✅ fix auto hull doors
    - ✅ not opening when traversing offMeshConnection
    - ✅ some npcs get stopped
  - ✅ door opens before going through offMeshConnection
  - ✅ agent stops if door inaccessible on `enter-off-mesh` event
    - ✅ can temp set edge unwalkable
      - `w nav.navMesh.setPolyFlags 4341761 1`
      - `w nav.navMesh.setPolyFlags 4317185 1`
    - ✅ track when offMeshConnection in use
      - locally `npc.s.offMesh`
      - globally in `w.nav.offMeshLookup`
    - ✅ w.e.npcToOffMesh[npcKey]
    - ✅ set edge unwalkable while in use
    - ❌ stop any `enter-off-mesh` while in use
  - ❌ do not navigate on `WARN getClosestNavigable failed:`
    - irrelevant i.e. if click room inaccessible via queryFiltered offMeshConnection,
      `findClosestPoint` will still successfully "find" this point
  - ✅ try stop agent on `enter-off-mesh` rather than setting flags on poly offMeshRef
    - ℹ️ setting flag has issues e.g. moveTo midway
    - ✅ w.e.npcToOffMesh -> w.e.doorToOffMesh
    - ✅ offMesh.reverse is offMesh lookup value in "reverse direction"
    - ✅ `enter-off-mesh` stops agent if offMeshConnection in use
  - ✅ fix events: must avoid "circular" offMesh values
  - ✅ `enter-off-mesh` permits "one agent after another"
    - ℹ️ cannot overwrite `offMesh.state` with 2 npcs traversing e.g. because used by `onTickAgentTurn`
    - ✅ `offMesh.state` -> `npc.s.offMesh`
    - ✅ permit traverse in same direction if most recent npc on main segment and doesn't currently collide
  - ✅ in use off-mesh connection with door open cannot be closed
    - ✅ offMeshConnection has srcGrKey and dstGrKey for exit/enter-room
    - ✅ migrate exit/enter-room
    - ✅ remove "inside" sensor
  - ✅ clean
    - ✅ enter/exit-room event
    - ✅ careful about hull door duplicate offMeshConnection
  - ❌ could lerp whilst agent on off-mesh-connection
  - ❌ could remove agent from crowd and move linearly
  - ❌ navRectId --> connectedComponentId in gmGraph
    - fixed by computing navRectId using navPolyWithDoors
  - ❌ to avoid offMeshConnection backtracking could set `anim->startPoint` to be
    closest point on edge `startPoint -> endPoint`


- ✅ ContextMenu rethink
  - ✅ move object-pick-circle into Debug
  - ✅ lastDown.{normal,quaternion} always defined
  - ✅ `ContextMenus`
    - ✅ fix HMR by avoiding function-as-property
    - ✅ default i.e. via rmb/long-press
      - ℹ️ no popup
      - ✅ shows object-pick meta
      - ✅ positioned at click
      - ✅ object-pick meta collapsible (remembered)
      - ✅ scaled
    - ✅ can customise from CLI
      - ✅ links not icons
      - ✅ links trigger world events
    - ✅ can add static menu from default context menu
    - ✅ "save" creates static menu with left label `cm.key`
      - "save" and "pin" disappear
      - "exit" deletes
    - ✅ no need to refresh all i.e. use cm.epochMs
    - ✅ show-context-menu event
    - ❌ show-context-menu event
    - ✅ example of static panel
    - ✅ remove `ContextMenu`
    - ✅ default context menu can be "docked"
    - ✅ remove static panels
      - decided only default and speech bubbles
    - ✅ default context menu dock moves to lower left
    - ❌ default context menu can drag
    - ✅ extend default via script
      - ✅ can add/remove named "matchers"
        - ℹ️ w.cm.match.foo = bar
      - ✅ extra links on click switch
      - ✅ extra links on click door
        - do not support unauth npc inside room i.e. this action corresponds to having a remote key
      - ✅ links take effect e.g. open door
      - ✅ speech bubbles
        - ✅ can add for npc `w c.trackNpc rob`
          - cm.tracked as `w.n[npcKey]?.m.group`
        - ✅ can remove for npc `w c.delete @rob`
        - ✅ always scaled
          - seems hard-coded cm.baseScale better than "agent-to-camera-distance" when `w c.trackNpc rob`
        - ✅ improve styling
        - ❌ offset upwards
        - ✅ `w c.create rob`
        - ✅ can set speech
          - `w c.lookup.@rob.setSpeech 'foo bar baz'`
        - ✅ `w c.lookup.rob.say 'foo bar baz'`
        - ✅ `w c.say rob 'foo bar baz'`
        - ✅ can show links too
          ```sh
          w c.lookup.rob.setLinks "{ key: 'foo', label: 'foo' }" "{ key: 'bar', label: 'bar' }"
          ```
        - ✅ object pick npc shows bubble, not default context menu
        - ✅ can close bubble
    - ✅ default context menu on npc tracks npc
    - ✅ simplify speech bubbles
      - ✅ no links
      - ✅ `w.c.say {npcKey} {words}` ensures
      - ✅ `w.c.say {npcKey}` deletes
    - ❌ links can be npc-sensitive
      - ✅ `cm.setNpc()` `cm.setNpc('rob')` and show
      - ✅ can remove by clicking it
      - ✅ temp: profile-1: triggered on select npc
      - ✅ triggered via long click npc
      - ✅ handleContextMenu accounts for `cm.npcKey`
      - will use custom select instead
    - ✅ separate classes for DefaultContextMenu and SpeechBubble
    - ✅ use custom select instead
      - choose none or npcKey
      - can refresh via button "refresh"
      - profile-1 `handleContextMenu` takes npcKey into account
    - ✅ clean
  - ✅ remove icon generation code from asset.js
  - ✅ Fix npc speech height
    - ✅ change height offset onchange animation
    - ✅ walk/run/idle , ✅ sit, ✅ lie