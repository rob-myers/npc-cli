import React from "react";
import * as THREE from "three";

import { Mat, Poly } from "../geom";
import { worldScale } from "../service/const";
import { drawCircle, drawPolygons, strokeLine } from "../service/dom";
import { quadGeometryXZ } from "../service/three";
import { geomorphService } from "../service/geomorph";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Floor(props) {
  const api = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    draw(gmKey) {
      const img = api.floorImg[gmKey];
      const { floor: [floorCt, , { width, height }], layout } = api.gmClass[gmKey];
      const { pngRect } = layout;

      floorCt.clearRect(0, 0, width, height);
      floorCt.drawImage(img, 0, 0);

      // obstacles drop shadows
      const scale = 1 / worldScale;
      floorCt.setTransform(scale, 0, 0, scale, -pngRect.x * scale, -pngRect.y * scale);
      // avoid doubling shadows e.g. bunk bed, overlapping tables
      const shadowPolys = Poly.union(layout.obstacles.flatMap(x =>
        x.origPoly.meta['no-shadow'] ? [] : x.origPoly.clone().applyMatrix(tmpMat1.setMatrixValue(x.transform))
      ));
      drawPolygons(floorCt, shadowPolys, ['rgba(0, 0, 0, 0.5)', null]);

      // 🚧 debug decor
      floorCt.setTransform(scale, 0, 0, scale, -pngRect.x * scale, -pngRect.y * scale);
      layout.decor.forEach((decor) => {
        if (decor.type === 'circle') {
          drawCircle(floorCt, decor.center, decor.radius, [null, '#500', 0.04]);
        }
      });

      floorCt.resetTransform();

      const { floor: [, floor] } = api.gmClass[gmKey];
      floor.needsUpdate = true;
    },
  }));

  api.floor = state;

  React.useEffect(() => {
    // (a) ensure initial draw (b) redraw onchange this file
    geomorphService.gmKeys.forEach(gmKey => api.floorImg[gmKey] && state.draw(gmKey));
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
 * @property {(gmKey: Geomorph.GeomorphKey) => void} draw
 */

const tmpMat1 = new Mat();
