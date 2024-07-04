import React from "react";
import * as THREE from "three";

import { Mat, Poly } from "../geom";
import { gmFloorExtraScale, hitTestRed, worldToSguScale } from "../service/const";
import { keys } from "../service/generic";
import { createGridPattern, drawCircle, drawPolygons, strokeLine, tmpCanvasCtxts } from "../service/dom";
import { quadGeometryXZ } from "../service/three";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Floor(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    gridPattern: createGridPattern(1.5 * worldToCanvas),
    tex: w.floor.tex, // Pass in textures

    drawFloor(gmKey) {
      const [ct, tex, { width, height }] = state.tex[gmKey];
      const gm = w.geomorphs.layout[gmKey];
      const { pngRect, hullPoly, navDecomp, walls } = gm;

      ct.clearRect(0, 0, width, height);
      ct.fillStyle = 'red';
      ct.strokeStyle = 'green';

      ct.setTransform(worldToCanvas, 0, 0, worldToCanvas, -pngRect.x * worldToCanvas, -pngRect.y * worldToCanvas);

      // Floor
      drawPolygons(ct, hullPoly.map(x => x.clone().removeHoles()), ['#333', null]);

      // Nav-mesh
      const triangles = navDecomp.tris.map(tri => new Poly(tri.map(i => navDecomp.vs[i])));
      const navPoly = Poly.union(triangles);
      drawPolygons(ct, navPoly, ['rgba(40, 40, 40, 1)', '#999', 0.025]);
      // drawPolygons(ct, triangles, [null, 'rgba(200, 200, 200, 0.3)', 0.01]); // outlines

      // draw grid
      ct.setTransform(1, 0, 0, 1, -pngRect.x * worldToCanvas, -pngRect.y * worldToCanvas);
      ct.fillStyle = state.gridPattern;
      ct.fillRect(0, 0, width, height);
      ct.setTransform(worldToCanvas, 0, 0, worldToCanvas, -pngRect.x * worldToCanvas, -pngRect.y * worldToCanvas);

      // Walls
      drawPolygons(ct, walls, ['black', null]);
      // // Doors
      // drawPolygons(ct, doors.map((x) => x.poly), ["rgba(0, 0, 0, 0)", "black", 0.02]);

      // drop shadows (avoid doubling e.g. bunk bed, overlapping tables)
      const shadowPolys = Poly.union(gm.obstacles.flatMap(x =>
        x.origPoly.meta['no-shadow'] ? [] : x.origPoly.clone().applyMatrix(tmpMat1.setMatrixValue(x.transform))
      ));
      drawPolygons(ct, shadowPolys, ['rgba(0, 0, 0, 0.25)', null]);

      // 🧪 debug decor
      // ct.setTransform(worldToSgu, 0, 0, worldToSgu, -pngRect.x * worldToSgu, -pngRect.y * worldToSgu);
      gm.decor.forEach((decor) => {
        if (decor.type === 'circle') {
          drawCircle(ct, decor.center, decor.radius, [null, '#500', 0.04]);
        }
      });

      // 🧪 debug original geomorph image
      // imageLoader.loadAsync(`/assets/debug/${gmKey}.png`).then((img) => {
      //   ct.setTransform(worldToSgu, 0, 0, worldToSgu, -pngRect.x * worldToSgu, -pngRect.y * worldToSgu);
      //   ct.globalAlpha = 0.2;
      //   ct.drawImage(img, 0, 0, img.width, img.height, pngRect.x, pngRect.y, pngRect.width, pngRect.height);
      //   ct.globalAlpha = 1;
      //   ct.resetTransform();
      //   tex.needsUpdate = true;
      // });

      ct.resetTransform();
      tex.needsUpdate = true;
    },
    drawHitCanvas(gmKey) {
      const gm = w.geomorphs.layout[gmKey];
      const { hitCtxt: ct } = w.gmsData[gmKey];

      ct.resetTransform();
      ct.clearRect(0, 0, ct.canvas.width, ct.canvas.height);

      ct.setTransform(worldToSguScale, 0, 0, worldToSguScale, -gm.pngRect.x * worldToSguScale, -gm.pngRect.y * worldToSguScale);
      gm.rooms.forEach((room, roomId) => {
        drawPolygons(ct, room, [`rgb(${hitTestRed.room}, ${roomId}, 255)`, null])
      });
      // 🚧 doors
    },
  }));

  w.floor = state;

  React.useEffect(() => {// initial + redraw on HMR
    keys(state.tex).forEach(gmKey => {
      state.drawFloor(gmKey);
      state.drawHitCanvas(gmKey);
    });
  }, [w.hash]);

  return <>
    {w.gms.map((gm, gmId) => (
      <group
        key={`${gm.key} ${gmId} ${gm.transform}`}
        onUpdate={(group) => group.applyMatrix4(gm.mat4)}
        // ref={(group) => group?.applyMatrix4(gm.mat4)}
      >
        <mesh
          name={`floor-gm-${gmId}`}
          geometry={quadGeometryXZ}
          scale={[gm.pngRect.width, 1, gm.pngRect.height]}
          position={[gm.pngRect.x, 0, gm.pngRect.y]}
        >
          <meshBasicMaterial
            side={THREE.FrontSide}
            transparent
            map={state.tex[gm.key][1]}
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
 * @property {Record<Geomorph.GeomorphKey, import("../service/three").CanvasTexDef>} tex
 * @property {(gmKey: Geomorph.GeomorphKey) => void} drawFloor
 * @property {(gmKey: Geomorph.GeomorphKey) => void} drawHitCanvas
 */

const tmpMat1 = new Mat();
const worldToCanvas = worldToSguScale * gmFloorExtraScale;
