import React from "react";
import * as THREE from "three";

import { Mat } from "../geom";
import { wallHeight, gmFloorExtraScale, worldToSguScale, sguToWorldScale } from "../service/const";
import { pause } from "../service/generic";
import { drawPolygons } from "../service/dom";
import { emptyDataArrayTexture, getQuadGeometryXZ } from "../service/three";
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

    async draw() {
      w.menu.measure('ceil.draw');
      for (const [texId, gmKey] of w.gmsData.seenGmKeys.entries()) {
        state.drawGmKey(gmKey);
        w.gmsData.texCeil.updateIndex(texId);
        await pause();
      }
      w.gmsData.texCeil.update();
      w.menu.measure('ceil.draw');
    },
    drawGmKey(gmKey) {
      const { ct } = w.gmsData.texCeil;
      const layout = w.geomorphs.layout[gmKey];
      const { pngRect } = layout;

      ct.resetTransform();
      ct.clearRect(0, 0, ct.canvas.width, ct.canvas.height);

      const worldToCanvas = worldToSguScale * gmFloorExtraScale;
      ct.setTransform(worldToCanvas, 0, 0, worldToCanvas, -pngRect.x * worldToCanvas, -pngRect.y * worldToCanvas);
      
      const { tops, polyDecals } = w.gmsData[gmKey];
      
      // wall/door tops
      const black = 'rgb(0, 0, 0)';
      const grey90 = 'rgb(90, 90, 90)';
      const wallsColor = '#888';
      const hullDoorsColor = '#777';
      const grey100 = 'rgb(100, 100, 100)';
      const thinLineWidth = 0.02;
      const thickLineWidth = 0.08;

      drawPolygons(ct, tops.nonHull, [wallsColor, null, thinLineWidth]);
      drawPolygons(ct, tops.door.filter(x => !x.meta.hull), [grey100, null]);
      drawPolygons(ct, tops.door.filter(x => x.meta.hull), [hullDoorsColor, null, thinLineWidth]);
      drawPolygons(ct, tops.broad, [black, grey90, thickLineWidth]);
      const hullWalls = layout.walls.filter(x => x.meta.hull);
      drawPolygons(ct, hullWalls, [wallsColor, wallsColor]);
      // drawPolygons(ct, hullWalls, ['#ddd', '#ddd']);
      
      // decals
      polyDecals.filter(x => x.meta.ceil === true).forEach(x => {
        const strokeWidth = typeof x.meta.strokeWidth === 'number'
          ? x.meta.strokeWidth * sguToWorldScale
          : 0.08;
        drawPolygons(ct, x, [x.meta.fill || 'red', x.meta.stroke || 'white', strokeWidth]);
        // drawPolygons(ct, x, ['red', 'white', 0.08]);
      });
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

  React.useEffect(() => {
    state.draw();
    state.positionInstances();
  }, [w.mapKey, w.hash.full, w.hmr.createGmsData]);

  return (
    <instancedMesh
      name={"multi-tex-ceiling"}
      ref={instances => void (instances && (state.inst = instances))}
      args={[w.floor.quad, undefined, w.gms.length]} // 🔔 reuse floor quad
      position={[0, wallHeight, 0]}
    >
      {/* <meshBasicMaterial color="red" side={THREE.DoubleSide} /> */}
      <instancedMultiTextureMaterial
        key={InstancedMultiTextureMaterial.key}
        side={THREE.DoubleSide}
        transparent
        atlas={w.gmsData.texCeil.tex ?? emptyDataArrayTexture}
        alphaTest={0.5} // 0.5 flickered on (301, 101) border
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
 *
 * @property {() => Promise<void>} draw
 * @property {(gmKey: Geomorph.GeomorphKey) => void} drawGmKey
 * @property {() => void} positionInstances
 */
