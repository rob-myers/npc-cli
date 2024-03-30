import React from "react";
import * as THREE from "three";

import { assertDefined, error, hashText, info, keys, warn } from "../service/generic";
import { worldScale } from "../service/const";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import {
  polysToXZGeometry,
  quadGeometryXY,
  quadGeometryXZ,
  wireFrameMaterial,
} from "../service/three";
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

    rootGroup: /** @type {*} */ (null),

    computeInstMat(u, v, transform) {
      const height = 2;
      const [src, dst] = [tmpVec1, tmpVec2];
      const segLength = u.distanceTo(v) * worldScale;
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
        height,
        tmpMatFour1
      );
    },
    drawGeomorph(gmKey, img) {
      const { ctxt, layout } = api.gmData[gmKey];
      const { pngRect, rooms, doors, navPolys } = layout;

      ctxt.clearRect(0, 0, pngRect.width, pngRect.width);
      ctxt.drawImage(img, 0, 0);
      ctxt.translate(-pngRect.x, -pngRect.y);

      // draw hull doors
      const hullPolys = doors.flatMap((x) => (x.meta.hull ? x.poly : []));
      drawPolygons(ctxt, hullPolys, ["white", "#000", 2]);

      // 🚧 debug draw rooms
      // drawPolygons(ctxt, rooms, [null, "green", 0]);

      // 🚧 debug draw navPolys
      drawPolygons(ctxt, navPolys, ["rgba(0, 0, 255, 0.2", "green"]);
      ctxt.resetTransform();
    },
    getNumDoors() {
      return api.gms.reduce((sum, { doorSegs }) => sum + doorSegs.length, 0);
    },
    getNumWalls() {
      return api.gms.reduce((sum, { wallSegs }) => sum + wallSegs.length, 0);
    },
    positionWalls() {
      const { wallInstances: ws, doorInstances: ds } = state;
      let wOffset = 0;
      let dOffset = 0;

      api.gms.forEach(({ wallSegs, doorSegs, transform }) => {
        wallSegs.forEach(([u, v]) =>
          ws.setMatrixAt(wOffset++, state.computeInstMat(u, v, transform))
        );
        doorSegs.forEach(([u, v]) =>
          ds.setMatrixAt(dOffset++, state.computeInstMat(u, v, transform))
        );
      });
      ws.instanceMatrix.needsUpdate = true;
      ds.instanceMatrix.needsUpdate = true;
    },
  }));

  api.scene = state;

  React.useEffect(() => {
    keys(api.gmData).forEach((gmKey) => {
      textureLoader.loadAsync(`/assets/debug/${gmKey}.png`).then((tex) => {
        state.drawGeomorph(gmKey, tex.source.data);
        api.gmData[gmKey].tex.needsUpdate = true;
        update();
      });
    });
    state.wallInstances && state.positionWalls();
  }, [api.geomorphs, api.mapKey]);

  const update = useUpdate();

  return (
    <group onUpdate={(group) => (state.rootGroup = group)}>
      {api.gms.map((gm, gmId) => (
        <group
          key={`${gm.key} ${gmId} ${gm.transform}`}
          onUpdate={(self) => self.applyMatrix4(gm.mat4)}
          scale={[worldScale, 1, worldScale]}
        >
          <mesh
            geometry={quadGeometryXZ}
            scale={[gm.pngRect.width, 1, gm.pngRect.height]}
            position={[gm.pngRect.x, 0, gm.pngRect.y]}
          >
            <meshBasicMaterial
              side={THREE.DoubleSide}
              transparent
              map={api.gmData[gm.key].tex}
              depthWrite={false} // fix z-fighting
            />
          </mesh>
          <mesh
            name="debugNavPoly"
            geometry={api.gmData[gm.key].debugNavPoly}
            position={[0, 0.001, 0]}
            // scale={[1, -1, 1]}
            visible={false}
          >
            <meshStandardMaterial side={THREE.FrontSide} color="green" wireframe={false} />
          </mesh>
        </group>
      ))}

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
        onPointerUp={(e) => info("door click", e.point, e.instanceId)}
      >
        <shaderMaterial
          side={THREE.DoubleSide}
          vertexShader={basicVertexShader}
          fragmentShader={gradientFragmentShader}
          uniforms={uniforms}
        />
      </instancedMesh>
    </group>
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
 * @property {THREE.Group} rootGroup
 * @property {(u: Geom.Vect, v: Geom.Vect, transform: Geom.SixTuple) => THREE.Matrix4} computeInstMat
 * @property {(gmKey: Geomorph.GeomorphKey, img: HTMLImageElement) => void} drawGeomorph
 * @property {() => number} getNumDoors
 * @property {() => number} getNumWalls
 * @property {() => void} positionWalls
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
