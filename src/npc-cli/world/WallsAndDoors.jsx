import React from "react";
import * as THREE from "three";
import { damp } from "maath/easing"

import { Mat, Vect } from "../geom";
import { wallHeight } from "../service/const";
import * as glsl from "../service/glsl";
import { quadGeometryXY } from "../service/three";
import { geomorphService } from "../service/geomorph";
import { isModifierKey, isRMB, isTouchDevice } from "../service/dom";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function WallsAndDoors(props) {
  const api = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    wallsInst: /** @type {*} */ (null),
    doorsInst: /** @type {*} */ (null),

    doorByPos: {},
    doorByInstId: [],
    movingDoors: new Map(),

    addDoorUvs() {
      const { decor, decorDim } = api.geomorphs.sheet;
      const uvOffsets = /** @type {number[]} */ ([]);
      const uvDimensions = /** @type {number[]} */ ([]);
  
      state.doorByInstId.forEach((meta, _instanceId) => {
        // 🚧 remove hard-coding
        const key = meta.door.meta.hull ? 'door-hull-002.png' : 'door-001.png'
        const { x, y, width, height } = decor[key];
        uvOffsets.push(x / decorDim.width, y / decorDim.height);
        uvDimensions.push(width / decorDim.width, height / decorDim.height);
      });

      state.doorsInst.geometry.setAttribute('uvOffsets',
        new THREE.InstancedBufferAttribute( new Float32Array( uvOffsets ), 2 ),
      );
      state.doorsInst.geometry.setAttribute('uvDimensions',
        new THREE.InstancedBufferAttribute( new Float32Array( uvDimensions ), 2 ),
      );
    },
    buildLookups() {
      let dId = 0;
      const prevDoorByPos = state.doorByPos;
      state.doorByPos = {};
      state.doorByInstId = [];
      api.gms.forEach((gm, gmId) => gm.doors.forEach((door, doorId) => {
        const { seg: [u, v] } = door;
        tmpMat1.feedFromArray(gm.transform);
        tmpMat1.transformPoint(tmpVec1.copy(u));
        tmpMat1.transformPoint(tmpVec2.copy(v));
        const radians = Math.atan2(tmpVec2.y - tmpVec1.y, tmpVec2.x - tmpVec1.x);
        const key = /** @type {const} */ (`${tmpVec1.x},${tmpVec1.y}`);
        const prev = prevDoorByPos[key];
        state.doorByPos[key] = state.doorByInstId[dId] = {
          gmId, doorId, door, srcSegKey: key,
          instanceId: dId,
          open : prev?.open ?? false,
          ratio: prev?.ratio ?? 1, // closed ~ ratio 1 i.e. maximal door length
          src: tmpVec1.json,
          dir: { x : Math.cos(radians), y: Math.sin(radians) },
          segLength: u.distanceTo(v),
        };
        dId++;
      }));
    },
    decodeWallInstanceId(instanceId) {
      let foundWallSegId = instanceId;
      const foundGmId = api.gmsData.wallPolySegCounts.findIndex(
        segCount => foundWallSegId < segCount ? true : (foundWallSegId -= segCount, false)
      );
      const gm = api.gms[foundGmId];
      const foundWallId = api.gmsData[gm.key].wallPolySegCounts.findIndex(
        segCount => foundWallSegId < segCount ? true : (foundWallSegId -= segCount, false)
      );
      const wall = gm.walls[foundWallId];
      // console.log({ foundGmId, foundWallId })
      return { gmId: foundGmId, ...wall.meta, instanceId };
    },
    getDoorMat(meta) {
      const { src, dir, ratio, segLength, door } = meta;
      const length = segLength * ratio;

      // Hull doors are offset from each other to avoid z-fighting
      const offsetX = door.meta.hull ? door.baseRect.height/2 * door.normal.x : 0;
      const offsetY = door.meta.hull ? door.baseRect.height/2 * door.normal.y : 0;

      return geomorphService.embedXZMat4(
        [length * dir.x, length * dir.y, -dir.y, dir.x, src.x + offsetX, src.y + offsetY],
        { yScale: wallHeight, mat4: tmpMatFour1 },
      );
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
      const target = /** @type {keyof typeof meshName} */ (e.object.name);
      api.events.next({
        key: "pointerdown",
        is3d: true,
        modifierKey: isModifierKey(e.nativeEvent),
        distancePx: 0,
        justLongDown: false,
        pointers: api.ui.getNumPointers(),
        rmb: isRMB(e.nativeEvent),
        screenPoint: { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
        touch: isTouchDevice(),
        point: e.point,
        meta: {
          ...target === 'doors' && { door: true, instanceId: e.instanceId },
          ...target === 'walls' && state.decodeWallInstanceId(/** @type {number} */ (e.instanceId)),
        },
      });
      e.stopPropagation();
    },
    onPointerUp(e) {
      const target = /** @type {keyof typeof meshName} */ (e.object.name);
      api.events.next({
        key: "pointerup",
        is3d: true,
        modifierKey: isModifierKey(e.nativeEvent),
        distancePx: api.ui.getDownDistancePx(),
        justLongDown: api.ui.justLongDown,
        pointers: api.ui.getNumPointers(),
        rmb: isRMB(e.nativeEvent),
        screenPoint: { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
        touch: isTouchDevice(),
        point: e.point,
        meta: {
          ...target === 'doors' && { door: true, instanceId: e.instanceId },
          ...target === 'walls' && state.decodeWallInstanceId(/** @type {number} */ (e.instanceId)),
        },
      });
      e.stopPropagation();
    },
    onTick() {
      if (state.movingDoors.size === 0) {
        return;
      }
      const deltaMs = api.timer.getDelta();
      const { instanceMatrix } = state.doorsInst;

      for (const [instanceId, meta] of state.movingDoors.entries()) {
        const dstRatio = meta.open ? 0.1 : 1;
        damp(meta, 'ratio', dstRatio, 0.1, deltaMs);
        const length = meta.ratio * meta.segLength;
        // set e1 (x,,z)
        instanceMatrix.array[instanceId * 16 + 0] = meta.dir.x * length;
        instanceMatrix.array[instanceId * 16 + 2] = meta.dir.y * length;
        // // translate
        // // 🚧 hull doors need offset
        // // 🚧 must slide "into wall", or fade, or texture compatible with "crumpling"
        // instanceMatrix.array[instanceId * 16 + 12 + 0] = meta.src.x + meta.dir.x * ((1 - meta.ratio) * meta.segLength);
        // instanceMatrix.array[instanceId * 16 + 12 + 2] = meta.src.y + meta.dir.y * ((1 - meta.ratio) * meta.segLength);
        if (meta.ratio === dstRatio) state.movingDoors.delete(instanceId);
      }
      instanceMatrix.needsUpdate = true;
    },
    toggleDoor(instanceId) {
      const doorMeta = state.doorByInstId[instanceId];
      doorMeta.open = !doorMeta.open;
      state.movingDoors.set(doorMeta.instanceId, doorMeta);
    },
    positionInstances() {
      const { wallsInst: ws, doorsInst: ds } = state;

      let wId = 0;
      api.gms.forEach(({ wallSegs, transform }) =>
        wallSegs.forEach(({ seg, meta }) => ws.setMatrixAt(wId++, state.getWallMat(
          seg,
          transform,
          typeof meta.h === 'number' ? meta.h : undefined,
          typeof meta.y === 'number' ? meta.y : undefined,
        ))),
      );
      ws.instanceMatrix.needsUpdate = true;
      ws.computeBoundingSphere();

      Object.values(state.doorByPos).forEach(meta =>
        ds.setMatrixAt(meta.instanceId, state.getDoorMat(meta))
      );
      ds.instanceMatrix.needsUpdate = true;
      ds.computeBoundingSphere();
    },
  }));

  api.vert = state;

  React.useEffect(() => {
    state.buildLookups();
    state.positionInstances();
    state.addDoorUvs();
  }, [api.hash]);

  return (
    <>
      <instancedMesh
        name={meshName.walls}
        key={`${api.hash} ${meshName.walls}`}
        ref={instances => instances && (state.wallsInst = instances)}
        args={[quadGeometryXY, undefined, api.gmsData.wallCount]}
        frustumCulled={false}
        onPointerUp={state.onPointerUp}
        onPointerDown={state.onPointerDown}
        >
        <meshBasicMaterial side={THREE.DoubleSide} color="black" />
      </instancedMesh>

      <instancedMesh
        name={meshName.doors}
        key={`${api.hash} ${meshName.doors}`}
        ref={instances => instances && (state.doorsInst = instances)}
        args={[quadGeometryXY, undefined, api.gmsData.doorCount]}
        frustumCulled={false}
        onPointerUp={state.onPointerUp}
        onPointerDown={state.onPointerDown}
      >
        <instancedSpriteSheetMaterial
          key={glsl.InstancedSpriteSheetMaterial.key}
          side={THREE.DoubleSide}
          map={api.decorTex}
          transparent
          // diffuse={new THREE.Vector3(1, 0, 1)}
        />
      </instancedMesh>
    </>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {THREE.InstancedMesh} wallsInst
 * @property {THREE.InstancedMesh} doorsInst
 * @property {{ [segSrcKey in `${number},${number}`]: Geomorph.DoorMeta }} doorByPos
 * @property {Geomorph.DoorMeta[]} doorByInstId e.g. `doorByInstId[instanceId]`
 * @property {Map<number, Geomorph.DoorMeta>} movingDoors To be animated until they open/close.
 *
 * @property {() => void} addDoorUvs
 * @property {() => void} buildLookups
 * @property {(instanceId: number) => Geom.Meta} decodeWallInstanceId
 * @property {(meta: Geomorph.DoorMeta) => THREE.Matrix4} getDoorMat
 * @property {(
 *  seg: [Geom.Vect, Geom.Vect],
 *  transform: Geom.SixTuple,
 *  height?: number,
 *  baseHeight?: number,
 * ) => THREE.Matrix4} getWallMat
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerUp
 * @property {(instanceId: number) => void} toggleDoor
 * @property {() => void} onTick
 * @property {() => void} positionInstances
 */

const textureLoader = new THREE.TextureLoader();
const tmpVec1 = new Vect();
const tmpVec2 = new Vect();
const tmpMat1 = new Mat();
const tmpMatFour1 = new THREE.Matrix4();
const tmpMatFour2 = new THREE.Matrix4();

const meshName = /** @type {const} */ ({
  doors: 'doors',
  walls: 'walls',
});
