import React from "react";
import * as THREE from "three";

import { Mat } from "../geom";
import { info, warn } from "../service/generic";
import { getColor, getQuadGeometryXZ } from "../service/three";
import * as glsl from "../service/glsl"
import { geomorph } from "../service/geomorph";
import { instancedMeshName } from "../service/const";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Obstacles(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    inst: /** @type {*} */ (null),
    quad: getQuadGeometryXZ(`${w.key}-obs-xz`),

    addObstacleUvs() {
      const { obstacle: sheet, maxObstacleDim: sheetDim } = w.geomorphs.sheet;
      const uvOffsets = /** @type {number[]} */ ([]);
      const uvDimensions = /** @type {number[]} */ ([]);
      const uvTextureIds = /** @type {number[]} */ ([]);
      const instanceIds = /** @type {number[]} */ ([]);
  
      w.gms.forEach(({ obstacles }) =>
        obstacles.forEach(({ symbolKey, obstacleId }) => {
          const item = sheet[`${symbolKey} ${obstacleId}`];
          if (item) {// (x, y) is top left of sprite in spritesheet
            const { x, y, width, height } = item;
            uvOffsets.push(x / sheetDim.width,  y / sheetDim.height);
            uvDimensions.push(width / sheetDim.width, height / sheetDim.height);
          } else {
            warn(`${symbolKey} (${obstacleId}) not found in sprite-sheet`);
            uvOffsets.push(0, 0);
            uvDimensions.push(1, 1);
          }
          uvTextureIds.push(item.sheetId);
          instanceIds.push(instanceIds.length);
        })
      );

      state.quad.setAttribute('uvOffsets',
        new THREE.InstancedBufferAttribute( new Float32Array( uvOffsets ), 2 ),
      );
      state.quad.setAttribute('uvDimensions',
        new THREE.InstancedBufferAttribute( new Float32Array( uvDimensions ), 2 ),
      );
      state.quad.setAttribute('uvTextureIds',
        new THREE.InstancedBufferAttribute(new Uint32Array(uvTextureIds), 1),
      );
      state.quad.setAttribute('instanceIds',
        new THREE.InstancedBufferAttribute(new Uint32Array(instanceIds), 1),
      );
    },
    createObstacleMatrix4(gmTransform, { origPoly: { rect }, transform, height }) {
      const [mat, mat4] = [tmpMat1, tmpMatFour1];
      // transform unit (XZ) square into `rect`, then apply `transform` followed by `gmTransform`
      mat.feedFromArray([rect.width, 0, 0, rect.height, rect.x, rect.y]);
      mat.postMultiply(transform).postMultiply(gmTransform);
      return geomorph.embedXZMat4(mat.toArray(), { mat4, yHeight: height });
    },
    decodeInstanceId(instanceId) {
      let id = instanceId;
      const gmId = w.gms.findIndex(gm => id < gm.obstacles.length || (id -= gm.obstacles.length, false));
      const gm = w.gms[gmId];
      const obstacle = gm.obstacles[id];
      return {
        gmId,
        ...obstacle.meta,
        height: obstacle.height,
      };
    },
    positionObstacles() {
      const { inst: obsInst } = state;
      let oId = 0;
      const defaultObstacleColor = '#fff'; // 🚧 move to const
      w.gms.forEach(({ obstacles, transform: gmTransform }) => {
        obstacles.forEach(o => {
          const mat4 = state.createObstacleMatrix4(gmTransform, o);
          obsInst.setColorAt(oId, getColor(o.meta.color ?? defaultObstacleColor));
          obsInst.setMatrixAt(oId, mat4);
          oId++;
        });
      });

      obsInst.instanceMatrix.needsUpdate = true;
      if (obsInst.instanceColor !== null) {
        obsInst.instanceColor.needsUpdate = true;
      }
      obsInst.computeBoundingSphere();
    },
  }));

  w.obs = state;

  React.useEffect(() => {
    state.addObstacleUvs();
    state.positionObstacles();
  }, [w.mapKey, w.hash.full, w.gmsData.obstaclesCount]);

  return (
    <instancedMesh
      name={instancedMeshName.obstacles}
      key={`${[w.mapKey, w.hash.full]}`}
      ref={instances => instances && (state.inst = instances)}
      args={[state.quad, undefined, w.gmsData.obstaclesCount]}
      frustumCulled={false}
      position={[0, 0.001, 0]} // 🚧
      renderOrder={-1}
    >
      <instancedMultiTextureMaterial
        key={glsl.InstancedMultiTextureMaterial.key}
        side={THREE.DoubleSide}
        transparent
        atlas={w.texObs.tex}
        diffuse={[0.4, 0.4, 0.4]}
        objectPickRed={6}
        alphaTest={0.5}
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
 * @property {THREE.InstancedMesh} inst
 * @property {THREE.BufferGeometry} quad
 * @property {() => void} addObstacleUvs
 * @property {(gmTransform: Geom.SixTuple, obstacle: Geomorph.LayoutObstacle) => THREE.Matrix4} createObstacleMatrix4
 * @property {(instanceId: number) => Meta<{ gmId: number}>} decodeInstanceId
 * Points to `w.gms[gmId].obstacles[obstacleId]`.
 * @property {() => void} positionObstacles
 */

const tmpMat1 = new Mat();
const tmpMatFour1 = new THREE.Matrix4();
