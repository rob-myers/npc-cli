import React from "react";
import * as THREE from "three";

import { Mat } from "../geom";
import { info, warn } from "../service/generic";
import { isModifierKey, isRMB, isTouchDevice } from "../service/dom";
import { quadGeometryXZ } from "../service/three";
import * as glsl from "../service/glsl"
import { geomorphService } from "../service/geomorph";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Obstacles(props) {
  const api = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    obsInst: /** @type {*} */ (null),

    addObstacleUvs() {
      const { obstacle: obstaclesSheet, obstacleDim: sheetDim } = api.geomorphs.sheet;
      const uvOffsets = /** @type {number[]} */ ([]);
      const uvDimensions = /** @type {number[]} */ ([]);
  
      api.gms.forEach(({ obstacles }) =>
        obstacles.forEach(({ symbolKey, obstacleId }) => {
          const item = obstaclesSheet[`${symbolKey} ${obstacleId}`];
          if (item) {// (x, y) is top left of sprite in spritesheet
            const { x, y, width, height } = item;
            uvOffsets.push(x / sheetDim.width,  y / sheetDim.height);
            uvDimensions.push(width / sheetDim.width, height / sheetDim.height);
          } else {
            warn(`${symbolKey} (${obstacleId}) not found in sprite-sheet`);
            uvOffsets.push(0,  0);
            uvDimensions.push(1, 1);
          }
        })
      );

      state.obsInst.geometry.setAttribute('uvOffsets',
        new THREE.InstancedBufferAttribute( new Float32Array( uvOffsets ), 2 ),
      );
      state.obsInst.geometry.setAttribute('uvDimensions',
        new THREE.InstancedBufferAttribute( new Float32Array( uvDimensions ), 2 ),
      );
    },
    createObstacleMatrix4(gmTransform, { origPoly: { rect }, transform, height }) {
      const [mat, mat4] = [tmpMat1, tmpMatFour1];
      // transform unit (XZ) square into `rect`, then apply `transform` followed by `gmTransform`
      mat.feedFromArray([rect.width, 0, 0, rect.height, rect.x, rect.y]);
      mat.postMultiply(transform).postMultiply(gmTransform);
      return geomorphService.embedXZMat4(mat.toArray(), { mat4, yHeight: height });
    },
    decodeObstacleId(instanceId) {
      let id = instanceId;
      const gmId = api.gms.findIndex(gm => id < gm.obstacles.length || (id -= gm.obstacles.length, false));
      return { gmId, obstacleId: id };
    },
    detectClick(e) {
      const instanceId = /** @type {number} */ (e.instanceId);
      const { gmId, obstacleId } = state.decodeObstacleId(instanceId);
      const gm = api.gms[gmId];
      const obstacle = gm.obstacles[obstacleId];
      
      // transform 3D point back to unit XZ quad
      const mat4 = state.createObstacleMatrix4(gm.transform, obstacle).invert();
      const unitQuadPnt = e.point.clone().applyMatrix4(mat4);
      // transform unit quad point into spritesheet
      const meta = api.geomorphs.sheet.obstacle[`${obstacle.symbolKey} ${obstacle.obstacleId}`];
      const sheetX = Math.floor(meta.x + unitQuadPnt.x * meta.width);
      const sheetY = Math.floor(meta.y + unitQuadPnt.z * meta.height);

      const canvas = /** @type {HTMLCanvasElement} */ (api.obsTex.image);
      const ctxt = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
      const { data: rgba } = ctxt.getImageData(sheetX, sheetY, 1, 1, { colorSpace: 'srgb' });
      // console.log(rgba, { obstacle, point3d: e.point, unitQuadPnt, sheetX, sheetY });
      
      // ignore clicks on fully transparent pixels
      return rgba[3] === 0 ? null : { gmId, obstacleId, obstacle };
    },

    onPointerDown(e) {
      const instanceId = /** @type {number} */ (e.instanceId);
      const result = state.detectClick(e);

      if (result !== null) {
        const { gmId, obstacle } = result;
        api.events.next({
          key: "pointerdown",
          is3d: true,
          modifierKey: isModifierKey(e.nativeEvent),
          distancePx: 0,
          justLongDown: false,
          pointers: api.ui.getNumPointers(),
          rmb: isRMB(e.nativeEvent),
          screenPoint: { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
          touch: isTouchDevice(),
          point: e.point,
          meta: {
            obstacles: true,
            instanceId,
            gmId,
            obstacleId: obstacle.obstacleId,
            height: obstacle.height,
            ...obstacle.origPoly.meta,
          },
        });
        e.stopPropagation();
      }
    },
    onPointerUp(e) {
      const instanceId = /** @type {number} */ (e.instanceId);
      const result = state.detectClick(e);

      if (result !== null) {
        const { gmId, obstacleId, obstacle } = result;
        api.events.next({
          key: "pointerup",
          is3d: true,
          modifierKey: isModifierKey(e.nativeEvent),
          distancePx: api.ui.getDownDistancePx(),
          justLongDown: api.ui.justLongDown,
          pointers: api.ui.getNumPointers(),
          rmb: isRMB(e.nativeEvent),
          screenPoint: { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY },
          touch: isTouchDevice(),
          point: e.point,
          meta: {
            obstacles: true,
            instanceId,
            gmId,
            obstacleId,
            height: obstacle.height,
            ...obstacle.origPoly.meta,
          },
        });
        e.stopPropagation();
      }
    },
    positionObstacles() {
      const { obsInst } = state;
      let oId = 0;
      api.gms.forEach(({ obstacles, transform: gmTransform }) => {
        obstacles.forEach((obstacle) => {
          const mat4 = state.createObstacleMatrix4(gmTransform, obstacle);
          obsInst.setMatrixAt(oId++, mat4);
        });
      });
      obsInst.instanceMatrix.needsUpdate = true;
      obsInst.computeBoundingSphere();
    },
  }));

  api.obs = state;

  React.useEffect(() => {
    state.addObstacleUvs();
    state.positionObstacles();
  }, [api.hash]);

  return (
    <instancedMesh
      name="static-obstacles"
      key={`${api.hash} static-obstacles`}
      ref={instances => instances && (state.obsInst = instances)}
      args={[quadGeometryXZ, undefined, api.derived.obstaclesCount]}
      frustumCulled={false}
      {...api.obsTex && {
        onPointerUp: state.onPointerUp,
        onPointerDown: state.onPointerDown,
      }}
      position={[0, 0.001, 0]}
    >
      <instancedSpriteSheetMaterial
        key={glsl.InstancedSpriteSheetMaterial.key}
        side={THREE.DoubleSide}
        transparent
        map={api.obsTex}
        // diffuse={new THREE.Vector3(1, 0, 1)}
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
 * @property {THREE.InstancedMesh} obsInst
 * @property {() => void} addObstacleUvs
 * @property {(gmTransform: Geom.SixTuple, obstacle: Geomorph.LayoutObstacle) => THREE.Matrix4} createObstacleMatrix4
 * @property {(instanceId: number) => { gmId: number; obstacleId: number; }} decodeObstacleId
 * Points to `api.gms[gmId].obstacles[obstacleId]`.
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => (
 *   null | { gmId: number; obstacleId: number; obstacle: Geomorph.LayoutObstacle; }
 * )} detectClick
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerUp
 * @property {() => void} positionObstacles
 */

const tmpMat1 = new Mat();
const tmpMatFour1 = new THREE.Matrix4();
const emptyTex = new THREE.Texture();
