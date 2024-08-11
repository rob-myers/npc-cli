import React from "react";
import * as THREE from "three";
import { damp } from "maath/easing"

import { Mat, Vect } from "../geom";
import { defaultDoorCloseMs, doorDepth, doorHeight, doorLockedColor, doorUnlockedColor, hullDoorDepth } from "../service/const";
import * as glsl from "../service/glsl";
import { boxGeometry, getColor, getQuadGeometryXY } from "../service/three";
import { geomorphService } from "../service/geomorph";
import { geom } from "../service/geom";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Doors(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    byKey: {},
    byGmId: {},
    byPos: {},
    doorsInst: /** @type {*} */ (null),
    lockSigInst: /** @type {*} */ (null),
    movingDoors: new Map(),
    npcToAccess: {},
    npcToNearby: {},

    addDoorUvs() {
      const { decor, decorDim } = w.geomorphs.sheet;
      const uvOffsets = /** @type {number[]} */ ([]);
      const uvDimensions = /** @type {number[]} */ ([]);
  
      for (const meta of Object.values(state.byKey)) {
        /** @type {Geomorph.DecorImgKey} */
        const key = meta.door.meta.hull ? 'door--hull' : 'door--standard';
        const { x, y, width, height } = decor[key];
        uvOffsets.push(x / decorDim.width, y / decorDim.height);
        uvDimensions.push(width / decorDim.width, height / decorDim.height);
      }

      state.doorsInst.geometry.setAttribute('uvOffsets',
        new THREE.InstancedBufferAttribute( new Float32Array( uvOffsets ), 2 ),
      );
      state.doorsInst.geometry.setAttribute('uvDimensions',
        new THREE.InstancedBufferAttribute( new Float32Array( uvDimensions ), 2 ),
      );
    },
    buildLookups() {
      let instId = 0;
      const prevDoorByPos = state.byPos;
      state.byKey = {};
      state.byPos = {};
      w.gms.forEach((gm, gmId) => {
        const byGmId = state.byGmId[gmId] = /** @type {Geomorph.DoorState[]} */ ([]);
        gm.doors.forEach((door, doorId) => {
          const { seg: [u, v], normal, center } = door;
          tmpMat1.feedFromArray(gm.transform);
          tmpMat1.transformPoint(tmpVec1.copy(u));
          tmpMat1.transformPoint(tmpVec2.copy(v));
          const radians = Math.atan2(tmpVec2.y - tmpVec1.y, tmpVec2.x - tmpVec1.x);
          
          const gdKey = /** @type {const} */ (`g${gmId}d${doorId}`);
          const posKey = /** @type {const} */ (`${center.x},${center.y}`);

          const prev = prevDoorByPos[posKey];
          const hull = gm.isHullDoor(doorId);

          state.byKey[gdKey] = state.byPos[posKey] = byGmId[doorId] = {
            gdKey, gmId, doorId,
            instanceId: instId,
            door,

            // auto: prev?.auto ?? (door.meta.auto === true),
            auto: true,
            locked: prev?.locked ?? (door.meta.locked === true),
            open : prev?.open ?? false,
            sealed: hull === true
              ? w.gmGraph.getDoorNodeById(gmId, doorId).sealed
              : door.meta.sealed === true,
            hull,

            ratio: prev?.ratio ?? 1, // 1 means closed
            src: tmpVec1.json,
            dst: tmpVec2.json,
            dir: { x : Math.cos(radians), y: Math.sin(radians) },
            normal: tmpMat1.transformSansTranslate(normal.clone()),
            segLength: u.distanceTo(v),

            nearbyNpcKeys: new Set(),
            unlockNpcKeys: new Set(),
          };
          instId++;
        })
      });
    },
    canAccess(npcKey, gdKey) {
      return Array.from(
        state.npcToAccess[npcKey] ?? []
      ).some(prefix => gdKey.startsWith(prefix));
    },
    cancelClose(door) {
      window.clearTimeout(door.closeTimeoutId);
      delete door.closeTimeoutId;
      // // cancel other hull door too
      // const adjHull = door.hull === true ? w.gmGraph.getAdjacentRoomCtxt(door.gmId, door.doorId) : null;
      // if (adjHull !== null) {
      //   state.cancelClose(state.byGmId[adjHull.adjGmId][adjHull.adjDoorId]);
      // }
    },
    decodeDoorInstance(instanceId) {
      let doorId = instanceId;
      const gmId = w.gms.findIndex((gm) => (
        doorId < gm.doors.length ? true : (doorId -= gm.doors.length, false)
      ));
      const { meta } = w.gms[gmId].doors[doorId];
      return { ...w.lib.getGmDoorId(gmId, doorId), ...meta, instanceId };
    },
    getDoorMat(meta) {
      const { src, dir, ratio, segLength, door, normal } = meta;
      const length = segLength * ratio;

      // Hull doors are moved inside (`normal` points outside)
      const offsetX = door.meta.hull ? door.baseRect.height/2 * -normal.x : 0;
      const offsetY = door.meta.hull ? door.baseRect.height/2 * -normal.y : 0;

      return geomorphService.embedXZMat4(
        [length * dir.x, length * dir.y, -dir.y, dir.x, src.x + offsetX, src.y + offsetY],
        { yScale: doorHeight, mat4: tmpMatFour1 },
      );
    },
    getLockSigMat(meta) {
      const center = tmpVec1.copy(meta.src).add(meta.dst).scale(1/2);
      const sx = 0.4;
      const sz = (meta.hull ? hullDoorDepth : doorDepth) + 0.025 * 2;
      return geomorphService.embedXZMat4(
        [sx * meta.dir.x, sx * meta.dir.y, sz * meta.normal.x, sz * meta.normal.y, center.x, center.y],
        { yScale: 0.1 / 2, yHeight: doorHeight + 0.1, mat4: tmpMatFour1 },
      );
    },
    getOpenIds(gmId) {
      return state.byGmId[gmId].flatMap((item, doorId) => item.open ? doorId : []);
    },
    isOpen(gmId, doorId) {
      return this.byGmId[gmId][doorId].open;
    },
    npcNearDoor(npcKey, gmId, doorId, ) {
      const npc = w.npc.getNpc(npcKey);
      const position = npc.getPosition();
      const gm = w.gms[gmId];
      const center = gm.inverseMatrix.transformPoint({ x: position.x, y: position.z });
      return geom.circleIntersectsConvexPolygon(center, npc.getRadius(), gm.doors[doorId].poly);
    },
    onPointerDown(e) {
      w.events.next(w.ui.getNpcPointerEvent({
        key: "pointerdown",
        distancePx: 0,
        event: e,
        is3d: true,
        justLongDown: false,
        meta: state.decodeDoorInstance(/** @type {number} */ (e.instanceId)),
      }));
      e.stopPropagation();
    },
    onPointerUp(e) {
      w.events.next(w.ui.getNpcPointerEvent({
        key: "pointerup",
        event: e,
        is3d: true,
        meta: state.decodeDoorInstance(/** @type {number} */ (e.instanceId)),
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
    positionInstances() {
      const { doorsInst: ds, lockSigInst: ls } = state;
      for (const meta of Object.values(state.byKey)) {
        ds.setMatrixAt(meta.instanceId, state.getDoorMat(meta));
        ls.setMatrixAt(meta.instanceId, state.getLockSigMat(meta));
        ls.setColorAt(meta.instanceId, getColor(meta.locked ? doorLockedColor : doorUnlockedColor));
      }
      ds.instanceMatrix.needsUpdate = true;
      ls.instanceMatrix.needsUpdate = true;
      if (ls.instanceColor !== null) {
        ls.instanceColor.needsUpdate = true;
      }
      ds.computeBoundingSphere();
      ls.computeBoundingSphere();
    },
    removeFromSensors(npcKey) {
      for (const gmDoorKey of state.npcToNearby[npcKey] ?? []) {
        const door = state.byKey[gmDoorKey];
        door.nearbyNpcKeys.delete(npcKey);
        if (door.auto === true && door.nearbyNpcKeys.size === 0) {
          state.tryCloseDoor(door.gmId, door.doorId);
        }
      }
      state.npcToNearby[npcKey]?.clear();
    },
    toggleDoorRaw(door, opts = {}) {
      if (door.sealed === true) {
        return false;
      }
      if (typeof opts.npcKey === 'string' && !state.npcNearDoor(opts.npcKey, door.gmId, door.doorId)) {
        return door.open;
      }
      
      state.cancelClose(door); // Cancel any pending close

      if (door.open === true) {// was open
        if (opts.open) {
          state.tryCloseDoor(door.gmId, door.doorId); // Reset door close
          return true;
        }
        if (door.nearbyNpcKeys.size > 0) {
          return true;
        }
      } else {// was closed
        if (opts.close === true) {
          return false;
        }
        if (door.locked === true && opts.npcKey && !door.unlockNpcKeys.has(opts.npcKey)) {
          // Ignore locks if opts.npcKey unspecified
          return false; // Cannot open door if locked
        }
      }

      // Actually open/close door
      door.open = !door.open;
      state.movingDoors.set(door.instanceId, door);
      w.events.next({
        key: door.open ? 'opened-door' : 'closed-door',
        gmId: door.gmId, doorId: door.doorId, npcKey: opts.npcKey,
      });

      if (door.auto === true && door.open === true) { 
        state.tryCloseDoor(door.gmId, door.doorId);
      }

      return door.open;
    },
    toggle(opts) {
      if ('gdKey' in opts) {
        return state.toggleDoorRaw(state.byKey[opts.gdKey], opts);
      }
      if ('gmId' in opts) {
        return state.toggleDoorRaw(state.byGmId[opts.gmId][opts.doorId], opts);
      }
      throw Error(`${'toggleBy(opts)'} expected "opts.gdKey" or "opts.{gmId,doorId}"`)
    },
    toggleLockRaw(door, { npcKey, lock, unlock } = {}) {
      if (door.sealed === true) {
        return false;
      }

      if (npcKey !== undefined) {
        if (state.npcNearDoor(npcKey, door.gmId, door.doorId) === false) {
          return door.locked; // Too far
        }
        if (state.canAccess(npcKey, door.gdKey) === false) {
          return door.locked; // No access
        }
      }

      if (door.locked === true) {
        if (lock === true) return true; // Already locked
      } else {
        if (unlock === true) return false; // Already unlocked
      }

      // Actually lock/unlock door
      door.locked = !door.locked;
      state.lockSigInst.setColorAt(door.instanceId, getColor(door.locked ? doorLockedColor : doorUnlockedColor));
      /** @type {THREE.InstancedBufferAttribute} */ (state.lockSigInst.instanceColor).needsUpdate = true;

      w.events.next({
        key: door.open ? 'locked-door' : 'unlocked-door',
        gmId: door.gmId, doorId: door.doorId, npcKey,
      });

      return door.locked;
    },
    toggleLock(opts) {
      if ('gdKey' in opts) {
        return state.toggleLockRaw(state.byKey[opts.gdKey], opts);
      }
      if ('gmId' in opts) {
        return state.toggleLockRaw(state.byGmId[opts.gmId][opts.doorId], opts);
      }
      throw Error(`${'toggleLockBy(opts)'} expected "opts.gdKey" or "opts.{gmId,doorId}"`)
    },
    tryCloseDoor(gmId, doorId) {
      const door = state.byGmId[gmId][doorId];
      door.closeTimeoutId = window.setTimeout(() => {
        if (door.open === true) {
          state.toggleDoorRaw(door);
          state.tryCloseDoor(gmId, doorId); // recheck in {ms}
        } else {
          delete door.closeTimeoutId;
        }
      }, defaultDoorCloseMs);
    },
  }));

  w.door = state;

  React.useEffect(() => {
    state.buildLookups();
    state.positionInstances();
    state.addDoorUvs();
  }, [w.hash, w.gmsData.doorCount]);

  return <>
    <instancedMesh
      name="doors"
      key={`${w.hash} doors`}
      ref={instances => instances && (state.doorsInst = instances)}
      args={[getQuadGeometryXY('doors-xy'), undefined, w.gmsData.doorCount]}
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

    <instancedMesh
      name="lock-lights"
      key={`${w.hash} lock-lights`}
      ref={instances => instances && (state.lockSigInst = instances)}
      args={[boxGeometry, undefined, w.gmsData.doorCount]}
      frustumCulled={false}
    >
      <meshDiffuseTestMaterial
        key={glsl.MeshDiffuseTestMaterial.key}
        side={THREE.DoubleSide} // fix flipped gm
        diffuse={[1, 1, 1]}
      />
    </instancedMesh>
  </>;
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {{ [gmId in number]: Geomorph.DoorState[] }} byGmId
 * @property {{ [gmDoorKey in Geomorph.GmDoorKey]: Geomorph.DoorState }} byKey
 * @property {{ [center in `${number},${number}`]: Geomorph.DoorState }} byPos
 * @property {THREE.InstancedMesh} doorsInst
 * @property {THREE.InstancedMesh} lockSigInst
 * @property {Map<number, Geomorph.DoorState>} movingDoors To be animated until they open/close.
 *
 * @property {() => void} addDoorUvs
 * @property {() => void} buildLookups
 * @property {(npcKey: string, gdKey: Geomorph.GmDoorKey) => boolean} canAccess
 * @property {(item: Geomorph.DoorState) => void} cancelClose
 * @property {(instanceId: number) => Geom.Meta} decodeDoorInstance
 * @property {(meta: Geomorph.DoorState) => THREE.Matrix4} getDoorMat
 * @property {(meta: Geomorph.DoorState) => THREE.Matrix4} getLockSigMat
 * @property {(gmId: number) => number[]} getOpenIds Get gmDoorKeys of open doors
 * @property {(gmId: number, doorId: number) => boolean} isOpen
 * @property {(npcKey: string, gmId: number, doorId: number) => boolean} npcNearDoor
 * @property {{ [npcKey: string]: Set<string> }} npcToAccess
 * Prefixes of accessible `Geomorph.GmDoorKey`s
 * @property {{ [npcKey: string]: Set<Geomorph.GmDoorKey> }} npcToNearby
 * `npcToKeys[npcKey]` provides `gmDoorKey`s the npc is within sensor range of
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerUp
 * @property {(npcKey: string) => void} removeFromSensors
 * @property {(door: Geomorph.DoorState, opts?: ToggleDoorOpts) => boolean} toggleDoorRaw
 * @property {(opts: ({gmId: number, doorId: number} | { gdKey: Geomorph.GmDoorKey }) & ToggleLockOpts) => boolean} toggleLock
 * @property {(opts: ({gmId: number, doorId: number} | { gdKey: Geomorph.GmDoorKey }) & ToggleDoorOpts) => boolean} toggle
 * @property {(door: Geomorph.DoorState, opts?: ToggleLockOpts) => boolean} toggleLockRaw
 * @property {(gmId: number, doorId: number) => void} tryCloseDoor
 * Try close door every `N` seconds, starting in `N` seconds.
 * @property {() => void} onTick
 * @property {() => void} positionInstances
 */

const tmpVec1 = new Vect();
const tmpVec2 = new Vect();
const tmpMat1 = new Mat();
const tmpMatFour1 = new THREE.Matrix4();

/**
 * @typedef ToggleDoorOpts
 * @property {boolean} [close] should we close the door?
 * @property {string} [npcKey] initiated via npc?
 * @property {boolean} [open] should we open the door?
 */

/**
 * @typedef ToggleLockOpts
 * @property {boolean} [lock] should we lock the door?
 * @property {string} [npcKey] initiated via npc?
 * @property {boolean} [unlock] should we unlock the door?
 */
