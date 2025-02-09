
## Bits and pieces

### Bump versions in our branch of recast-navigation-js

```sh
# ---------------------------------
# at recast-navigation-js repo root
# ---------------------------------
# generate changesets
yarn change
# bump respective versions
yarn changeset version

# 🔔 manually bump sub-versions

# commit and push
# e.g. branch feat/expose-off-mesh-anim
# then finally:
yarn publish

# 🔔 may have to wait a bit for registry to update
# finally, optionally run `yarn`

# ---------------
# at npc-cli repo
# ---------------
# bump package.json versions, e.g.
# "@recast-navigation/core": "npm:@rob-myers/recast-navigation__core@0.38.4",
# "@recast-navigation/generators": "npm:@rob-myers/recast-navigation__generators@0.38.4",
# "@recast-navigation/three": "npm:@rob-myers/recast-navigation__three@0.38.4",
# "@recast-navigation/wasm": "npm:@rob-myers/recast-navigation__wasm@0.38.4",

# finally
npm i

```


### Get closest position relative ancestor 

> https://css-irl.info/finding-an-elements-nearest-relative-positioned-ancestor/

```js
// el in Chrome devtool
$0.offsetParent
// position
getComputedStyle($0.offsetParent).position
```

### Developing WASM / C++ locally with `recast-navigation-js` and `recastnavigation`

Download parallel repos:
- https://github.com/recastnavigation/recastnavigation
- https://github.com/isaac-mason/recast-navigation-js

See https://github.com/isaac-mason/recast-navigation-js/blob/main/DEVELOPMENT.md.

> For example, my `~/.bash_profile` contains:

```sh
export PATH=/Users/robmyers/coding/emsdk:$PATH
export PATH=/Users/robmyers/coding/emsdk/upstream/emscripten:$PATH
export EMSDK=/Users/robmyers/coding/emsdk
```

Extend "paths" in tsconfig.json:

```json
"paths": {
    "@recast-navigation/core": ["../recast-navigation-js/packages/recast-navigation-core"],
    "@recast-navigation/generators": ["../recast-navigation-js/packages/recast-navigation-generators"],
    "@recast-navigation/three": ["../recast-navigation-js/packages/recast-navigation-three"],
    "@recast-navigation/wasm": ["../recast-navigation-js/packages/recast-navigation-wasm"]
}
```

### Chrome DevTool filtering

```js
// filter annoying gatsby dev logs
-/Please make sure it has an appropriate `as` value and it is preloaded intentionally/
```

### Patch npm modules

```sh
# Can patch npm modules with `patch-package`
npx patch-package some-package
git add patches/some-package+$version.patch
```

### Convert to MP4 or GIF

```sh
# Convert mov to mp4
ffmpeg -i ~/Desktop/but-it-exists.mov -qscale 0 but-it-exists.mp4
ffmpeg -i ~/Desktop/but-it-exists.mov -filter_complex "[0:v] fps=10" -b:v 0 -crf 25 but-it-exists.mp4
ffmpeg -i ~/Desktop/but-it-exists.mov -filter_complex "[0:v] fps=60" -b:v 0 -crf 25 but-it-exists.mp4

# Convert mov to gif
ffmpeg -i ~/Desktop/boxy-svg-slow-save.mov -filter_complex "[0:v] fps=10,scale=1600:-1" output.gif
```

### Git show changed/untracked filenames

```sh
# show files and status
$ git diff --name-status
M       package.json
M       static/assets/2d/g-301--bridge.floor.png
M       static/assets/2d/g-301--bridge.floor.png.webp

# show files without status
$ git diff --name-only
package.json
static/assets/2d/g-301--bridge.floor.png
static/assets/2d/g-301--bridge.floor.png.webp

# list untracked files
$ git ls-files --others --exclude-standard
src/scripts/ensure-webp.js
static/assets/2d/g-301--bridge.floor copy.png
static/assets/2d/g-301--bridge.floor copy.png.webp
```

### Blender on MacBook

- On Laptop, Settings -> Input -> Emulate numpad -> 1, 2, 3, ... to change camera
  - BUT then lose Verts/Edges/Faces switch in Edit Mode
  - So maybe Emulate numpad off, and use Tilde overlay to switch view instead

- Hold Ctrl-Tab to show available modes e.g. Object/Edit/Pose/Weight Paint Mode, 
- `F3` to open search e.g. type 'fbx' to import FBX
- `/` to focus
- `Shift + S` -> `Cursor to Selection`
- `.` set pivot point as cursor
- Animation Action
  - change: ensure armature selected 1st
  - delete: shift-click "x"
- `n` in Edit mode shows Transform tool
- `Shift + F12` to switch between Timeline / ActionEditor
- `Shift + Left` return to frame 1
- `Shift + A` for "Add something menu"
- `5` for orthographic mode (when Emulate numpad)
- Backtick + "View  Selected" to centre selected item
- Switch bone direction
  - edit mode, select bone, Armature > Switch Direction
- Rename bones in Properties > Bone (not Outliner)
  - Else "vertex group" names get out-of-sync

- Add texture
  - Choose `Shading` workspace.
  - Select mesh, then click "New" in Shader Editor.
    - Shift+A, Image > Image Texture.
    - Open, then choose image
    - Connect "Color" to "Base Color"

- Blender Lighter Theme
  - Preferences > Themes > `White` (at top)
