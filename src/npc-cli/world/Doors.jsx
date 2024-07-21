import React from "react";
import * as THREE from "three";
import { damp } from "maath/easing"

import { Mat, Vect } from "../geom";
import { wallHeight } from "../service/const";
import * as glsl from "../service/glsl";
import { quadGeometryXY } from "../service/three";
import { geomorphService } from "../service/geomorph";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Doors(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    doorsInst: /** @type {*} */ (null),
    byInstId: [],
    byKey: {},
    byGmId: {},
    movingDoors: new Map(),

    addDoorUvs() {
      const { decor, decorDim } = w.geomorphs.sheet;
      const uvOffsets = /** @type {number[]} */ ([]);
      const uvDimensions = /** @type {number[]} */ ([]);
  
      state.byInstId.forEach((meta, _instanceId) => {
        // 🚧 remove hard-coding
        const key = meta.door.meta.hull ? 'door--hull' : 'door--standard';
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
      let instId = 0;
      const prevDoorByKey = state.byKey;
      state.byKey = {};
      state.byInstId = [];
      w.gms.forEach((gm, gmId) => {
        const byGmId = state.byGmId[gmId] = /** @type {Geomorph.DoorState[]} */ ([]);
        gm.doors.forEach((door, doorId) => {
          const { seg: [u, v], normal } = door;
          tmpMat1.feedFromArray(gm.transform);
          tmpMat1.transformPoint(tmpVec1.copy(u));
          tmpMat1.transformPoint(tmpVec2.copy(v));
          const radians = Math.atan2(tmpVec2.y - tmpVec1.y, tmpVec2.x - tmpVec1.x);
          
          const gmDoorKey = /** @type {const} */ (`g${gmId}d${doorId}`);
          const prev = prevDoorByKey[gmDoorKey];
          state.byKey[gmDoorKey] = state.byInstId[instId] = byGmId[doorId] = {
            key: gmDoorKey,
            gmId, doorId, door,
            instanceId: instId,
            open : prev?.open ?? false,
            ratio: prev?.ratio ?? 1, // closed ~ ratio 1 i.e. maximal door length
            src: tmpVec1.json,
            dir: { x : Math.cos(radians), y: Math.sin(radians) }, // 🚧 provide in Connector
            normal: tmpMat1.transformSansTranslate(normal.clone()),
            segLength: u.distanceTo(v),
          };
          instId++;
        })
      });
    },
    decodeDoorInstanceId(instanceId) {
      let doorId = instanceId;
      const gmId = w.gms.findIndex((gm) => (
        doorId < gm.doors.length ? true : (doorId -= gm.doors.length, false)
      ));
      const { meta } = w.gms[gmId].doors[doorId];
      return { gmId, doorId, ...meta, instanceId};
    },
    getDoorMat(meta) {
      const { src, dir, ratio, segLength, door, normal } = meta;
      const length = segLength * ratio;

      // Hull doors are moved inside (`normal` points outside)
      const offsetX = door.meta.hull ? door.baseRect.height/2 * -normal.x : 0;
      const offsetY = door.meta.hull ? door.baseRect.height/2 * -normal.y : 0;

      return geomorphService.embedXZMat4(
        [length * dir.x, length * dir.y, -dir.y, dir.x, src.x + offsetX, src.y + offsetY],
        { yScale: wallHeight, mat4: tmpMatFour1 },
      );
    },
    getOpenIds(gmId) {
      return state.byGmId[gmId].flatMap((item, doorId) => item.open ? doorId : []);
    },
    isOpen(gmId, doorId) {
      return this.byGmId[gmId][doorId].open;
    },
    onPointerDown(e) {
      w.events.next(w.ui.getNpcPointerEvent({
        key: "pointerdown",
        distancePx: 0,
        event: e,
        is3d: true,
        justLongDown: false,
        meta: state.decodeDoorInstanceId(/** @type {number} */ (e.instanceId)),
      }));
      e.stopPropagation();
    },
    onPointerUp(e) {
      w.events.next(w.ui.getNpcPointerEvent({
        key: "pointerup",
        event: e,
        is3d: true,
        meta: state.decodeDoorInstanceId(/** @type {number} */ (e.instanceId)),
      }));
      e.stopPropagation();
    },
    onTick() {
      if (state.movingDoors.size === 0) {
        return;
      }
      const deltaMs = w.timer.getDelta();
      const { instanceMatrix } = state.doorsInst;

      for (const [instanceId, meta] of state.movingDoors.entries()) {
        const dstRatio = meta.open ? 0.1 : 1;
        damp(meta, 'ratio', dstRatio, 0.1, deltaMs);
        const length = meta.ratio * meta.segLength;
        // set e1 (x,,z)
        instanceMatrix.array[instanceId * 16 + 0] = meta.dir.x * length;
        instanceMatrix.array[instanceId * 16 + 2] = meta.dir.y * length;
        // translate
        // 🚧 must slide "into wall", or fade, or texture compatible with "crumpling"
        // instanceMatrix.array[instanceId * 16 + 12 + 0] = meta.src.x + meta.dir.x * ((1 - meta.ratio) * meta.segLength);
        // instanceMatrix.array[instanceId * 16 + 12 + 2] = meta.src.y + meta.dir.y * ((1 - meta.ratio) * meta.segLength);
        if (meta.ratio === dstRatio) state.movingDoors.delete(instanceId);
      }
      instanceMatrix.needsUpdate = true;
    },
    toggleDoor(instanceId) {
      const doorMeta = state.byInstId[instanceId];
      doorMeta.open = !doorMeta.open;
      state.movingDoors.set(doorMeta.instanceId, doorMeta);
    },
    positionInstances() {
      const { doorsInst: ds } = state;
      Object.values(state.byKey).forEach(meta =>
        ds.setMatrixAt(meta.instanceId, state.getDoorMat(meta))
      );
      ds.instanceMatrix.needsUpdate = true;
      ds.computeBoundingSphere();
    },
  }));

  w.door = state;

  React.useEffect(() => {
    state.buildLookups();
    state.positionInstances();
    state.addDoorUvs();
  }, [w.hash, w.gmsData.doorCount]);

  return (
    <instancedMesh
      name="doors"
      key={w.hash}
      ref={instances => instances && (state.doorsInst = instances)}
      args={[quadGeometryXY, undefined, w.gmsData.doorCount]}
      frustumCulled={false}
      onPointerUp={state.onPointerUp}
      onPointerDown={state.onPointerDown}
    >
      <instancedSpriteSheetMaterial
        key={glsl.InstancedSpriteSheetMaterial.key}
        side={THREE.DoubleSide}
        map={w.decorTex.tex}
        transparent
        diffuse={new THREE.Vector3(0.6, 0.6, 0.6)}
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
 * @property {THREE.InstancedMesh} doorsInst
 * @property {{ [gmId in number]: Geomorph.DoorState[] }} byGmId
 * @property {Geomorph.DoorState[]} byInstId e.g. `doorByInstId[instanceId]`
 * @property {{ [gmDoorId in `g${number}d${number}`]: Geomorph.DoorState }} byKey
 * gmDoorKey format `g${gmId}d${doorId}`
 * @property {Map<number, Geomorph.DoorState>} movingDoors To be animated until they open/close.
*
* @property {() => void} addDoorUvs
* @property {() => void} buildLookups
 * @property {(instanceId: number) => Geom.Meta} decodeDoorInstanceId
 * @property {(meta: Geomorph.DoorState) => THREE.Matrix4} getDoorMat
 * @property {(gmId: number) => number[]} getOpenIds Get gmDoorKeys of open doors
 * @property {(gmId: number, doorId: number) => boolean} isOpen
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerUp
 * @property {(instanceId: number) => void} toggleDoor
 * @property {() => void} onTick
 * @property {() => void} positionInstances
 */

const tmpVec1 = new Vect();
const tmpVec2 = new Vect();
const tmpMat1 = new Mat();
const tmpMatFour1 = new THREE.Matrix4();

