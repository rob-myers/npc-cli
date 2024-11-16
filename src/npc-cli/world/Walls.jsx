import React from "react";
import * as THREE from "three";

import { Mat, Vect } from "../geom";
import { wallHeight } from "../service/const";
import { getQuadGeometryXY } from "../service/three";
import { InstancedMonochromeShader } from "../service/glsl";
import { geomorph } from "../service/geomorph";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Walls(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    inst: /** @type {*} */ (null),
    quad: getQuadGeometryXY(`${w.key}-walls-xy`),

    decodeInstanceId(instanceId) {
      // compute gmId, gmData.wallSegs[wallSegsId]
      let wallSegsId = instanceId;
      const gmId = w.gmsData.wallPolySegCounts.findIndex(
        segCount => wallSegsId < segCount ? true : (wallSegsId -= segCount, false)
      );

      const gm = w.gms[gmId];
      const gmData = w.gmsData[gm.key];
      // 🔔 could provide roomId from shader
      const wallSeg = gmData.wallSegs[wallSegsId];
      const center = wallSeg.seg[0].clone().add(wallSeg.seg[1]).scale(0.5);
      const roomId = w.gmsData.findRoomIdContaining(gm, center, true);
      
      /**
       * Find `gm.walls[wallId][wallSegId]` or lintel (above door) or window,
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
    getWallMat([u, v], transform, height, baseHeight) {
      tmpMat1.feedFromArray(transform);
      [tmpVec1.copy(u), tmpVec2.copy(v)].forEach(x => tmpMat1.transformPoint(x));
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

      w.gms.forEach(({ key: gmKey, transform }, gmId) =>
        w.gmsData[gmKey].wallSegs.forEach(({ seg, meta }) => {
          ws.setMatrixAt(instanceId, state.getWallMat(
            seg,
            transform,
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
  }));

  w.wall = state;

  React.useEffect(() => {
    state.positionInstances();
  }, [w.mapKey, w.hash.full, w.gmsData.wallCount, w.gmsData]);

  return (
    <instancedMesh
      name="walls"
      key={`${[w.mapKey, w.hash.full]}`}
      ref={instances => instances && (state.inst = instances)}
      args={[state.quad, undefined, w.gmsData.wallCount]}
      frustumCulled={false}
    >
      {/* <meshBasicMaterial side={THREE.DoubleSide} color="#866" wireframe /> */}
      <instancedMonochromeShader
        key={InstancedMonochromeShader.key}
        side={THREE.DoubleSide}
        diffuse={[0, 0, 0]}
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
 * @property {(instanceId: number) => Geom.Meta} decodeInstanceId
 * @property {(
 *  seg: [Geom.Vect, Geom.Vect],
 *  transform: Geom.SixTuple,
 *  height?: number,
 *  baseHeight?: number,
 * ) => THREE.Matrix4} getWallMat
 * @property {() => void} positionInstances
 */

const tmpVec1 = new Vect();
const tmpVec2 = new Vect();
const tmpMat1 = new Mat();
const tmpMatFour1 = new THREE.Matrix4();