- Lighter Texture
  - Material Preview > Viewport shading > Set Strength `5`

- Concerning Forward Kinematics vs Inverse Kinematics
  - FK/IK switch requires a modified skeleton, maybe avoid for now i.e. FK suffices
    - https://www.youtube.com/watch?v=xEnu_EsnzjI&ab_channel=richstubbsanimation
  - Could also try Inverse Kinematic Constraint with weighting
    - https://docs.blender.org/manual/en/latest/animation/constraints/tracking/ik_solver.html

- Pixelated texture:
  - Shading Editor > Image Texture > Interpolation > `Closest` not `Linear`

- Edge loop select
  - Option+Click
- Change mesh without changing UV
  - 3D Viewport > Options > Correct Face Attribute
- If moving a vertex moves others
  - Ensure "Proportional editing" is turned off via `o`
- Edge loop cut
  - `Cmd + R`
- X-Ray for Armature might be:
  - Armature > Properties > Data > Viewport Display > In Front
- Extend Bone
  - Select tip and E to extrude
- Duplicate Bone
  - Select tip and Shift-D
- Automatically weight bone
  - One part of mesh at a time
  - Pose mode; (1) click body part, (2) shift-click bone; Ctrl-P > with automatic weights
- Weight paint mode
  - Object mode; (1) click armature, (2) shift-body body part(s); Weight paint mode now available 
  - You paint the _vertices_ (not faces)
- Show weights on mesh by selecting bone in Weight paint mode
  - Weight Paint Mode > Ctrl+Shift+LMB to select a bone.
- Reset bone rotation/position
  - Option+R/G
- Collapse/Expand Outliner
  - Shift-click
- Small-delta grab
  - Shift+G+...
- Insert Keyframe Menu
  - K
- Insert/Replace Single Keyframe
  - RMB on numeric UI input e.g. "Location X"
- Copy partial pose from left-to-right
  - Select left bones, Cmd+C, Select right bones, Cmd+Shift+C
- Switch between Dope Sheet and Graph Editor
  - Ctrl+Tab
- Graph Editor toggle channel visibility
  - Shift+H, unhide via Option+H

- Basic IK setup for "feet to stay in place when move root up/down"
  - edit mode, ensure top of legs are parented to root
  - pose mode, select target bone of IK, properties > bone constraints > IK > set chain length 2
  - edit mode, move knees forwards a bit
  - pose mode, can move root down and feet stay in place

- Mirroring
  - edit mode, 3d viewport, n to show "Item, Tool, View", Tool > "X-Axis Mirror"

- Blender's rotation quaternions
  - https://en.wikipedia.org/wiki/Euler%27s_rotation_theorem
  - `angle = 2 arccos W`
    - https://docs.blender.org/manual/en/latest/advanced/appendices/rotations.html

- Avoid export IK bones (for three.js performance)
  - must ALSO key effected bones e.g. {upper,lower}-leg bones, for each keyframe
  - must uncheck `Properties > Bone > Deform` for IK bones
  - export gltf options > Data > Armature > Export deformation bones only

- Remove unused animation channels
  - Dope Sheet > Channel > Clean channels
  - But sometimes want to keep e.g. static legs out-turned by IK pole targets


### The Animators Survival Kit (Richard Williams)

> https://archive.org/details/TheAnimatorsSurvivalKitRichardWilliams/page/n181/mode/2up

### unrar on Mac

```sh
export HOMEBREW_NO_AUTO_UPDATE=; # optional
brew install --cask rar
rar x Model.rar
```

### Find Local IP address on Mobile Hotspot

```sh
# Find local ip address for mobile development
ifconfig | grep "inet " | grep -v 127.0.0.1
```


### Detect uncommitted files

```sh
# none -> 0
# some -> 1
git diff --quiet HEAD; echo $?
```

### Export to OBJ in Browser

```js
import { OBJExporter } from "three-stdlib";
const objContents = new OBJExporter().parse(
  new THREE.Group().add(...meshes.map((x) => x.clone()))
);
// can copy-paste into foo.obj
// can import into https://navmesh.isaacmason.com/
// can import into https://threejs.org/editor/
console.log(objContents);
```

### Hush npm

```sh
# https://stackoverflow.com/a/76563661/2917822
npm config set audit false
npm config set fund false
```

### Affine transform example

Given a rectangle
> `{ x: 0, y: -480, width: 120, height: 120 }`

we'll apply the affine transform:
> `matrix(1, 0, 0, -1, 0, 840)` relative to the transform-origin `(60, -420)`.


Now, the affine transform has matrix representation shown below left.
Moreover the affine translation matrix `T(x, y)` is shown below right.

<div style="max-width:240px; columns: 2">

```
1  0   0 
0 -1 840
0  0   1
```

```
1  0  x 
0  1  y
0  0  1
```

</div>

Let `P := (0, -480, 1)` and `Q := (120, -360, 1)` be the top-left and bottom-right of the rectangle.
Then:

```js
T(60, -420) ·  M · T(-60, 420) · P
= T(60, -420) · M · (-60, -60, 1)
= T(60, -420) · (-60, 900, 1)
= (0, 480)
```

```js
T(60, -420) · M · T(-60, 420) · Q
= T(60, -420) · M · (60, 60, 1)
= T(60, -420) · (60, 780, 1)
= (120, 360)
```

Due to the special nature of the affine transform,
these diagonals induce the transformed rectangle by swapping ordinates.