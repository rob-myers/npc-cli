import React from "react";
import * as THREE from "three";

import { Mat } from "../geom";
import { wallHeight, worldScale } from "../service/const";
import { drawPolygons, strokeLine } from "../service/dom";
import { quadGeometryXZ } from "../service/three";
import { geomorphService } from "../service/geomorph";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Ceiling(props) {
  const api = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    draw(gmKey) {
      const { ceil: [ceilCt, , { width, height }], layout } = api.gmClass[gmKey];
      const { pngRect } = layout;
      const scale = 1 / worldScale;

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

      const { ceil: [, ceil] } = api.gmClass[gmKey];
      ceil.needsUpdate = true;
    },
  }));

  api.ceil = state;

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
 * @property {(gmKey: Geomorph.GeomorphKey) => void} draw
 */

const tmpMat1 = new Mat();
