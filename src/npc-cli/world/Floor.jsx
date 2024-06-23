import React from "react";
import * as THREE from "three";

import { Mat, Poly } from "../geom";
import { info, warn } from "../service/generic";
import { wallHeight, worldScale } from "../service/const";
import { drawCircle, drawPolygons, strokeLine } from "../service/dom";
import { quadGeometryXZ } from "../service/three";
import { geomorphService } from "../service/geomorph";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Obstacles(props) {
  const api = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    drawFloorAndCeil(gmKey) {// 🚧 separate into two functions
      const img = api.floorImg[gmKey];
      const { floor: [floorCt, , { width, height }], ceil: [ceilCt], layout } = api.gmClass[gmKey];
      const { pngRect } = layout;

      //#region floor
      floorCt.clearRect(0, 0, width, height);
      floorCt.drawImage(img, 0, 0);

      // obstacles drop shadows
      const scale = 1 / worldScale;
      floorCt.setTransform(scale, 0, 0, scale, -pngRect.x * scale, -pngRect.y * scale);
      // avoid doubling shadows e.g. bunk bed, overlapping tables
      const shadowPolys = Poly.union(layout.obstacles.flatMap(x =>
        x.origPoly.meta['no-shadow'] ? [] : x.origPoly.clone().applyMatrix(tmpMat1.setMatrixValue(x.transform))
      ));
      drawPolygons(floorCt, shadowPolys, ['rgba(0, 0, 0, 0.4)', null]);

      // 🚧 debug decor
      floorCt.setTransform(scale, 0, 0, scale, -pngRect.x * scale, -pngRect.y * scale);
      layout.decor.forEach((decor) => {
        if (decor.type === 'circle') {
          drawCircle(floorCt, decor.center, decor.radius, [null, '#500', 0.04]);
        }
      });

      floorCt.resetTransform();
      //#endregion
      
      //#region ceiling
      ceilCt.clearRect(0, 0, width, height);
      ceilCt.setTransform(scale, 0, 0, scale, -pngRect.x * scale, -pngRect.y * scale);
      // wall tops (stroke gaps e.g. bridge desk)
      // drawPolygons(ceilCt, layout.walls, ['rgba(50, 50, 50, 1)', null])
      const wallsTouchingCeil = layout.walls.filter(x =>
        x.meta.h === undefined || (x.meta.y + x.meta.h === wallHeight)
      );
      // drawPolygons(ceilCt, wallsTouchingCeil, ['rgba(250, 50, 50, 1)', 'rgba(250, 50, 50, 1)', 0.06])
      drawPolygons(ceilCt, wallsTouchingCeil, ['rgba(180, 180, 180, 1)', 'rgba(180, 180, 180, 1)', 0.06])
      // door tops
      ceilCt.strokeStyle = 'black';
      ceilCt.lineWidth = 0.03;
      drawPolygons(ceilCt, layout.doors.map(x => x.poly), ['rgba(200, 200, 200, 1)'])
      layout.doors.forEach(x => strokeLine(ceilCt, x.seg[0], x.seg[1]))
      ceilCt.resetTransform();
      //#endregion

      const { floor: [, floor], ceil: [, ceil] } = api.gmClass[gmKey];
      floor.needsUpdate = true;
      ceil.needsUpdate = true;
    },
  }));

  api.floor = state;

  React.useEffect(() => {
    // (a) ensure initial draw (b) redraw onchange this file
    geomorphService.gmKeys.forEach(
      gmKey => api.floorImg[gmKey] && state.drawFloorAndCeil(gmKey)
    );
  }, []);

  return <>
    {api.gms.map((gm, gmId) => (
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
            map={api.gmClass[gm.key].floor[1]}
            depthWrite={false} // fix z-fighting
          />
        </mesh>

        <mesh
          name={`ceil-gm-${gmId}`}
          geometry={quadGeometryXZ}
          scale={[gm.pngRect.width, 1, gm.pngRect.height]}
          position={[gm.pngRect.x, wallHeight + 0.001, gm.pngRect.y]}
        >
          <meshBasicMaterial
            side={THREE.FrontSide}
            transparent
            map={api.gmClass[gm.key].ceil[1]}
            // depthWrite={false} // fix z-fighting
            alphaTest={0.9} // 0.5 flickered on (301, 101) border
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
 * @property {(gmKey: Geomorph.GeomorphKey) => void} drawFloorAndCeil
 */

const tmpMat1 = new Mat();
