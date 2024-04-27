import React from "react";
import * as THREE from "three";
import { extend } from "@react-three/fiber";
import { useTexture, shaderMaterial } from "@react-three/drei";
import { useQuery } from "@tanstack/react-query";

import { Mat } from "../geom";
import { info, keys } from "../service/generic";
import { FLOOR_IMAGES_QUERY_KEY, wallHeight, worldScale } from "../service/const";
import { quadGeometryXZ } from "../service/three";
import { drawPolygons, strokeLine } from "../service/dom";
import { geomorphService } from "../service/geomorph";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

// import meshInstanceUvsVertexShader from "!!raw-loader!../glsl/instanced-uvs.v.glsl";
// import meshBasicVertexShader from "!!raw-loader!../glsl/mesh-basic.v.glsl";
// import meshBasicFragmentShader from "!!raw-loader!../glsl/mesh-basic.f.glsl";

/**
 * @param {Props} props
 */
export default function TestGeomorphs(props) {
  const api = React.useContext(TestWorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    obsInst: /** @type {*} */ (null),

    drawGeomorph(gmKey, img) {
      const { floorCt, ceilCt, floorEl: { width, height }, layout } = api.gmClass[gmKey];
      const { pngRect } = layout;

      floorCt.clearRect(0, 0, width, height);
      floorCt.drawImage(img, 0, 0);

      // 🚧 debug obstacles
      const scale = 1 / worldScale;
      layout.obstacles.forEach(({ origPoly, transform }) => {
        floorCt.setTransform(scale, 0, 0, scale, -pngRect.x * scale, -pngRect.y * scale);
        floorCt.transform(...transform);
        drawPolygons(floorCt, origPoly, ['rgba(0, 0, 0, 0.4)', null]);
      });
      floorCt.resetTransform();
      
      ceilCt.clearRect(0, 0, width, height);
      ceilCt.setTransform(scale, 0, 0, scale, -pngRect.x * scale, -pngRect.y * scale);
      // wall tops
      drawPolygons(ceilCt, layout.walls, ['rgba(50, 50, 50, 1)', null])
      // door tops
      // drawPolygons(ceilCt, layout.doors.map(x => x.poly), ['rgba(50, 50, 50, 1)'])
      ceilCt.strokeStyle = 'black';
      ceilCt.lineWidth = 0.03;
      layout.doors.forEach(x => strokeLine(ceilCt, x.seg[0], x.seg[1]))
      ceilCt.resetTransform();
    },
    addObstacleUvs() {
      const { obstacle: obstaclesSheet, obstaclesWidth, obstaclesHeight } = api.geomorphs.sheet;
      const uvOffsets = /** @type {number[]} */ ([]);
      const uvDimensions = /** @type {number[]} */ ([]);
  
      api.gms.forEach(({ obstacles }) =>
        obstacles.forEach(({ symbolKey, obstacleId }) => {
          const { x, y, width, height } = obstaclesSheet[`${symbolKey} ${obstacleId}`];
          uvOffsets.push(x / obstaclesWidth,  1 - (y + height) / obstaclesHeight);
          uvDimensions.push(width / obstaclesWidth, height / obstaclesHeight);
        })
      );

      state.obsInst.geometry.setAttribute('uvOffsets',
        new THREE.InstancedBufferAttribute( new Float32Array( uvOffsets ), 2 ),
      );
      state.obsInst.geometry.setAttribute('uvDimensions',
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
          const { floor, ceil } = api.gmClass[gmKey];
          floor.needsUpdate = true;
          ceil.needsUpdate = true;
          update();
        });
      });
      return null;
    },
  });

  const instHash = `${api.mapKey} ${api.mapsHash} ${api.layoutsHash}`
  
  React.useEffect(() => {
    state.addObstacleUvs();
    state.positionObstacles();
  }, [instHash, shaderMaterial]);

  const update = useUpdate();

  const obstaclesTex = useTexture('/assets/2d/obstacles.png');
  
  return <>
    {api.gms.map((gm, gmId) => (
      <group
        key={`${gm.key} ${gmId} ${gm.transform}`}
        onUpdate={(group) => group.applyMatrix4(gm.mat4)}
        // ref={(group) => group?.applyMatrix4(gm.mat4)}
      >
        <mesh
          name={`floor-gm-${gmId}`}
          geometry={quadGeometryXZ}
          scale={[gm.pngRect.width, 1, gm.pngRect.height]}
          position={[gm.pngRect.x, 0, gm.pngRect.y]}
        >
          <meshBasicMaterial
            side={THREE.FrontSide}
            transparent
            map={api.gmClass[gm.key].floor}
            depthWrite={false} // fix z-fighting
          />
        </mesh>

        <mesh
          name={`ceil-gm-${gmId}`}
          geometry={quadGeometryXZ}
          scale={[gm.pngRect.width, 1, gm.pngRect.height]}
          position={[gm.pngRect.x, wallHeight + 0.001, gm.pngRect.y]}
        >
          <meshBasicMaterial
            side={THREE.FrontSide}
            transparent
            map={api.gmClass[gm.key].ceil}
            // depthWrite={false} // fix z-fighting
            alphaTest={0.5}
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
      <obstacleShaderMaterial
        key={ObstacleShaderMaterial.key}
        side={THREE.DoubleSide}
        transparent
        //@ts-expect-error
        map={obstaclesTex}
        // diffuse={new THREE.Vector3(1, 0, 1)}
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

const ObstacleShaderMaterial = shaderMaterial(
  {
    map: null,
    // mapTransform: new THREE.Matrix3(),
    diffuse: new THREE.Vector3(1, 1, 1),
    opacity: 1,
  },
  // meshBasicVertexShader,
  /*glsl*/`
  varying vec2 vUv;

  attribute vec2 uvDimensions;
  attribute vec2 uvOffsets;

  #include <common>
  #include <logdepthbuf_pars_vertex>

  void main() {
    // vUv = uv;
    vUv = (uv * uvDimensions) + uvOffsets;
    vec4 modelViewPosition = vec4(position, 1.0);
    
    #ifdef USE_BATCHING
      modelViewPosition = batchingMatrix * modelViewPosition;
    #endif

    #ifdef USE_INSTANCING
      modelViewPosition = instanceMatrix * modelViewPosition;
    #endif
    
    modelViewPosition = modelViewMatrix * modelViewPosition;
    gl_Position = projectionMatrix * modelViewPosition;

    #include <logdepthbuf_vertex>
  }
  `,
  // meshBasicFragmentShader,
  /*glsl*/`
  varying vec2 vUv;
  uniform sampler2D map;

  #include <common>
  #include <logdepthbuf_pars_fragment>

  void main() {
    gl_FragColor = texture2D( map, vUv );
    // 🔔 fix depth-buffer issue i.e. stop transparent pixels taking precedence
    if(gl_FragColor.a < 0.5) discard;
    #include <logdepthbuf_fragment>
  }
  `,
);

extend({ ObstacleShaderMaterial });
