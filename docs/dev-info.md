
## Bits and pieces

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