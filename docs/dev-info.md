
## Bits and pieces

### Blender on MacBook

#### User Interface

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

- Add texture
  - Choose `Shading` workspace.
  - Select mesh, then click "New" in Shader Editor.
    - Shift+A, Image > Image Texture.
    - Open, then choose image
    - Connect "Color" to "Base Color"

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

- Basic IK setup for "feet to stay in place when move root up/down"
  - edit mode, ensure top of legs are parented to root
  - pose mode, select target bone of IK, properties > bone constraints > IK > set chain length 2
  - edit mode, move knees forwards a bit
  - pose mode, can move root down and feet stay in place

- Mirroring
  - edit mode, 3d viewport, n to show "Item, Tool, View", Tool > "X-Axis Mirror"
  - Doesn't work in pose mode

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