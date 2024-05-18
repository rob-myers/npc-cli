import React from "react";
import * as THREE from "three";
import { damp } from "maath/easing"

import { Mat, Vect } from "../geom";
import { hashJson, info } from "../service/generic";
import { wallHeight, worldScale } from "../service/const";
import * as glsl from "../service/glsl";
import { quadGeometryXY } from "../service/three";
import { geomorphService } from "../service/geomorph";
import { isRMB, isTouchDevice } from "../service/dom";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function TestWallsAndDoors(props) {
  const api = React.useContext(TestWorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    wallsInst: /** @type {*} */ (null),
    doorsInst: /** @type {*} */ (null),

    doorByPos: {},
    doorByInstId: [],
    movingDoors: new Map(),

    buildLookups() {
      let dId = 0;
      const prevDoorByPos = state.doorByPos;
      state.doorByPos = {};
      state.doorByInstId = {};
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
    getDoorMat(meta) {
      const { src, dir, ratio, segLength } = meta;
      const length = segLength * ratio;
      return geomorphService.embedXZMat4(
        [length * dir.x, length * dir.y, -dir.y, dir.x, src.x, src.y],
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
    handleClick(e) {
      const target = /** @type {'walls' | 'doors'} */ (e.object.name);
      if (target === 'doors' && (isTouchDevice() || !isRMB(e.nativeEvent))) {
        const instanceId = /** @type {number} */ (e.instanceId);
        const meta = state.doorByInstId[instanceId];
        meta.open = !meta.open;
        state.movingDoors.set(meta.instanceId, meta);
        // e.stopPropagation(); // prevents ContextMenu
      }
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
        instanceMatrix.array[instanceId * 16 + 0] = meta.dir.x * length;
        instanceMatrix.array[instanceId * 16 + 2] = meta.dir.y * length;
        if (meta.ratio === dstRatio) state.movingDoors.delete(instanceId);
      }
      instanceMatrix.needsUpdate = true;
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

  api.doors = state;

  React.useEffect(() => {
    state.buildLookups();
    state.positionInstances();
  }, [api.hash, doorShaderHash]);

  return (
    <>
      <instancedMesh
        name="walls"
        key={`${api.hash} walls`}
        ref={instances => instances && (state.wallsInst = instances)}
        args={[quadGeometryXY, undefined, api.derived.wallCount]}
        frustumCulled={false}
        onPointerUp={state.handleClick}
      >
        <meshBasicMaterial side={THREE.DoubleSide} color="black" />
      </instancedMesh>

      <instancedMesh
        name="doors"
        key={`${api.hash} doors`}
        ref={instances => instances && (state.doorsInst = instances)}
        args={[quadGeometryXY, undefined, api.derived.doorCount]}
        frustumCulled={false}
        onPointerUp={state.handleClick}
      >
        <shaderMaterial
          key={doorShaderHash}
          side={THREE.DoubleSide}
          vertexShader={glsl.meshBasic.simplifiedVert}
          fragmentShader={glsl.basicGradientFrag}
          // uniforms={uniforms}
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
 * @property {{ [instanceId: number]: Geomorph.DoorMeta }} doorByInstId
 * @property {Map<number, Geomorph.DoorMeta>} movingDoors To be animated until they open/close.
 *
 * @property {() => void} buildLookups
 * @property {(meta: Geomorph.DoorMeta) => THREE.Matrix4} getDoorMat
 * @property {(
 *  seg: [Geom.Vect, Geom.Vect],
 *  transform: Geom.SixTuple,
 *  height?: number,
 *  baseHeight?: number,
 * ) => THREE.Matrix4} getWallMat
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} handleClick
 * @property {() => void} onTick
 * @property {() => void} positionInstances
 */

const textureLoader = new THREE.TextureLoader();
const tmpVec1 = new Vect();
const tmpVec2 = new Vect();
const tmpMat1 = new Mat();
const tmpMatFour1 = new THREE.Matrix4();
const tmpMatFour2 = new THREE.Matrix4();

const doorShaderHash = hashJson([glsl.meshBasic.simplifiedVert, glsl.basicGradientFrag]);
