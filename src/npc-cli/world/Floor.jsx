import React from "react";
import * as THREE from "three";

import { Mat, Poly } from "../geom";
import { geomorphGridMeters, gmFloorExtraScale, worldToSguScale } from "../service/const";
import { keys, pause } from "../service/generic";
import { createGridPattern, drawCircle, drawPolygons, drawSimplePoly } from "../service/dom";
import { getQuadGeometryXZ } from "../service/three";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Floor(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    gridPattern: createGridPattern(
      geomorphGridMeters * worldToCanvas,
      'rgba(255, 255, 255, 0.075)',
    ),
    tex: w.floor.tex, // Pass in textures

    async draw() {
      w.menu.measure('floor.draw');
      for (const gmKey of keys(state.tex)) {
        state.drawGmKey(gmKey);
        await pause();
      }
      w.menu.measure('floor.draw');
    },
    drawGmKey(gmKey) {
      const { ct, tex, canvas } = state.tex[gmKey];
      const gm = w.geomorphs.layout[gmKey];
      const { pngRect, hullPoly, navDecomp, walls } = gm;

      ct.clearRect(0, 0, canvas.width, canvas.height);
      ct.fillStyle = 'red';
      ct.strokeStyle = 'green';

      ct.setTransform(worldToCanvas, 0, 0, worldToCanvas, -pngRect.x * worldToCanvas, -pngRect.y * worldToCanvas);

      // Floor
      drawPolygons(ct, hullPoly.map(x => x.clone().removeHoles()), ['#333', null]);

      // Nav-mesh
      const triangles = navDecomp.tris.map(tri => new Poly(tri.map(i => navDecomp.vs[i])));
      const navPoly = Poly.union(triangles);
      drawPolygons(ct, navPoly, ['rgba(40, 40, 40, 1)', '#777', 0.025]);
      // drawPolygons(ct, triangles, [null, 'rgba(200, 200, 200, 0.3)', 0.01]); // outlines

      // draw grid
      ct.setTransform(1, 0, 0, 1, -pngRect.x * worldToCanvas, -pngRect.y * worldToCanvas);
      ct.fillStyle = state.gridPattern;
      ct.fillRect(0, 0, canvas.width, canvas.height);
      ct.setTransform(worldToCanvas, 0, 0, worldToCanvas, -pngRect.x * worldToCanvas, -pngRect.y * worldToCanvas);

      // cover hull doorway z-fighting (visible from certain angles)
      gm.hullDoors.forEach(hullDoor => {
        const poly = hullDoor.computeDoorway(true);
        const [p, q, r, s] = poly.outline;
        drawPolygons(ct, poly, ['#000', '#333', 0.025]);
        ct.strokeStyle = '#777';
        ct.beginPath(); ct.moveTo(q.x, q.y); ct.lineTo(r.x, r.y); ct.stroke();
        ct.beginPath(); ct.moveTo(s.x, s.y); ct.lineTo(p.x, p.y); ct.stroke();
      });

      // Walls
      drawPolygons(ct, walls, ['black', null]);
      // // Doors
      // drawPolygons(ct, doors.map((x) => x.poly), ["rgba(0, 0, 0, 0)", "black", 0.02]);

      // drop shadows (avoid doubling e.g. bunk bed, overlapping tables)
      const shadowColor = 'rgba(30, 30, 30, 0.4)'
      const shadowPolys = Poly.union(gm.obstacles.flatMap(x =>
        x.origPoly.meta['no-shadow'] ? [] : x.origPoly.clone().applyMatrix(tmpMat1.setMatrixValue(x.transform))
      ));
      drawPolygons(ct, shadowPolys, [shadowColor, shadowColor]);

      // debug decor: moved to <Debug/>
      // // ct.setTransform(worldToSgu, 0, 0, worldToSgu, -pngRect.x * worldToSgu, -pngRect.y * worldToSgu);
      // gm.decor.forEach((decor) => {
      //   if (decor.type === 'circle') {
      //     drawCircle(ct, decor.center, decor.radius, [null, '#009', 0.04]);
      //   } else if (decor.type === 'rect') {
      //     drawSimplePoly(ct, decor.points, [null, '#070', 0.04]);
      //   }
      // });

      // 🧪 debug original geomorph image
      // imageLoader.loadAsync(`/assets/debug/${gmKey}.png`).then((img) => {
      //   ct.setTransform(worldToCanvas, 0, 0, worldToCanvas, -pngRect.x * worldToCanvas, -pngRect.y * worldToCanvas);
      //   ct.globalAlpha = 0.2;
      //   ct.drawImage(img, 0, 0, img.width, img.height, pngRect.x, pngRect.y, pngRect.width, pngRect.height);
      //   ct.globalAlpha = 1;
      //   ct.resetTransform();
      //   tex.needsUpdate = true;
      // });

      ct.resetTransform();
      tex.needsUpdate = true;
    },
  }), { reset: { gridPattern: false } });

  w.floor = state;

  React.useEffect(() => {// initial + redraw on HMR
    state.draw();
  }, [w.mapKey, w.hash.full]);

  return <>
    {w.gms.map((gm, gmId) => (
      <group
        key={`${gm.key} ${gmId} ${gm.transform}`}
        onUpdate={(group) => group.applyMatrix4(gm.mat4)}
        // ref={(group) => group?.applyMatrix4(gm.mat4)}
      >
        <mesh
          name={`floor-gm-${gmId}`}
          geometry={getQuadGeometryXZ('vanilla-xz')}
          scale={[gm.pngRect.width, 1, gm.pngRect.height]}
          position={[gm.pngRect.x, 0, gm.pngRect.y]}
          renderOrder={-1} // 🔔 must render before other transparent e.g. npc drop shadow
        >
          <meshBasicMaterial
            side={THREE.FrontSide}
            transparent
            map={state.tex[gm.key].tex}
            depthWrite={false} // fix z-fighting
          />
        </mesh>
      </group>
    ))}
  </>
  
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {CanvasPattern} gridPattern
 * @property {Record<Geomorph.GeomorphKey, import("../service/three").CanvasTexMeta>} tex
 * @property {() => Promise<void>} draw
 * @property {(gmKey: Geomorph.GeomorphKey) => void} drawGmKey
 */

const tmpMat1 = new Mat();
const worldToCanvas = worldToSguScale * gmFloorExtraScale;
