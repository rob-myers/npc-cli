import React from "react";
import * as THREE from "three";

import { Mat, Vect } from "../geom";
import { wallHeight } from "../service/const";
import { quadGeometryXY } from "../service/three";
import { geomorphService } from "../service/geomorph";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Walls(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    wallsInst: /** @type {*} */ (null),

    decodeWallInstanceId(instanceId) {
      let foundWallSegId = instanceId;
      const foundGmId = w.gmsData.wallPolySegCounts.findIndex(
        segCount => foundWallSegId < segCount ? true : (foundWallSegId -= segCount, false)
      );
      const gm = w.gms[foundGmId];
      const foundWallId = w.gmsData[gm.key].wallPolySegCounts.findIndex(
        segCount => foundWallSegId < segCount ? true : (foundWallSegId -= segCount, false)
      );
      const wall = gm.walls[foundWallId];
      // console.log({ foundGmId, foundWallId })
      return { gmId: foundGmId, ...wall.meta, instanceId };
    },
    getWallMat([u, v], transform, height, baseHeight) {
      tmpMat1.feedFromArray(transform);
      [tmpVec1.copy(u), tmpVec2.copy(v)].forEach(x => tmpMat1.transformPoint(x));
      const rad = Math.atan2(tmpVec2.y - tmpVec1.y, tmpVec2.x - tmpVec1.x);
      const len = u.distanceTo(v);
      return geomorphService.embedXZMat4(
        [len * Math.cos(rad), len * Math.sin(rad), -Math.sin(rad), Math.cos(rad), tmpVec1.x, tmpVec1.y],
        { yScale: height ?? wallHeight, yHeight: baseHeight, mat4: tmpMatFour1 },
      );
    },
    onPointerDown(e) {
      w.events.next(w.ui.getNpcPointerEvent({
        key: "pointerdown",
        distancePx: 0,
        event: e,
        is3d: true,
        justLongDown: false,
        meta: {
          ...state.decodeWallInstanceId(/** @type {number} */ (e.instanceId)),
          ...w.gmGraph.findRoomContaining({ x: e.point.x, y: e.point.z }),
        },
      }));
      e.stopPropagation();
    },
    onPointerUp(e) {
      w.events.next(w.ui.getNpcPointerEvent({
        key: "pointerup",
        event: e,
        is3d: true,
        meta: {
          ...state.decodeWallInstanceId(/** @type {number} */ (e.instanceId)),
          ...w.gmGraph.findRoomContaining({ x: e.point.x, y: e.point.z }),
        },
      }));
      e.stopPropagation();
    },
    positionInstances() {
      const { wallsInst: ws } = state;
      let wId = 0;
      w.gms.forEach(({ key: gmKey, transform }) =>
        w.gmsData[gmKey].wallSegs.forEach(({ seg, meta }) =>
          ws.setMatrixAt(wId++, state.getWallMat(
            seg,
            transform,
            typeof meta.h === 'number' ? meta.h : undefined,
            typeof meta.y === 'number' ? meta.y : undefined,
          ))),
      );
      ws.instanceMatrix.needsUpdate = true;
      ws.computeBoundingSphere();
    },
  }));

  w.wall = state;

  React.useEffect(() => {
    state.positionInstances();
  }, [w.hash, w.gmsData.wallCount]);

  return (
    <instancedMesh
      name="walls"
      key={w.hash}
      ref={instances => instances && (state.wallsInst = instances)}
      args={[quadGeometryXY, undefined, w.gmsData.wallCount]}
      frustumCulled={false}
      onPointerUp={state.onPointerUp}
      onPointerDown={state.onPointerDown}
      >
      <meshBasicMaterial side={THREE.DoubleSide} color="black" />
      {/* <meshBasicMaterial side={THREE.DoubleSide} color="red" wireframe /> */}
    </instancedMesh>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {THREE.InstancedMesh} wallsInst
 *
 * @property {(instanceId: number) => Geom.Meta} decodeWallInstanceId
 * @property {(
 *  seg: [Geom.Vect, Geom.Vect],
 *  transform: Geom.SixTuple,
 *  height?: number,
 *  baseHeight?: number,
 * ) => THREE.Matrix4} getWallMat
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerUp
 * @property {() => void} positionInstances
 */

const tmpVec1 = new Vect();
const tmpVec2 = new Vect();
const tmpMat1 = new Mat();
const tmpMatFour1 = new THREE.Matrix4();
