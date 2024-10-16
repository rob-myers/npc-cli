import React from "react";
import * as THREE from "three";

import { Mat } from "../geom";
import { info, warn } from "../service/generic";
import { getColor, getQuadGeometryXZ } from "../service/three";
import * as glsl from "../service/glsl"
import { geomorph } from "../service/geomorph";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Obstacles(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    inst: /** @type {*} */ (null),
    quadGeom: getQuadGeometryXZ(`${w.key}-obs-xz`),

    addObstacleUvs() {
      const { obstacle: sheet, obstacleDim: sheetDim } = w.geomorphs.sheet;
      const uvOffsets = /** @type {number[]} */ ([]);
      const uvDimensions = /** @type {number[]} */ ([]);
  
      w.gms.forEach(({ obstacles }) =>
        obstacles.forEach(({ symbolKey, obstacleId }) => {
          const item = sheet[`${symbolKey} ${obstacleId}`];
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

      state.inst.geometry.setAttribute('uvOffsets',
        new THREE.InstancedBufferAttribute( new Float32Array( uvOffsets ), 2 ),
      );
      state.inst.geometry.setAttribute('uvDimensions',
        new THREE.InstancedBufferAttribute( new Float32Array( uvDimensions ), 2 ),
      );
    },
    createObstacleMatrix4(gmTransform, { origPoly: { rect }, transform, height }) {
      const [mat, mat4] = [tmpMat1, tmpMatFour1];
      // transform unit (XZ) square into `rect`, then apply `transform` followed by `gmTransform`
      mat.feedFromArray([rect.width, 0, 0, rect.height, rect.x, rect.y]);
      mat.postMultiply(transform).postMultiply(gmTransform);
      return geomorph.embedXZMat4(mat.toArray(), { mat4, yHeight: height });
    },
    decodeObstacleId(instanceId) {
      let id = instanceId;
      const gmId = w.gms.findIndex(gm => id < gm.obstacles.length || (id -= gm.obstacles.length, false));
      return { gmId, obstacleId: id };
    },
    detectClick(e) {
      const instanceId = /** @type {number} */ (e.instanceId);
      const { gmId, obstacleId } = state.decodeObstacleId(instanceId);
      const gm = w.gms[gmId];
      const obstacle = gm.obstacles[obstacleId];
      
      // transform 3D point back to unit XZ quad
      const mat4 = state.createObstacleMatrix4(gm.transform, obstacle).invert();
      const unitQuadPnt = e.point.clone().applyMatrix4(mat4);
      // transform unit quad point into spritesheet
      const meta = w.geomorphs.sheet.obstacle[`${obstacle.symbolKey} ${obstacle.obstacleId}`];
      const sheetX = Math.floor(meta.x + unitQuadPnt.x * meta.width);
      const sheetY = Math.floor(meta.y + unitQuadPnt.z * meta.height);

      const { ct } = w.obsTex;
      const { data: rgba } = ct.getImageData(sheetX, sheetY, 1, 1, { colorSpace: 'srgb' });
      // console.log(rgba, { obstacle, point3d: e.point, unitQuadPnt, sheetX, sheetY });
      
      // ignore clicks on fully transparent pixels
      return rgba[3] === 0 ? null : { gmId, obstacleId, obstacle };
    },
    onPointerDown(e) {
      const instanceId = /** @type {number} */ (e.instanceId);
      const result = state.detectClick(e);

      if (result !== null) {
        const { gmId, obstacle } = result;
        w.events.next(w.ui.getNpcPointerEvent({
          key: "pointerdown",
          distancePx: 0,
          event: e,
          is3d: true,
          justLongDown: false,
          meta: {
            gmId,
            obstacleId: obstacle.obstacleId,
            height: obstacle.height,
            ...obstacle.origPoly.meta,
            instanceId,
          },
        }));
        e.stopPropagation();
      }
    },
    onPointerUp(e) {
      const instanceId = /** @type {number} */ (e.instanceId);
      const result = state.detectClick(e);

      if (result !== null) {
        const { gmId, obstacleId, obstacle } = result;
        w.events.next(w.ui.getNpcPointerEvent({
          key: "pointerup",
          event: e,
          is3d: true,
          meta: {
            gmId,
            obstacleId,
            height: obstacle.height,
            ...obstacle.origPoly.meta,
            instanceId,
          },
        }));
        e.stopPropagation();
      }
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
      name="static-obstacles"
      key={`${[w.mapKey, w.hash.full]}`}
      ref={instances => instances && (state.inst = instances)}
      args={[state.quadGeom, undefined, w.gmsData.obstaclesCount]}
      frustumCulled={false}
      {...w.obsTex && {
        onPointerUp: state.onPointerUp,
        onPointerDown: state.onPointerDown,
      }}
      position={[0, 0.001, 0]} // 🚧
    >
      <instancedSpriteSheetMaterial
        key={glsl.InstancedSpriteSheetMaterial.key}
        side={THREE.DoubleSide}
        transparent
        map={w.obsTex.tex}
        diffuse={new THREE.Vector3(0.6, 0.6, 0.6)}
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
 * @property {THREE.BufferGeometry} quadGeom
 * @property {() => void} addObstacleUvs
 * @property {(gmTransform: Geom.SixTuple, obstacle: Geomorph.LayoutObstacle) => THREE.Matrix4} createObstacleMatrix4
 * @property {(instanceId: number) => { gmId: number; obstacleId: number; }} decodeObstacleId
 * Points to `w.gms[gmId].obstacles[obstacleId]`.
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => (
 *   null | { gmId: number; obstacleId: number; obstacle: Geomorph.LayoutObstacle; }
 * )} detectClick
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerUp
 * @property {() => void} positionObstacles
 */

const tmpMat1 = new Mat();
const tmpMatFour1 = new THREE.Matrix4();
