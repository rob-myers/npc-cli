import React from "react";
import * as THREE from "three";

import { assertDefined, error, hashText, info, keys, warn } from "../service/generic";
import { worldScale } from "../service/const";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { quadGeometryXY } from "../service/three";
import { Mat, Vect } from "../geom";
import { drawPolygons, strokeLine } from "../service/dom";
import { geomorphService } from "../service/geomorph";

import basicVertexShader from "!!raw-loader!../glsl/mesh-basic-simplified.v.glsl";
import gradientFragmentShader from "!!raw-loader!../glsl/gradient.f.glsl";

/**
 * @param {Props} props
 */
export default function TestWallsAndDoors(props) {
  const api = React.useContext(TestWorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    wallInstances: /** @type {*} */ (null),
    doorInstances: /** @type {*} */ (null),
    doorWidths: {},

    doorByPos: {},
    doorByInstId: [],
    movingDoors: [],

    getDoorMat(meta) {
      const { src, dir, ratio, segLength } = meta;
      const length = segLength * (1  - ratio) * worldScale;
      return geomorphService.embedXZMat4(
        [length * dir.x, length * dir.y, -dir.y, dir.x, src.x, src.y],
        wallHeight,
        tmpMatFour1
      );
    },
    getWallMat(u, v, transform) {
      const segLength = u.distanceTo(v) * worldScale;
      tmpVec1.copy(u); tmpVec2.copy(v);
      tmpMat1.feedFromArray(transform);
      tmpMat1.transformPoint(tmpVec1); tmpMat1.transformPoint(tmpVec2);
      const radians = Math.atan2(tmpVec2.y - tmpVec1.y, tmpVec2.x - tmpVec1.x);
      return geomorphService.embedXZMat4([
        segLength * Math.cos(radians), segLength * Math.sin(radians),
        -Math.sin(radians), Math.cos(radians),
        tmpVec1.x, tmpVec1.y,
      ], wallHeight, tmpMatFour1
    );
    },
    getNumDoors() {
      return api.gms.reduce((sum, { doorSegs }) => sum + doorSegs.length, 0);
    },
    getNumWalls() {
      return api.gms.reduce((sum, { wallSegs }) => sum + wallSegs.length, 0);
    },
    positionInstances() {
      const { wallInstances: ws, doorInstances: ds } = state;

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
    // 🚧 move to function
    let offset = 0;
    api.gms.forEach((gm, gmId) => gm.doors.forEach((door, doorId) => {
      const { seg: [u, v] } = door;
      tmpMat1.feedFromArray(gm.transform);
      tmpMat1.transformPoint(tmpVec1.copy(u));
      tmpMat1.transformPoint(tmpVec2.copy(v));
      const radians = Math.atan2(tmpVec2.y - tmpVec1.y, tmpVec2.x - tmpVec1.x);
      const key = /** @type {const} */ (`${tmpVec1.x},${tmpVec1.y}`);
      const prev = state.doorByPos[key];
      state.doorByPos[key] = state.doorByInstId[offset] = {
        gmId, doorId, door, srcSegKey: key,
        instanceId: offset,
        open : prev?.open ?? false,
        ratio: prev?.ratio ?? 0,
        src: tmpVec1.json,
        dir: { x : Math.cos(radians), y: Math.sin(radians) },
        segLength: u.distanceTo(v),
      };
      offset++;
    }));

    state.positionInstances();
  }, [api.mapHash, api.layoutsHash]);

  return (
    <>
      <instancedMesh
        name="walls"
        key={`${api.mapHash} ${api.layoutsHash}`}
        onUpdate={(instances) => (state.wallInstances = instances)}
        args={[quadGeometryXY, undefined, state.getNumWalls()]}
        frustumCulled={false}
      >
        <meshBasicMaterial side={THREE.DoubleSide} color="black" />
      </instancedMesh>

      <instancedMesh
        name="doors"
        key={`${api.mapHash} ${api.layoutsHash} ${doorShaderHash}`}
        onUpdate={(instances) => (state.doorInstances = instances)}
        args={[quadGeometryXY, undefined, state.getNumDoors()]}
        frustumCulled={false}
        onPointerUp={(e) => {
          info("door click", e.point, e.instanceId);

          // 🚧 animate width
          const instanceId = /** @type {number} */ (e.instanceId);
          const meta = state.doorByInstId[instanceId];
          meta.ratio = meta.ratio ? 0 : (1 - 0.1);
          state.doorInstances.setMatrixAt(instanceId, state.getDoorMat(meta));
          state.doorInstances.instanceMatrix.needsUpdate = true;

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
 * @property {THREE.InstancedMesh} wallInstances
 * @property {THREE.InstancedMesh} doorInstances
 * @property {{ [positionKey: string]: number | undefined }} doorWidths // 🚧 remove
 * Can override door width, where key has format `${x},${y}` i.e. world position of src of door segment
 * @property {{ [segSrcKey in `${number},${number}`]: Geomorph.DoorMeta }} doorByPos
 * @property {{ [instanceId: number]: Geomorph.DoorMeta }} doorByInstId
 * @property {Geomorph.DoorMeta[]} movingDoors
 * These will be animated until they close/open and are removed
 *
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
