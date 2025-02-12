import React from "react";
import * as THREE from "three";

import { Mat, Vect } from "../geom";
import { instancedMeshName, wallHeight } from "../service/const";
import { getQuadGeometryXY } from "../service/three";
import { InstancedMonochromeShader } from "../service/glsl";
import { geomorph } from "../service/geomorph";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * @param {Props} props
 */
export default function Walls(props) {
  const w = React.useContext(WorldContext);

  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    inst: /** @type {*} */ (null),
    quad: getQuadGeometryXY(`${w.key}-walls-xy`),
    opacity: 0.5,

    decodeInstanceId(instanceId) {
      // compute gmId, gmData.wallSegs[wallSegsId]
      let wallSegsId = instanceId;
      const gmId = w.gmsData.wallPolySegCounts.findIndex(
        segCount => wallSegsId < segCount ? true : (wallSegsId -= segCount, false)
      );

      const gm = w.gms[gmId];
      const gmData = w.gmsData[gm.key];
      const wallSeg = gmData.wallSegs[wallSegsId];
      const center = wallSeg.seg[0].clone().add(wallSeg.seg[1]).scale(0.5);
      const roomId = w.gmsData.findRoomIdContaining(gm, center, true);
      
      /**
       * Find `gm.walls[wallId][wallSegId]` _or_ lintel (above door) _or_ window,
       * 
       * ```js
       * gmData.wallPolySegCounts ~ [
       *   ...wallSegCounts,
       *   lintelSegCounts,
       *   ...windowSegCounts
       * ]
       * ```
       */
      let wallSegId = wallSegsId;
      const wallId = gmData.wallPolySegCounts.findIndex(
        segCount => wallSegId < segCount ? true : (wallSegId -= segCount, false)
      );
      const wall = gm.walls[wallId];

      if (wall !== undefined) {
        return { gmId, ...wall.meta, roomId, instanceId };
      }
      
      if (wallId === gm.walls.length) {
        const doorId = Math.floor(wallSegId / 2); // 2 lintels per door
        return { gmId, wall: true, lintel: true, roomId, doorId, instanceId };
      }
      
      let windowSegId = wallId - gm.walls.length;
      const windowId = gm.windows.findIndex(({ poly: { outline } }) => windowSegId < outline.length ? true : (windowSegId -= outline.length, false));

      return { gmId, wall: true, window: true, roomId, windowId, instanceId };
    },
    getWallMat([u, v], transform, determinant, height, baseHeight) {
      tmpMat1.feedFromArray(transform);
      if (determinant > 0) {// (v, u) so outer walls are shown
        [tmpVec1.copy(v), tmpVec2.copy(u)].forEach(x => tmpMat1.transformPoint(x));
      } else {// (u, v) because transform flips
        [tmpVec1.copy(u), tmpVec2.copy(v)].forEach(x => tmpMat1.transformPoint(x));
      }
      const rad = Math.atan2(tmpVec2.y - tmpVec1.y, tmpVec2.x - tmpVec1.x);
      const len = u.distanceTo(v);
      return geomorph.embedXZMat4(
        [len * Math.cos(rad), len * Math.sin(rad), -Math.sin(rad), Math.cos(rad), tmpVec1.x, tmpVec1.y],
        { yScale: height ?? wallHeight, yHeight: baseHeight, mat4: tmpMatFour1 },
      );
    },
    positionInstances() {
      const { inst: ws } = state;
      let instanceId = 0;
      const instanceIds = /** @type {number[]} */ ([]);

      w.gms.forEach(({ key: gmKey, transform, determinant }, gmId) =>
        w.gmsData[gmKey].wallSegs.forEach(({ seg, meta }) => {
          ws.setMatrixAt(instanceId, state.getWallMat(
            seg,
            transform,
            determinant,
            typeof meta.h === 'number' ? meta.h : undefined,
            typeof meta.y === 'number' ? meta.y : undefined,
          ));
          instanceIds.push(instanceId++);
      }),
      );
      
      state.quad.setAttribute('instanceIds', new THREE.InstancedBufferAttribute(new Uint32Array(instanceIds), 1));
      ws.computeBoundingSphere();
      ws.instanceMatrix.needsUpdate = true;
    },
    setOpacity(opacity) {
      state.opacity = Math.min(Math.max(0, opacity), 1);
      update();
    },
  }));

  w.wall = state;

  const transparent = state.opacity !== 1;

  React.useEffect(() => {
    state.positionInstances();
  }, [w.mapKey, w.hash.full, w.gmsData.wallCount, w.gmsData]);

  return (
    <instancedMesh
      name={instancedMeshName.walls}
      key={`${[w.mapKey, w.hash.full]}`}
      ref={instances => instances && (state.inst = instances)}
      args={[state.quad, undefined, w.gmsData.wallCount]}
      frustumCulled={false}
      // ℹ️ for transparency
      renderOrder={transparent ? 2 : undefined}
    >
      {/* <meshBasicMaterial side={THREE.DoubleSide} color="#866" wireframe /> */}
      <instancedMonochromeShader
        key={InstancedMonochromeShader.key}
        diffuse={[0, 0, 0]}
        // ℹ️ for transparency
        depthWrite={!transparent}
        transparent={transparent}
        opacity={state.opacity}
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
 * @property {(instanceId: number) => Meta} decodeInstanceId
 * @property {(
 *  seg: [Geom.Vect, Geom.Vect],
 *  transform: Geom.SixTuple,
 *  determinant: number,
 *  height?: number,
 *  baseHeight?: number,
 * ) => THREE.Matrix4} getWallMat
 * @property {() => void} positionInstances
 * @property {(opacity: number) => void} setOpacity
 */

const tmpVec1 = new Vect();
const tmpVec2 = new Vect();
const tmpMat1 = new Mat();
const tmpMatFour1 = new THREE.Matrix4();
