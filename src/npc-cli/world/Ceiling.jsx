import React from "react";
import * as THREE from "three";

import { Mat, Poly } from "../geom";
import { wallHeight, gmFloorExtraScale, worldToSguScale, sguToWorldScale, instancedMeshName } from "../service/const";
import { pause } from "../service/generic";
import { drawPolygons } from "../service/dom";
import { getQuadGeometryXZ } from "../service/three";
import { InstancedMultiTextureMaterial } from "../service/glsl";
import { geomorph } from "../service/geomorph";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Ceiling(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    inst: /** @type {*} */ (null),
    quad: getQuadGeometryXZ(`${w.key}-multi-tex-ceiling-xz`),
    opacity: 0.7,

    async draw() {
      w.menu.measure('ceil.draw');
      for (const [texId, gmKey] of w.gmsData.seenGmKeys.entries()) {
        state.drawGm(gmKey);
        w.texCeil.updateIndex(texId);
        await pause();
      }
      w.texCeil.update();
      w.menu.measure('ceil.draw');
    },
    drawGm(gmKey) {
      const { ct } = w.texCeil;
      const layout = w.geomorphs.layout[gmKey];
      const { pngRect } = layout;

      ct.resetTransform();
      ct.clearRect(0, 0, ct.canvas.width, ct.canvas.height);

      const worldToCanvas = worldToSguScale * gmFloorExtraScale;
      ct.setTransform(worldToCanvas, 0, 0, worldToCanvas, -pngRect.x * worldToCanvas, -pngRect.y * worldToCanvas);
      
      const { tops, polyDecals } = w.gmsData[gmKey];
      
      // wall/door tops
      const black = 'black';
      const grey90 = 'rgb(90, 90, 90)';
      const wallsColor = '#333';
      const thinLineWidth = 0.04;
      const thickLineWidth = 0.06;

      drawPolygons(ct, tops.nonHull, ['#666', '#001', thickLineWidth]);
      drawPolygons(ct, tops.window, [black, wallsColor, thinLineWidth]);
      drawPolygons(ct, tops.broad, [black, grey90, thinLineWidth]);
      
      // decals
      polyDecals.filter(x => x.meta.ceil === true).forEach(x => {
        const strokeWidth = typeof x.meta.strokeWidth === 'number'
          ? x.meta.strokeWidth * sguToWorldScale
          : 0.08;
        drawPolygons(ct, x, [x.meta.fill || 'red', x.meta.stroke || null, strokeWidth]);
        // drawPolygons(ct, x, ['red', 'white', 0.08]);
      });

      drawPolygons(ct, tops.hull, [black, wallsColor, thickLineWidth]); // hull walls and doors
      
      // Stroke a square at each corner to avoid z-fighting
      const hullRect = layout.hullPoly[0].rect;
      const cornerDim = 8 * sguToWorldScale;
      ct.lineWidth = 0.02;
      ct.strokeRect(hullRect.x, hullRect.y, cornerDim, cornerDim);
      ct.strokeRect(hullRect.right - cornerDim, hullRect.y, cornerDim, cornerDim);
      ct.strokeRect(hullRect.x, hullRect.bottom - cornerDim, cornerDim, cornerDim);
      ct.strokeRect(hullRect.right - cornerDim, hullRect.bottom - cornerDim, cornerDim, cornerDim);

    },
    positionInstances() {
      for (const [gmId, gm] of w.gms.entries()) {
        const mat = (new Mat([gm.pngRect.width, 0, 0, gm.pngRect.height, gm.pngRect.x, gm.pngRect.y])).postMultiply(gm.matrix);
        // if (mat.determinant < 0) mat.preMultiply([-1, 0, 0, 1, 1, 0])
        state.inst.setMatrixAt(gmId, geomorph.embedXZMat4(mat.toArray()));
      }
      state.inst.instanceMatrix.needsUpdate = true;
      state.inst.computeBoundingSphere();
    },
  }));

  w.ceil = state;
  const { tex } = w.texCeil;

  React.useEffect(() => {
    state.positionInstances();
    state.draw().then(() => w.update());
  }, [w.mapKey, w.hash.full, w.texVs.ceiling]);

  return (
    <instancedMesh
      name={instancedMeshName.ceiling}
      ref={instances => void (instances && (state.inst = instances))}
      args={[w.floor.quad, undefined, w.gms.length]} // 🔔 reuse floor quad
      position={[0, wallHeight, 0]}
      renderOrder={3}
    >
      {/* <meshBasicMaterial color="red" side={THREE.DoubleSide} /> */}
      <instancedMultiTextureMaterial
        key={InstancedMultiTextureMaterial.key}
        side={THREE.DoubleSide}
        transparent
        atlas={tex}
        alphaTest={0.5} opacity={state.opacity} depthWrite={false}
        diffuse={[1, 1, 1]}
        colorSpace
        objectPickRed={3}
      />
    </instancedMesh>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {THREE.InstancedMesh} inst
 * @property {THREE.BufferGeometry} quad
 * @property {number} opacity
 *
 * @property {() => Promise<void>} draw
 * @property {(gmKey: Geomorph.GeomorphKey) => void} drawGm
 * @property {() => void} positionInstances
 */
