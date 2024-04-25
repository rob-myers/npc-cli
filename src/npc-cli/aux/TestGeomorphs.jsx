import React from "react";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { useQuery } from "@tanstack/react-query";

import { Mat } from "../geom";
import { hashJson, info, keys } from "../service/generic";
import { FLOOR_IMAGES_QUERY_KEY, worldScale } from "../service/const";
import { quadGeometryXZ } from "../service/three";
import { drawPolygons } from "../service/dom";
import { geomorphService } from "../service/geomorph";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

import meshInstanceUvsVertexShader from "!!raw-loader!../glsl/mesh-instance-uvs.v.glsl";
import meshBasicFragmentShader from "!!raw-loader!../glsl/mesh-basic.f.glsl";

/**
 * @param {Props} props
 */
export default function TestGeomorphs(props) {
  const api = React.useContext(TestWorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    extendedQuadGeometryXZ: quadGeometryXZ.clone(),
    obsInst: /** @type {*} */ (null),

    drawGeomorph(gmKey, img) {
      const { ctxt, canvas: { width, height }, layout } = api.gmClass[gmKey];
      ctxt.clearRect(0, 0, width, height);
      ctxt.drawImage(img, 0, 0);

      // 🚧 debug obstacles
      const { pngRect } = layout;
      const scale = 1 / worldScale;
      layout.obstacles.forEach(({ origPoly, transform }) => {
        ctxt.setTransform(scale, 0, 0, scale, -pngRect.x * scale, -pngRect.y * scale);
        ctxt.transform(...transform);
        drawPolygons(ctxt, [origPoly], ['red', null]);
      });
      ctxt.resetTransform();
    },
    addObstacleUvs() {
      const { obstacle: obstaclesSheet, obstaclesWidth, obstaclesHeight } = api.geomorphs.sheet;
      const uvOffsets = /** @type {number[]} */ ([]);
      const uvDimensions = /** @type {number[]} */ ([]);
  
      api.gms.forEach(({ obstacles }) =>
        obstacles.forEach(({ symbolKey, obstacleId }) => {
          const { x, y, width, height } = obstaclesSheet[`${symbolKey} ${obstacleId}`];
          uvOffsets.push(x / obstaclesWidth, y / obstaclesWidth);
          uvDimensions.push(width / obstaclesWidth, height / obstaclesHeight);
        })
      );

      state.extendedQuadGeometryXZ.setAttribute('uvOffsets',
        new THREE.InstancedBufferAttribute( new Float32Array( uvOffsets ), 2 ),
      );
      state.extendedQuadGeometryXZ.setAttribute('uvDimensions',
        new THREE.InstancedBufferAttribute( new Float32Array( uvDimensions ), 2 ),
      );
    },
    getNumObs() {
      return api.gms.reduce((sum, { obstacles }) => sum + obstacles.length, 0);
    },
    getObsMat() {
      // 🚧 transform unit rect to world rect
      return new THREE.Matrix4();
    },
    onClickObstacle(e) {
      const instanceId = /** @type {number} */ (e.instanceId);
      info(`instanceId: ${instanceId}`)
      // const meta = state.doorByInstId[instanceId];
      // meta.open = !meta.open;
      // state.movingDoors.set(meta.instanceId, meta);
      // e.stopPropagation();
    },
    positionObstacles() {
      const { obsInst } = state;
      const [mat, mat4] = [tmpMat1, tmpMatFour1];
      let oId = 0;
      api.gms.forEach(({ obstacles, transform: gmTransform }) => {
        obstacles.forEach(({ origPoly: { rect }, transform, height }) => {
          // 1st transform unit XZ square to rect
          // then apply `transform` followed by `gmTransform`
          mat.feedFromArray([rect.width, 0, 0, rect.height, rect.x, rect.y]);
          mat.postMultiply(transform).postMultiply(gmTransform);
          obsInst.setMatrixAt(oId++, geomorphService.embedXZMat4(mat.toArray(), { mat4, yHeight: height }));
        });
      });
      obsInst.instanceMatrix.needsUpdate = true;
      obsInst.computeBoundingSphere();
    },
  }));

  useQuery({// auto-updates with `yarn images`
    queryKey: [FLOOR_IMAGES_QUERY_KEY, api.layoutsHash, api.mapsHash],
    queryFn() {
      keys(api.gmClass).forEach((gmKey) => {
        textureLoader.loadAsync(`/assets/2d/${gmKey}.floor.png.webp`).then((tex) => {
          state.drawGeomorph(gmKey, tex.source.data);
          api.gmClass[gmKey].tex.needsUpdate = true;
          update();
        });
      });
      return null;
    },
  });

  const instHash = `${api.mapKey} ${api.mapsHash} ${api.layoutsHash} ${obstaclesShaderHash}`

  React.useEffect(() => {
    state.addObstacleUvs();
    state.positionObstacles();
  }, [instHash]);

  const update = useUpdate();

  const debugTex = useTexture('/assets/debug/test-uv-texture.png');

  return <>
    {api.gms.map((gm, gmId) => (
      <group
        key={`${gm.key} ${gmId} ${gm.transform}`}
        onUpdate={(group) => group.applyMatrix4(gm.mat4)}
        // ref={(group) => group?.applyMatrix4(gm.mat4)}
      >
        <mesh
          geometry={quadGeometryXZ}
          scale={[gm.pngRect.width, 1, gm.pngRect.height]}
          position={[gm.pngRect.x, 0, gm.pngRect.y]}
        >
          <meshBasicMaterial
            side={THREE.FrontSide}
            transparent
            map={api.gmClass[gm.key].tex}
            depthWrite={false} // fix z-fighting
            // visible={false}
          />
        </mesh>
      </group>
    ))}

    <instancedMesh
      name="static-obstacles"
      key={instHash}
      ref={instances => instances && (state.obsInst = instances)}
      args={[quadGeometryXZ, undefined, state.getNumObs()]}
      frustumCulled={false}
      onPointerUp={state.onClickObstacle}
      position={[0, 0.001, 0]} // 🚧 temp
    >
      {/* <meshBasicMaterial
        side={THREE.DoubleSide}
        // color="green"
        map={debugTex}
      /> */}
      <shaderMaterial
        side={THREE.DoubleSide}
        vertexShader={meshInstanceUvsVertexShader}
        fragmentShader={meshBasicFragmentShader}
        uniforms={uniforms}
      />
    </instancedMesh>
  </>
  
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {THREE.BufferGeometry} extendedQuadGeometryXZ
 * @property {THREE.InstancedMesh} obsInst
 * @property {() => void} addObstacleUvs
 * @property {(gmKey: Geomorph.GeomorphKey, img: HTMLImageElement) => void} drawGeomorph
 * @property {(o: Geomorph.LayoutObstacle) => THREE.Matrix4} getObsMat
 * @property {() => number} getNumObs
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onClickObstacle
 * @property {() => void} positionObstacles
 */

const textureLoader = new THREE.TextureLoader();
const tmpMat1 = new Mat();
const tmpMatFour1 = new THREE.Matrix4();


const uniforms = {// Debug
  diffuse: { value: new THREE.Vector3(0, 0, 1) },
};
const obstaclesShaderHash = hashJson({ meshInstanceUvsVertexShader, meshBasicFragmentShader, uniforms });
