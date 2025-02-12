import React from "react";
import * as THREE from "three";
import { damp } from "maath/easing"

import { Mat, Vect } from "../geom";
import { doorDepth, doorHeight, doorLockedColor, doorUnlockedColor, hullDoorDepth, instancedMeshName, offMeshConnectionHalfDepth, precision, wallOutset } from "../service/const";
import * as glsl from "../service/glsl";
import { getBoxGeometry, getColor, getQuadGeometryXY } from "../service/three";
import { geomorph } from "../service/geomorph";
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
    inst: /** @type {*} */ (null),
    quad: getQuadGeometryXY(`${w.key}-doors-xy`),
    lockSigGeom: getBoxGeometry(`${w.key}-lock-lights`),
    lockSigInst: /** @type {*} */ (null),
    movingDoors: new Map(),
    opacity: 0.6,
    ready: false,

    addCuboidAttributes() {
      const instanceIds = Object.values(state.byKey).map((_, instanceId) => instanceId);
      state.lockSigGeom.setAttribute('instanceIds',
        new THREE.InstancedBufferAttribute(new Uint32Array(instanceIds), 1),
      );
    },
    addUvs() {
      const { decor: sheet, maxDecorDim } = w.geomorphs.sheet;
      const uvOffsets = /** @type {number[]} */ ([]);
      const uvDimensions = /** @type {number[]} */ ([]);
      const uvTextureIds = /** @type {number[]} */ ([]);
      const instanceIds = /** @type {number[]} */ ([]);

      for (const meta of Object.values(state.byKey)) {
        /** @type {Geomorph.DecorImgKey} */
        const key = meta.door.meta.hull ? 'door--hull' : 'door--standard';
        const { x, y, width, height, sheetId } = sheet[key];
        uvOffsets.push(x / maxDecorDim.width, y / maxDecorDim.height);
        uvDimensions.push(width / maxDecorDim.width, height / maxDecorDim.height);
        uvTextureIds.push(sheetId);
        instanceIds.push(meta.instanceId);
      }

      state.inst.geometry.setAttribute('uvOffsets',
        new THREE.InstancedBufferAttribute(new Float32Array(uvOffsets), 2),
      );
      state.inst.geometry.setAttribute('uvDimensions',
        new THREE.InstancedBufferAttribute(new Float32Array(uvDimensions), 2),
      );
      state.inst.geometry.setAttribute('uvTextureIds',
        new THREE.InstancedBufferAttribute(new Uint32Array(uvTextureIds), 1),
      );
      state.inst.geometry.setAttribute('instanceIds',
        new THREE.InstancedBufferAttribute(new Uint32Array(instanceIds), 1),
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
          const [u, v] = door.seg;
          tmpMat1.feedFromArray(gm.transform);
          const ut = tmpMat1.transformPoint(tmpVec1.copy(u));
          const vt = tmpMat1.transformPoint(tmpVec2.copy(v));
          const center = new Vect((ut.x + vt.x) / 2, (ut.y + vt.y) / 2);
          const radians = Math.atan2(vt.y - ut.y, vt.x - ut.x);
          // 🔔 wider and less depth than "computeDoorway()" for better navSeg intersections
          const collidePoly = door.computeThinPoly(2 * wallOutset - 0.05).applyMatrix(tmpMat1).precision(precision);

          const gdKey = /** @type {const} */ (`g${gmId}d${doorId}`);
          const posKey = /** @type {const} */ (`${center.x},${center.y}`);

          const prev = prevDoorByPos[posKey];
          const hull = gm.isHullDoor(doorId);

          // Compute navigable doorway
          // 🔔 align to offMeshConnection depths
          const entrances = door.computeEntrances().map(x => tmpMat1.transformPoint(x).precision(precision).json);
          
          state.byKey[gdKey] = state.byPos[posKey] = byGmId[doorId] = {
            gdKey, gmId, doorId,
            instanceId: instId,
            door,

            // auto: prev?.auto ?? (door.meta.auto === true),
            auto: true,
            axisAligned: door.normal.x === 0 || door.normal.y === 0,
            locked: prev?.locked ?? (door.meta.locked === true),
            open : prev?.open ?? false,
            sealed: hull === true
              ? w.gmGraph.getDoorNodeById(gmId, doorId).sealed
              : door.meta.sealed === true,
            hull,

            ratio: prev?.ratio ?? 1, // 1 means closed
            src: ut.json,
            dst: vt.json,
            center,
            dir: { x : Math.cos(radians), y: Math.sin(radians) },
            normal: tmpMat1.transformSansTranslate(door.normal.clone()),
            segLength: u.distanceTo(v),
            entrances: [
              { src: entrances[0], dst: entrances[1] },
              { src: entrances[2], dst: entrances[3] },
            ],

            collidePoly,
            collideRect: collidePoly.rect.precision(precision),
          };
          instId++;
        })
      });
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
    decodeInstance(instanceId) {
      let doorId = instanceId;
      const gmId = w.gms.findIndex((gm) => (
        doorId < gm.doors.length ? true : (doorId -= gm.doors.length, false)
      ));
      const { meta } = w.gms[gmId].doors[doorId];
      return { ...w.lib.getGmDoorId(gmId, doorId), ...meta, instanceId };
    },
    getAdjRoomByDir(gdKey, direction) {// 🚧 unused
      const { door } = state.byKey[gdKey];
      return door.normal.dot(direction) > 0 ? door.roomIds[0] : door.roomIds[1];
    },
    getDoorMat(meta) {
      const { src, dir, ratio, segLength, door, normal } = meta;
      const length = segLength * ratio;

      // Hull doors are moved inside (`normal` points outside)
      const offsetX = door.meta.hull ? door.baseRect.height/2 * -normal.x : 0;
      const offsetY = door.meta.hull ? door.baseRect.height/2 * -normal.y : 0;

      return geomorph.embedXZMat4(
        [length * dir.x, length * dir.y, -dir.y, dir.x, src.x + offsetX, src.y + offsetY],
        { yScale: doorHeight, mat4: tmpMatFour1 },
      );
    },
    getLockSigMat(meta) {
      const sx = 0.4;
      const sz = meta.hull === true ? hullDoorDepth/4 : doorDepth + 0.025 * 2;
      const center = tmpVec1.copy(meta.src).add(meta.dst).scale(0.5);
      if (meta.hull === true) {
        center.addScaled(meta.normal, -hullDoorDepth/2);
      }
      return geomorph.embedXZMat4(
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
    onTick(deltaMs) {
      if (state.movingDoors.size === 0) {
        return;
      }
      
      // 🚧 control via "float array" of ratios instead of 4x4 matrices
      const { instanceMatrix } = state.inst;
      for (const [instanceId, meta] of state.movingDoors.entries()) {
        const dstRatio = meta.open ? 0 : 1;
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
      const { inst: ds, lockSigInst: ls } = state;
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
    toggleDoorRaw(door, opts = {}) {
      if (door.sealed === true) {
        return false;
      }
      
      state.cancelClose(door); // Cancel any pending close

      if (opts.access === false) {
        return false; // No access
      }

      if (door.open === true) {// was open
        if (opts.open === true) {
          door.auto === true && w.events.next({
            key: 'try-close-door', gmId: door.gmId, doorId: door.doorId,
          });
          return true;
        }
        if (opts.clear !== true) {
          return false; // cannot close or toggle
        }
      } else {// was closed
        if (opts.close === true) {
          return true;
        }
      }

      // Actually open/close door
      door.open = !door.open;
      state.movingDoors.set(door.instanceId, door);
      w.events.next(door.open ? {
        key: 'opened-door', gmId: door.gmId, doorId: door.doorId,
      } : {
        key: 'closed-door', gmId: door.gmId, doorId: door.doorId,
      });

      if (door.auto === true && door.open === true) { 
        w.events.next({
          key: 'try-close-door', gmId: door.gmId, doorId: door.doorId,
        });
      }

      return true;
    },
    toggleLockRaw(door, opts = {}) {
      if (door.sealed === true) {
        return false;
      }

      if (opts.access === false) {
        return false; // No access
      }

      if (door.locked === true) {
        if (opts.lock === true) return true; // Already locked
      } else {
        if (opts.unlock === true) return true; // Already unlocked
      }

      // Actually lock/unlock door
      door.locked = !door.locked;
      state.lockSigInst.setColorAt(door.instanceId, getColor(door.locked ? doorLockedColor : doorUnlockedColor));
      /** @type {THREE.InstancedBufferAttribute} */ (state.lockSigInst.instanceColor).needsUpdate = true;

      w.events.next(door.locked ? {
        key: 'locked-door', gmId: door.gmId, doorId: door.doorId,
      } : {
        key: 'unlocked-door', gmId: door.gmId, doorId: door.doorId,
      });

      return true;
    },
  }));

  w.door = state;

  React.useEffect(() => {
    w.menu.measure('door[useEffect]');
    state.buildLookups();
    state.positionInstances();
    state.addCuboidAttributes();
    state.addUvs();
    w.d = state.byKey;
    state.ready = true
    w.menu.measure('door[useEffect]');
  }, [w.mapKey, w.hash.full, w.gmsData.doorCount]);

  return <>
    <instancedMesh
      name={instancedMeshName.doors}
      key={`${w.hash} doors`}
      ref={inst => inst && (state.inst = inst)}
      args={[state.quad, undefined, w.gmsData.doorCount]}
      frustumCulled={false}
      renderOrder={1}
      visible={state.ready}
    >
      {state.ready && <instancedMultiTextureMaterial
        key={glsl.InstancedMultiTextureMaterial.key}
        side={THREE.DoubleSide}
        transparent
        atlas={w.texDecor.tex}
        diffuse={[.5, .5, .5]}
        objectPickRed={4}
        alphaTest={0} opacity={state.opacity} depthWrite={true}
      />}
    </instancedMesh>

    <instancedMesh
      name="lock-lights"
      key={`${w.hash} lock-lights`}
      ref={inst => inst && (state.lockSigInst = inst)}
      args={[state.lockSigGeom, undefined, w.gmsData.doorCount]}
      frustumCulled={false}
      visible={state.ready}
    >
      {state.ready && <cameraLightMaterial
        key={glsl.CameraLightMaterial.key}
        diffuse={[1, 1, 1]}
        objectPickRed={9}
        side={THREE.DoubleSide} // fix flipped gm
      />}
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
 * Format `byGmId[gmId][doorId]`
 * @property {{ [gmDoorKey in Geomorph.GmDoorKey]: Geomorph.DoorState }} byKey
 * @property {{ [center in `${number},${number}`]: Geomorph.DoorState }} byPos
 * @property {THREE.InstancedMesh} inst
 * @property {THREE.BufferGeometry} quad
 * @property {THREE.BoxGeometry} lockSigGeom
 * @property {THREE.InstancedMesh} lockSigInst
 * @property {Map<number, Geomorph.DoorState>} movingDoors To be animated until they open/close.
 * @property {number} opacity
 * @property {boolean} ready avoid initial flicker
 *
 * @property {() => void} addCuboidAttributes
 * @property {() => void} addUvs
 * @property {() => void} buildLookups
 * @property {(item: Geomorph.DoorState) => void} cancelClose
 * @property {(instanceId: number) => Meta<Geomorph.GmDoorId>} decodeInstance
 * @property {(meta: Geomorph.DoorState) => THREE.Matrix4} getDoorMat
 * @property {(meta: Geomorph.DoorState) => THREE.Matrix4} getLockSigMat
 * @property {(gmId: number) => number[]} getOpenIds Get gmDoorKeys of open doors
 * @property {(gdKey: Geomorph.GmDoorKey, direction: Geom.VectJson) => number | null} getAdjRoomByDir
 * @property {(gmId: number, doorId: number) => boolean} isOpen
 * @property {(door: Geomorph.DoorState, opts?: Geomorph.ToggleDoorOpts) => boolean} toggleDoorRaw
 * Returns `true` iff successful.
 * @property {(door: Geomorph.DoorState, opts?: Geomorph.ToggleLockOpts) => boolean} toggleLockRaw
 * Returns `true` iff successful.
 * @property {(deltaMs: number) => void} onTick
 * @property {() => void} positionInstances
 */

const tmpVec1 = new Vect();
const tmpVec2 = new Vect();
const tmpMat1 = new Mat();
const tmpMatFour1 = new THREE.Matrix4();
