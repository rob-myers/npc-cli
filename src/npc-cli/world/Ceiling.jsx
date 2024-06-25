import React from "react";
import * as THREE from "three";

import { Mat } from "../geom";
import { wallHeight, worldScale } from "../service/const";
import { keys } from "../service/generic";
import { drawPolygons, strokeLine } from "../service/dom";
import { quadGeometryXZ } from "../service/three";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Ceiling(props) {
  const api = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    drawGmKey(gmKey) {
      const { ceil: [ceilCt, ceilTex, { width, height }], layout } = api.gmClass[gmKey];
      const { pngRect } = layout;
      const scale = 1 / worldScale;

      ceilCt.clearRect(0, 0, width, height);
      ceilCt.setTransform(scale, 0, 0, scale, -pngRect.x * scale, -pngRect.y * scale);
      const color = 'rgba(80, 80, 80, 1)';

      // wall tops (stroke gaps e.g. bridge desk)
      // drawPolygons(ceilCt, layout.walls, ['rgba(50, 50, 50, 1)', null])
      const wallsTouchingCeil = layout.walls.filter(x =>
        x.meta.h === undefined || (x.meta.y + x.meta.h === wallHeight)
      );
      drawPolygons(ceilCt, wallsTouchingCeil, [color, color, 0.06])
      // door tops
      ceilCt.lineWidth = 0.03;
      drawPolygons(ceilCt, layout.doors.map(x => x.poly), [color, color])

      ceilCt.resetTransform();
      ceilTex.needsUpdate = true;
    },
  }));

  api.ceil = state;

  React.useEffect(() => {// ensure initial + redraw on HMR
    keys(api.gmClass).forEach(gmKey => state.drawGmKey(gmKey));
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
 * @property {(gmKey: Geomorph.GeomorphKey) => void} drawGmKey
 */

const tmpMat1 = new Mat();
