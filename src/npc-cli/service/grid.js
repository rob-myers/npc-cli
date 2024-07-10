import { decorGridSize } from "./const";
import { tmpVec1 } from "./geom";

/**
 * @param {Geomorph.Decor} item 
 * @param {Geomorph.DecorGrid} grid 
 */
export function addToDecorGrid(item, grid) {
  const rect = item.bounds2d;
  const min = coordToDecorGrid(rect.x, rect.y);
  const max = coordToDecorGrid(rect.x + rect.width, rect.y + rect.height);
  // const max = coordToDecorGridSupremum(rect.x + rect.width, rect.y + rect.height);
  item.meta.gridMin = min; // For easy deletion
  item.meta.gridMax = max;
  for (let i = min.x; i <= max.x; i++)
    for (let j = min.y; j <= max.y; j++)
      ((grid[i] ??= [])[j] ??= new Set()).add(item);
}

/**
 * @param {number} x
 * @param {number} y
 */
export function coordToDecorGrid(x, y) {
  return { x: Math.floor(x / decorGridSize), y: Math.floor(y / decorGridSize) };
}

/**
 * - Returns colliders and points intersecting rect
 * - Does not filter by gmRoomId
 * @param {Geom.Rect} rect 
 * @param {Geomorph.DecorGrid} grid
 * @returns {{ [decorKey: string]: Geomorph.Decor }}
 */
export function queryDecorGridIntersect(rect, grid) {
  const decor = /** @type {{ [decorId: string]: Geomorph.Decor }} */ ({});
  const min = coordToDecorGrid(rect.x, rect.y);
  const max = coordToDecorGrid(rect.x + rect.width, rect.y + rect.height);
  /** @type {Geomorph.DecorGrid[*][*]} */ let tile;
  for (let i = min.x; i <= max.x; i++)
    for (let j = min.y; j <= max.y; j++) {
      grid[i]?.[j].forEach(x =>
        rect.intersects(x.bounds2d) === true
        && (decor[x.key] = x)
      );
    }
  return decor;
}

/** @type {Set<Geomorph.Decor>} */
const foundDecor = new Set;

/**
 * - Returns decor in same tiles as line
 * - Does not filter by gmRoomId
 * @param {Geom.Vect} p 
 * @param {Geom.Vect} q 
 * @param {Geomorph.DecorGrid} grid
 * @returns {Geomorph.Decor[]}
 */
export function queryDecorGridLine(p, q, grid) {  
  const tau = tmpVec1.copy(q).sub(p);
  /** Single horizontal step */
  const dx = Math.sign(tau.x);
  /** Single vertical step */
  const dy = Math.sign(tau.y);

  /** `p`'s grid coords */
  const gp = coordToDecorGrid(p.x, p.y);
  // /** `q`'s grid coords */
  // const gq = coordToDecorGrid(q.x, q.y);

  foundDecor.clear();
  grid[gp.x]?.[gp.y]?.forEach(d => foundDecor.add(d));
  if (dx !== 0 || dy !== 0) {
    /**
     * Those λ ≥ 0 s.t. p + λ.tau on a vertical grid line.
     * Initially minimum such, then the subsequent ones.
     * - General form λ := ((decorGridSize * dx * n) - p.x) / tau.x where n in ℤ
     * - λ ≥ 0 yields n := Math.ceil(± p.x / decorGridSize) 
     */
    let lambdaV = tau.x === 0 ? Infinity : tau.x > 0
        ? ((decorGridSize *  1 * Math.ceil( p.x / decorGridSize)) - p.x) / tau.x
        : ((decorGridSize * -1 * Math.ceil(-p.x / decorGridSize)) - p.x) / tau.x;
    /**
     * Those λ ≥ 0 s.t. p + λ.tau on a horizontal grid line.
     * Initially the minimum such, then the subsequent ones.
     * - General form λ := ((decorGridSize * dy * n) - p.y) / tau.y where n in ℤ
     * - λ ≥ 0 yields n := Math.ceil(± p.y / decorGridSize) 
     */
    let lambdaH = tau.y === 0 ? Infinity : tau.y > 0
      ? ((decorGridSize *  1 * Math.ceil( p.y / decorGridSize)) - p.y) / tau.y
      : ((decorGridSize * -1 * Math.ceil(-p.y / decorGridSize)) - p.y) / tau.y;
    
    let cx = gp.x, cy = gp.y;

    do {
      if (lambdaV <= lambdaH) {
        cx += dx; // Hit vert grid line 1st, so move horizontal
        lambdaV += (decorGridSize * dx) / tau.x; // Next vert line
      } else {
        cy += dy; // Hit horizontal 1st, so move vert
        lambdaH += (decorGridSize * dy) / tau.y; // Next horizontal line
      }
      grid[cx]?.[cy]?.forEach(d => foundDecor.add(d));

      // 🤔 (cx, cy) may not reach `max` in diagonal case?
      // } while ((cx !== max.x) && (cy !== max.y))
    } while (Math.min(lambdaH, lambdaV) <= 1)
  }

  return Array.from(foundDecor);
}

/**
 * @param {Geomorph.Decor} d 
 * @param {Geomorph.DecorGrid} grid 
 */
export function removeFromDecorGrid(d, grid) {
  const min = /** @type {Geom.VectJson} */ (d.meta.gridMin);
  const max = /** @type {Geom.VectJson} */ (d.meta.gridMax);
  for (let i = min.x; i <= max.x; i++)
    for (let j = min.y; j <= max.y; j++)
      grid[i][j]?.delete(d);
}
