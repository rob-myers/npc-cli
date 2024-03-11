# NPC CLI

Towards believable NPCs.

## Gotchas

Configure Giscus using https://giscus.app/.

Use VSCode plugin `Prettier - Code formatter`,
published by `Prettier`.

## Bits and pieces

### Understanding affine transforms

Given a rectangle
> `{ x: 0, y: -480, width: 120, height: 120 }`

we'll apply the affine transform:
> `matrix(1, 0, 0, -1, 840, 1)` relative to the transform-origin `(60, -420)`.


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