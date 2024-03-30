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
export default function TestWorldScene(props) {
  const api = React.useContext(TestWorldContext);

  // prettier-ignore
  const state = useStateRef(/** @returns {State} */ () => ({
    wallInstances: /** @type {*} */ (null),
    doorInstances: /** @type {*} */ (null),
    doorWidths: {},

    computeInstMat(u, v, transform, doorWidth) {
      const [src, dst] = [tmpVec1, tmpVec2];
      const segLength = doorWidth ?? u.distanceTo(v) * worldScale;
      tmpMat1.feedFromArray(transform);
      tmpMat1.transformPoint(tmpVec1.copy(u));
      tmpMat1.transformPoint(tmpVec2.copy(v));
      const radians = Math.atan2(dst.y - src.y, dst.x - src.x);
      return geomorphService.embedXZMat4(
        [
          segLength * Math.cos(radians),
          segLength * Math.sin(radians),
          -Math.sin(radians),
          Math.cos(radians),
          src.x,
          src.y,
        ],
        wallDoorHeight,
        tmpMatFour1
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
      let wOffset = 0;
      let dOffset = 0;

      api.gms.forEach(({ wallSegs, doorSegs, transform }) => {
        wallSegs.forEach(([u, v]) =>
          ws.setMatrixAt(wOffset++, state.computeInstMat(u, v, transform))
        );
        doorSegs.forEach(([u, v]) =>
          ds.setMatrixAt(dOffset++, state.computeInstMat(u, v, transform, state.doorWidths[`${u.x},${u.y}`]))
        );
      });
      ws.instanceMatrix.needsUpdate = true;
      ds.instanceMatrix.needsUpdate = true;
    },
  }));

  React.useEffect(() => {
    state.wallInstances && state.positionInstances();
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
          let doorId = /** @type {number} */ (e.instanceId);
          const gm = assertDefined(
            api.gms.find(({ doors }) =>
              doorId < doors.length ? true : void (doorId -= doors.length)
            )
          );
          const [{ x, y }] = gm.doors[doorId].seg;
          const key = `${x},${y}`;
          if (key in state.doorWidths) {
            delete state.doorWidths[key];
          } else {
            state.doorWidths[key] = 0.15;
          }
          state.positionInstances(); // 🚧 only reposition doors
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
 * @property {{ [positionKey: string]: number }} doorWidths
 * positionKey has format `${x},${y}` i.e. world position of src of door segment
 * @property {(u: Geom.Vect, v: Geom.Vect, transform: Geom.SixTuple, doorWidth?: number) => THREE.Matrix4} computeInstMat
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

const wallDoorHeight = 2;
