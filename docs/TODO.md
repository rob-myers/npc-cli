# TODO

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

## WIP

- 🚧 can drag Viewer toggle instead of max/min

  - ✅ can drag "drag-bar" instead
  - ✅ drag to 0% and let go => sets viewOpen `false`
  - ✅ when viewOpen false can start dragging
  - ✅ add overlay when dragging (body can be covered by iframe)
  - CSS var --view-size driven by useSite

- Nav icons for Blog, Dev, Help, About
- can add Tabs via links in blog posts
  - without remounting other tabs!
- ensure Tab components are lazy-loaded
- open Viewer should enable Tabs initially
- can press Escape/Enter to pause/unpause

- toasts indicate loading assets/components

- netlify site `npc-cli` at https://lastredoubt.co
- geomorph layouts via SVG, inducing current format
- world layouts via SVG, inducing current format
