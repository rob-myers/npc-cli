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
    wallsInst: /** @type {*} */ (null),

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
      
      // compute gm.walls[wallId][wallSegId]
      let wallSegId = wallSegsId;
      const wallId = gmData.wallPolySegCounts.findIndex(
        segCount => wallSegId < segCount ? true : (wallSegId -= segCount, false)
      );
      const wall = gm.walls[wallId];

      if (wall !== undefined) {
        return { gmId, ...wall.meta, roomId, instanceId };
      } else {
        const doorId = Math.floor(wallSegId / 2); // 2 lintels per door
        return { gmId, wall: true, lintel: true, roomId, doorId, instanceId };
      }
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
    onPointerDown(e) {
      w.events.next(w.ui.getNpcPointerEvent({
        key: "pointerdown",
        distancePx: 0,
        event: e,
        is3d: true,
        justLongDown: false,
        meta: {
          ...state.decodeInstanceId(/** @type {number} */ (e.instanceId)),
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
          ...state.decodeInstanceId(/** @type {number} */ (e.instanceId)),
          ...w.gmGraph.findRoomContaining({ x: e.point.x, y: e.point.z }),
        },
      }));
      e.stopPropagation();
    },
    positionInstances() {
      const { wallsInst: ws } = state;
      let wId = 0;
      let instanceId = 0;
      const attributeGmIds = /** @type {number[]} */ ([]);
      /** `[0, 1, 2, ... , instanceCount - 1]` */
      const attributeInstanceIds = /** @type {number[]} */ ([]);

      w.gms.forEach(({ key: gmKey, transform }, gmId) =>
        w.gmsData[gmKey].wallSegs.forEach(({ seg, meta }) => {
          attributeGmIds.push(gmId);
          attributeInstanceIds.push(instanceId++);
          ws.setMatrixAt(wId++, state.getWallMat(
            seg,
            transform,
            typeof meta.h === 'number' ? meta.h : undefined,
            typeof meta.y === 'number' ? meta.y : undefined,
          ));
      }),
      );
      ws.instanceMatrix.needsUpdate = true;
      ws.computeBoundingSphere();

      ws.geometry.setAttribute('gmId', new THREE.InstancedBufferAttribute(new Int32Array(attributeGmIds), 1));
      ws.geometry.setAttribute('instanceId', new THREE.InstancedBufferAttribute(new Int32Array(attributeInstanceIds), 1));
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
      ref={instances => instances && (state.wallsInst = instances)}
      args={[getQuadGeometryXY('walls-xy'), undefined, w.gmsData.wallCount]}
      frustumCulled={false}
      onPointerUp={state.onPointerUp}
      onPointerDown={state.onPointerDown}
      // position={[0, 0.002, 0]}
    >
      {/* <meshBasicMaterial side={THREE.DoubleSide} color="black" /> */}
      {/* <meshBasicMaterial side={THREE.DoubleSide} color="#866" wireframe /> */}
      {/* <instancedMonochromeShader key={InstancedMonochromeShader.key} side={THREE.DoubleSide} diffuse={[0, 0, 0]} objectPick={true} /> */}
      <instancedMonochromeShader
        key={InstancedMonochromeShader.key}
        side={THREE.DoubleSide}
        diffuse={[0.0, 0.0, 0.0]}
        objectPick={false}
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
 * @property {THREE.InstancedMesh} wallsInst
 *
 * @property {(instanceId: number) => Geom.Meta} decodeInstanceId
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
