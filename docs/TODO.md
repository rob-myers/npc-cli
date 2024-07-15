# TODO

## WIP

- 🚧 migrate sub-symbols to actual symbols
  - ✅ 301 ✅ 302 ✅ 303 ✅ 101 🚧 102
  - ✅ bridge ✅ lifeboat
  - consoles
  - extras
- 🚧 extend chair/table symbols with chair/table tag on obstacle
- ❌ decor point bounds determined by original rect/poly

- 🚧 Decor component
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
  - 🚧 remove temp "all decor points shown with info icon"
    - only show do points
    - debug.showLabels draws into ceiling textures
  - move `w.setReady` into useHandleEvents
  - rotated rect 4-gon -> affine transform
  - some symbol decor poly (rotated rect) has `img={decorImgKey}`
  - decor poly induces quads
  - decor cuboids can effect nav-mesh
  - fix geomorph decor warns e.g. not fuel label not in any room
  - saw decor disappear when editing symbols
  - can choose colour of decor cuboids

- ✅ world provides "resolve when ready" api
- careful that world query doesn't "run twice at once"
  - e.g. by focusing window whilst ongoing?

- request new nav-mesh onchange base "getTileCacheGeneratorConfig()"
- darken obstacle machinery via InstancedMesh colours

- rebuild animation actions `IdleLeftLead`, `IdleRightLead`
- ❌ shoulder mesh (extend from chest), or arms closer to chest ❌

- consider alternatives to current custom minecraft character
  - https://assetstore.unity.com/packages/3d/characters/humanoids/simple-people-cartoon-characters-15126#description
  - https://assetstore.unity.com/packages/3d/characters/humanoids/simple-space-characters-cartoon-assets-93756
  - probably won't use but can compare for ideas e.g. better textures, modelling

- duplicate walls in a symbol seemed to cancel each other out
- tty resize while multiline input is broken again
- tty pause/resume loses should remember cursor position
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
- verify HMR which propagates from assets -> geomorphs.json -> gmsData
- avoid connector re-computation i.e. extend serialization
- currently single quotes are breaking game-generators
- 🚧 Boxy SVG can be slow to save
  - https://boxy-svg.com/bugs/370/intermittent-slow-saving
  - 🚧 try replicate again in Chrome vs Incognito Chrome
  - 🚧 try turn off "FileVault" on Mac OS
- `w` command by itself should not throw
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
- use rapier physics 3d in web worker
  - i.e. static triggers

- next.js repo continued
  - migrate Viewer

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
- ✅ migrate roomGraph per geomorph
- migrate gmRoomGraph
- migrate fast gmRoomId lookup via image pixels
- prevent agent going through door
  - e.g. when avoiding another agent, could use obstacle
  - e.g. use gmRoomGraph to avoid going thru closed door
- show toast while navmesh loading
  - also show results e.g. number of tiles

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
- ✅ type worker.postMessage in main thread and worker
  - ✅ main thread
  - ✅ worker
- ✅ get web worker HMR "working"
  - ❌ https://github.com/webpack/webpack/issues/14722
  - ℹ️ gatsby does not support "webpack multi-compiler"
  - ✅ `useEffect` with worker.terminate suffices -- don't need react fast-refresh in worker
- ✅ changing props.mapKey should change map
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
- ✅ integer accuracy when parsing maps
  - Boxy has rounding errors e.g. when reflect
  - ℹ️ seems fixed after setting Boxy accuracy as maximum (attr + transform)
- sh `test {fn}` evaluates function with `map` args
- Terminal crashing during HMR
  - possibly fixed via `xterm-addon-webgl@beta`
  - ℹ️ haven't seen for a while
- need to remove labels from hull symbol image?
- Firefox android allows unbounded scrolling on "interact"
  - debug locally using about:debugging#/runtime/this-firefox
- 🚧 Boxy SVG: can we avoid creating new `<pattern>` when copy/dup then transform?
  - https://boxy-svg.com/ideas/371/transform-tool-preserve-pattern-geometry-option
- ✅ fix case where `transform-box` is ~~`content-box`~~ or `fill-box`
  - https://boxy-svg.com/ideas/409/reset-transform-origin-points-svgz-export-option
  - ℹ️ seen in parseSymbol of hull symbol
  - ℹ️ fixed by updating sphere bounds
- in parallel, start going through https://github.com/recastnavigation/recastnavigation
  - to understand what recast outputs
  - to understand what detour inputs

- ❌ only show ContextMenu on right click on desktop
- ❌ show ContextMenu on double tap instead of long tap

- if Viewer maximised and choose menu item, halve size of the Viewer

- if only open Viewer a tiny amount then it should close itself

- ✅ smaller collapsed nav on mobile
- fix multi-touch flicker on drag
  - setup local dev on phone to debug this
- can add Tabs via links in blog posts
  - without remounting other tabs!
- open Viewer should enable Tabs initially
- ✅ can press Escape/Enter to pause/unpause
- how does shell function versioning work in sh/scripts.ts?
- fix vertical tab drag on mobile
  - need repro

- iOS issues:
  - ✅ Nav wasn't centred
  - ✅ Viewer initially partially occluded
  - seems fixed on iPhone 13

- more decor images
  - `computer-2`
  - `speaker-1`
  - `communicator-1`
  - `fabricator-1`
- place decor points on many tables
- more tables in 301
- more tables in 101
- World WebGL rendering pauses on pause Tabs

- install cypress to test terminal
- netlify site `npc-cli` at https://lastredoubt.co


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
