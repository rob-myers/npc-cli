# TODO

## WIP

- ✅ Restart TestCharacter: animation, no physics
  - ✅ clean away `@react-three/rapier`
  - ✅ show custom character FBX
  - ✅ scale character to desired height
  - ✅ import FBX into Blender and export as GLTF
    - ✅ install blender 4.1 (latest)
  - ✅ download three FBX animations from mixamo and somehow load into GLTF
    - show a Mixamo animation (use Blender to combine animations)
    - https://www.youtube.com/watch?v=y1er4qFQlCw&ab_channel=Valentin%27scodingbook

- integrate TestCharacter into TestWorld

- symbols induced raised images via spritesheet
  - obstacle polys embed into rects (?)
  - obstacle polys have `y={y}`
  - InstancedMesh with raised XZ planes
  - obstacle polys induce sprite-sheet with uv-map
  - InstancedMesh uses uvs
- ❌ show tables via raised "floor texture"

- show toast while navmesh loading
  - also show results e.g. number of tiles

- mobile extra space at bottom again
  - probably caused by new sticky header

- closed doors have filtered doorPolys
- can make agent look at point
- ✅ migrate roomGraph per geomorph
- migrate gmRoomGraph
- migrate fast gmRoomId lookup via image pixels
- prevent agent going through door
  - e.g. when avoiding another agent, could use obstacle
  - e.g. use gmRoomGraph to avoid going thru closed door

- create smaller-pngs.js and compare to https://tinypng.com/
- scripts assets/images trigger different useQuery
- Player view could be top-down with high walls
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
- ❌ try unify parseMaps and parseSymbols
- try fix sporadic missing updates
  - ✅ move maps to `media/map`
  - ✅ improve remount keys
  - still seeing occasional issues?
- ✅ integer accuracy when parsing maps
  - Boxy has rounding errors e.g. when reflect
  - ℹ️ seems fixed after setting Boxy accuracy as maximum (attr + transform)
- ❌ migrate Triangle
  - png -> webp script applied to assets/debug
- ❌ learn about WebGl RenderTargets
  - Towards "Pixi.js RenderTexture" functionality
  - https://blog.maximeheckel.com/posts/beautiful-and-mind-bending-effects-with-webgl-render-targets/
- ❌ try migrate R3FDemo to react-three-offscreen
- sh `test {fn}` evaluates function with `map` args
- ❌ improve MapControls zoomToCursor on mobile
  - two fingers leftwards to rotate
  - two fingers upwards to set polar
- Terminal crashing during HMR
  - possibly fixed via `xterm-addon-webgl@beta`
  - ℹ️ haven't seen for a while
- ❌ (hull) walls -> quads
  - ℹ️ trying alternative i.e. "edges outside floor"
- need to remove labels from hull symbol image?
- ❌ try avoid alphaBlend geomorphs via alphaMap
  - we only need depthWrite false
- Firefox android allows unbounded scrolling on "interact"
  - debug locally using about:debugging#/runtime/this-firefox
- 🚧 Boxy SVG: can we avoid creating new `<pattern>` when copy/dup then transform?
  - https://boxy-svg.com/ideas/371/transform-tool-preserve-pattern-geometry-option
- ✅ fix case where `transform-box` is ~~`content-box`~~ or `fill-box`
  - https://boxy-svg.com/ideas/409/reset-transform-origin-points-svgz-export-option
  - ℹ️ seen in parseSymbol of hull symbol
- ❌ react-three-fiber onPointerUp not updating when instance transformed
  - ❌ possibly related closed issue:  https://github.com/pmndrs/react-three-fiber/issues/1937
  - ℹ️ fixed by updating sphere bounds
- in parallel, start going through https://github.com/recastnavigation/recastnavigation
  - to understand what recast outputs
  - to understand what detour inputs

- only show ContextMenu on right click on desktop
- show ContextMenu on double tap instead of long tap

- if Viewer maximised and choose menu item, halve size of the Viewer

- if only open Viewer a tiny amount then it should close itself

- ❌ world editor in new repo
  - instead we use Boxy SVG to make `media/map/{mapKey}.svg`
- ❌ geomorph editor in new repo
- 🤔 despite our "generic aim" (fabricating game masters),
  some context will help e.g. The Last Redoubt

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


## Scratch Pad

```jsx
// Why does this seemingly block main thread?
React.useEffect(() => {
  // 🚧
  import("recast-navigation").then(({ init }) =>
    init().then(() => {
      // compute vertices, indices
      let offset = 0;
      const vs = /** @type {number[]} */ ([]);
      const is = /** @type {number[]} */ ([]);
      state.gms.forEach(({ navPolys }) => {
        const { vertices, indices } = polysToAttribs(navPolys);
        vs.push(...vertices);
        is.push(...indices.map((x) => x + offset)); // 🚧 needs flip under conditions
        offset += vertices.length / 3;
      });
      is.reverse();

      import("recast-navigation/generators").then(({ generateSoloNavMesh }) => {
        const { navMesh, success } = generateSoloNavMesh(vs, is, {});
        console.log({ navMesh, success });
      });
    })
  );
}, [geomorphs]);
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
  -   ✅ extra--chair--003--0.25x0.25
  -   ✅ extra--desk--004--0.5x1
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
