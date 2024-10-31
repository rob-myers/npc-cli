import React from "react";
import * as THREE from "three";

import { Mat } from "../geom";
import { wallHeight, gmFloorExtraScale, worldToSguScale, sguToWorldScale } from "../service/const";
import { pause } from "../service/generic";
import { drawPolygons } from "../service/dom";
import { emptyDataArrayTexture, getQuadGeometryXZ } from "../service/three";
import { InstancedMultiTextureMaterial } from "../service/glsl";
import { geomorph } from "../service/geomorph";
import { TexArray } from "../service/tex-array";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Ceiling(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    inst: /** @type {*} */ (null),
    quad: getQuadGeometryXZ('multi-tex-ceiling-xz'),

    addUvs() {
      const uvOffsets = /** @type {number[]} */ ([]);
      const uvDimensions = /** @type {number[]} */ ([]);
      const uvTextureIds = /** @type {number[]} */ ([]);

      for (const [gmId, gm] of w.gms.entries()) {
        uvOffsets.push(0, 0);
        // 🔔 edge geomorph 301 pngRect height/width ~ 0.5 (not equal)
        uvDimensions.push(1, geomorph.isEdgeGm(gm.key) ? (gm.pngRect.height / gm.pngRect.width) : 1);
        uvTextureIds.push(w.gmsData.getTextureId(gm.key));
      }

      state.inst.geometry.setAttribute('uvOffsets',
        new THREE.InstancedBufferAttribute(new Float32Array(uvOffsets), 2),
      );
      state.inst.geometry.setAttribute('uvDimensions',
        new THREE.InstancedBufferAttribute(new Float32Array(uvDimensions), 2),
      );
      state.inst.geometry.setAttribute('uvTextureIds',
        new THREE.InstancedBufferAttribute(new Int32Array(uvTextureIds), 1),
      );
    },
    detectClick(e) {// 🚧 replace with object-pick
      // const gmId = Number(e.object.name.slice('ceil-gm-'.length));
      // const gm = w.gms[gmId];
      
      // // 3d point -> local world coords (ignoring y)
      // const mat4 = gm.mat4.clone().invert();
      // const localWorldPnt = e.point.clone().applyMatrix4(mat4);
      // // local world coords -> canvas coords
      // const worldToCanvas = worldToSguScale * gmFloorExtraScale;
      // const canvasX = (localWorldPnt.x - gm.pngRect.x) * worldToCanvas;
      // const canvasY = (localWorldPnt.z - gm.pngRect.y) * worldToCanvas;

      // const { ct } = state.tex[gm.key];
      // const { data: rgba } = ct.getImageData(canvasX, canvasY, 1, 1, { colorSpace: 'srgb' });
      // // console.log(Array.from(rgba), { gmId, point3d: e.point, localWorldPnt, canvasX, canvasY });
      
      // // ignore clicks on fully transparent pixels
      // return rgba[3] === 0 ? null : { gmId };
      return null;
    },
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
      const grey60 = 'rgb(60, 60, 60)';
      const grey100 = 'rgb(100, 100, 100)';
      const thinLineWidth = 0.02;
      const thickLineWidth = 0.08;

      drawPolygons(ct, tops.nonHull, ['#667', null, thinLineWidth]);
      drawPolygons(ct, tops.door.filter(x => !x.meta.hull), [grey100, null]);
      drawPolygons(ct, tops.door.filter(x => x.meta.hull), ['#778', null]);
      drawPolygons(ct, tops.broad, [black, grey90, thickLineWidth]);
      const hullWalls = layout.walls.filter(x => x.meta.hull);
      drawPolygons(ct, hullWalls, ['#667', '#667']);
      
      // decals
      polyDecals.filter(x => x.meta.ceil === true).forEach(x => {
        const strokeWidth = typeof x.meta.strokeWidth === 'number'
          ? x.meta.strokeWidth * sguToWorldScale
          : 0.08;
        drawPolygons(ct, x, [x.meta.fill || 'red', x.meta.stroke || 'white', strokeWidth]);
        // drawPolygons(ct, x, ['red', 'white', 0.08]);
      });
    },
    onPointerDown(e) {
      const result = state.detectClick(e);

      if (result !== null) {
        const { gmId } = result;
        w.events.next(w.ui.getNpcPointerEvent({
          key: "pointerdown",
          event: e,
          is3d: true,
          meta: {
            ceiling: true,
            gmId,
            height: wallHeight,
          },
        }));
        e.stopPropagation();
      }
    },
    onPointerUp(e) {
      const result = state.detectClick(e);

      if (result !== null) {
        const { gmId } = result;
        w.events.next(w.ui.getNpcPointerEvent({
          key: "pointerup",
          event: e,
          is3d: true,
          meta: {
            ceiling: true,
            gmId,
            height: wallHeight,
          },
        }));
        e.stopPropagation();
      }
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
    state.addUvs();
  }, [w.mapKey, w.hash.full, w.hmr.createGmsData]);

  return (
    <instancedMesh
      name={"multi-tex-ceiling"}
      ref={instances => void (instances && (state.inst = instances))}
      args={[state.quad, undefined, w.gms.length]}
      position={[0, wallHeight, 0]}
    >
      {/* <meshBasicMaterial color="red" side={THREE.DoubleSide} /> */}
      <instancedMultiTextureMaterial
        key={InstancedMultiTextureMaterial.key}
        side={THREE.DoubleSide}
        transparent
        atlas={w.gmsData.texCeil.tex ?? emptyDataArrayTexture}
        alphaTest={0.9} // 0.5 flickered on (301, 101) border
        // diffuse={[0.75, 0.75, 0.75]}
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
 * @property {() => void} addUvs
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => null | { gmId: number; }} detectClick
 * @property {() => Promise<void>} draw
 * @property {(gmKey: Geomorph.GeomorphKey) => void} drawGmKey
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerUp
 * @property {() => void} positionInstances
 */
