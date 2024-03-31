import React from "react";
import * as THREE from "three";

import { hashText, info } from "../service/generic";
import { worldScale } from "../service/const";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";
import { quadGeometryXY } from "../service/three";
import { Mat, Vect } from "../geom";
import { geomorphService } from "../service/geomorph";

import basicVertexShader from "!!raw-loader!../glsl/mesh-basic-simplified.v.glsl";
import gradientFragmentShader from "!!raw-loader!../glsl/gradient.f.glsl";

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
    movingDoors: [],

    buildLookups() {
      let dId = 0;
      api.gms.forEach((gm, gmId) => gm.doors.forEach((door, doorId) => {
        const { seg: [u, v] } = door;
        tmpMat1.feedFromArray(gm.transform);
        tmpMat1.transformPoint(tmpVec1.copy(u));
        tmpMat1.transformPoint(tmpVec2.copy(v));
        const radians = Math.atan2(tmpVec2.y - tmpVec1.y, tmpVec2.x - tmpVec1.x);
        const key = /** @type {const} */ (`${tmpVec1.x},${tmpVec1.y}`);
        const prev = state.doorByPos[key];
        state.doorByPos[key] = state.doorByInstId[dId] = {
          gmId, doorId, door, srcSegKey: key,
          instanceId: dId,
          open : prev?.open ?? false,
          ratio: prev?.ratio ?? 1, // closed ~ ratio 1
          src: tmpVec1.json,
          dir: { x : Math.cos(radians), y: Math.sin(radians) },
          segLength: u.distanceTo(v),
        };
        dId++;
      }));
    },
    getDoorMat(meta) {
      const { src, dir, ratio, segLength } = meta;
      const length = segLength * ratio * worldScale;
      return geomorphService.embedXZMat4(
        [length * dir.x, length * dir.y, -dir.y, dir.x, src.x, src.y], wallHeight, tmpMatFour1
      );
    },
    getWallMat(u, v, transform) {
      tmpMat1.feedFromArray(transform);
      [tmpVec1.copy(u), tmpVec2.copy(v)].forEach(x => tmpMat1.transformPoint(x));
      const rad = Math.atan2(tmpVec2.y - tmpVec1.y, tmpVec2.x - tmpVec1.x);
      const len = u.distanceTo(v) * worldScale;
      return geomorphService.embedXZMat4([
        len * Math.cos(rad), len * Math.sin(rad), -Math.sin(rad), Math.cos(rad), tmpVec1.x, tmpVec1.y,
      ], wallHeight, tmpMatFour1);
    },
    getNumDoors() {
      return api.gms.reduce((sum, { doorSegs }) => sum + doorSegs.length, 0);
    },
    getNumWalls() {
      return api.gms.reduce((sum, { wallSegs }) => sum + wallSegs.length, 0);
    },
    positionInstances() {
      const { wallsInst: ws, doorsInst: ds } = state;

      let wId = 0;
      api.gms.forEach(({ wallSegs, transform }) =>
        wallSegs.forEach(([u, v]) => ws.setMatrixAt(wId++, state.getWallMat(u, v, transform)))
      );
      ws.instanceMatrix.needsUpdate = true;

      Object.values(state.doorByPos).forEach(meta =>
        ds.setMatrixAt(meta.instanceId, state.getDoorMat(meta))
      );
      ds.instanceMatrix.needsUpdate = true;
    },
  }));

  React.useEffect(() => {
    state.buildLookups();
    state.positionInstances();
  }, [api.mapHash, api.layoutsHash]);

  return (
    <>
      <instancedMesh
        name="walls"
        key={`${api.mapHash} ${api.layoutsHash}`}
        ref={instances => instances && (state.wallsInst = instances)}
        args={[quadGeometryXY, undefined, state.getNumWalls()]}
        frustumCulled={false}
      >
        <meshBasicMaterial side={THREE.DoubleSide} color="black" />
      </instancedMesh>

      <instancedMesh
        name="doors"
        key={`${api.mapHash} ${api.layoutsHash} ${doorShaderHash}`}
        ref={instances => instances && (state.doorsInst = instances)}
        args={[quadGeometryXY, undefined, state.getNumDoors()]}
        frustumCulled={false}
        onPointerUp={(e) => {
          info("door click", e.point, e.instanceId);

          // 🚧 animate width
          // 🚧 ratio should get changed during animation
          const instanceId = /** @type {number} */ (e.instanceId);
          const meta = state.doorByInstId[instanceId];
          meta.ratio = meta.ratio === 1 ? 0.1 : 1;
          state.doorsInst.setMatrixAt(instanceId, state.getDoorMat(meta));
          state.doorsInst.instanceMatrix.needsUpdate = true;

          e.stopPropagation();
        }}
      >
        <shaderMaterial
          side={THREE.DoubleSide}
          vertexShader={basicVertexShader}
          fragmentShader={gradientFragmentShader}
          uniforms={uniforms}
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
 * @property {Geomorph.DoorMeta[]} movingDoors To be animated until they open/close.
 *
 * @property {() => void} buildLookups
 * @property {(meta: Geomorph.DoorMeta) => THREE.Matrix4} getDoorMat
 * @property {(u: Geom.Vect, v: Geom.Vect, transform: Geom.SixTuple, doorWidth?: number) => THREE.Matrix4} getWallMat
 * @property {() => number} getNumDoors
 * @property {() => number} getNumWalls
 * @property {() => void} positionInstances
 */

const textureLoader = new THREE.TextureLoader();
const tmpVec1 = new Vect();
const tmpVec2 = new Vect();
const tmpMat1 = new Mat();
const tmpMatFour1 = new THREE.Matrix4();
const tmpMatFour2 = new THREE.Matrix4();

const uniforms = {
  diffuse: { value: new THREE.Vector3(1, 1, 0) },
  opacity: { value: 1 },
};

const doorShaderHash = hashText(
  JSON.stringify({
    basicVertexShader,
    gradientFragmentShader,
    uniforms,
  })
);

const wallHeight = 2;
