import React from "react";
import * as THREE from "three";

import { Mat, Poly } from "../geom";
import { info, warn } from "../service/generic";
import { wallHeight, worldScale } from "../service/const";
import { drawCircle, drawPolygons, isRMB, isTouchDevice, strokeLine } from "../service/dom";
import { quadGeometryXZ } from "../service/three";
import * as glsl from "../service/glsl"
import { geomorphService } from "../service/geomorph";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function TestSurfaces(props) {
  const api = React.useContext(TestWorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    obsInst: /** @type {*} */ (null),

    addObstacleUvs() {
      const { obstacle: obstaclesSheet, obstaclesWidth, obstaclesHeight } = api.geomorphs.sheet;
      const uvOffsets = /** @type {number[]} */ ([]);
      const uvDimensions = /** @type {number[]} */ ([]);
  
      api.gms.forEach(({ obstacles }) =>
        obstacles.forEach(({ symbolKey, obstacleId }) => {
          const item = obstaclesSheet[`${symbolKey} ${obstacleId}`];
          if (item) {
            const { x, y, width, height } = item;
            uvOffsets.push(x / obstaclesWidth,  1 - (y + height) / obstaclesHeight);
            uvDimensions.push(width / obstaclesWidth, height / obstaclesHeight);
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
    drawFloorAndCeil(gmKey) {
      const img = api.floorImg[gmKey];
      const { floor: [floorCt, , { width, height }], ceil: [ceilCt], layout } = api.gmClass[gmKey];
      const { pngRect } = layout;

      //#region floor
      floorCt.clearRect(0, 0, width, height);
      floorCt.drawImage(img, 0, 0);

      // obstacles drop shadows
      const scale = 1 / worldScale;
      floorCt.setTransform(scale, 0, 0, scale, -pngRect.x * scale, -pngRect.y * scale);
      // avoid doubling shadows e.g. bunk bed, overlapping tables
      const shadowPolys = Poly.union(layout.obstacles.flatMap(x =>
        x.origPoly.meta['no-shadow'] ? [] : x.origPoly.clone().applyMatrix(tmpMat1.setMatrixValue(x.transform))
      ));
      drawPolygons(floorCt, shadowPolys, ['rgba(0, 0, 0, 0.4)', null]);

      // 🚧 debug decor
      floorCt.setTransform(scale, 0, 0, scale, -pngRect.x * scale, -pngRect.y * scale);
      layout.decor.forEach((decor) => {
        if (decor.type === 'circle') {
          drawCircle(floorCt, decor.center, decor.radius, [null, '#500', 0.04]);
        }
      });

      floorCt.resetTransform();
      //#endregion
      
      //#region ceiling
      ceilCt.clearRect(0, 0, width, height);
      ceilCt.setTransform(scale, 0, 0, scale, -pngRect.x * scale, -pngRect.y * scale);
      // wall tops (stroke gaps e.g. bridge desk)
      // drawPolygons(ceilCt, layout.walls, ['rgba(50, 50, 50, 1)', null])
      const wallsTouchingCeil = layout.walls.filter(x =>
        x.meta.h === undefined || (x.meta.y + x.meta.h === wallHeight)
      );
      // drawPolygons(ceilCt, wallsTouchingCeil, ['rgba(250, 50, 50, 1)', 'rgba(250, 50, 50, 1)', 0.06])
      drawPolygons(ceilCt, wallsTouchingCeil, ['rgba(50, 50, 50, 1)', 'rgba(50, 50, 50, 1)', 0.06])
      // door tops
      ceilCt.strokeStyle = 'black';
      ceilCt.lineWidth = 0.03;
      drawPolygons(ceilCt, layout.doors.map(x => x.poly), ['rgba(50, 50, 50, 1)'])
      layout.doors.forEach(x => strokeLine(ceilCt, x.seg[0], x.seg[1]))
      ceilCt.resetTransform();
      //#endregion

      const { floor: [, floor], ceil: [, ceil] } = api.gmClass[gmKey];
      floor.needsUpdate = true;
      ceil.needsUpdate = true;
    },
    onPointerDown(e) {
      const instanceId = /** @type {number} */ (e.instanceId);

      api.events.next({
        key: "pointerdown",
        is3d: true,
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
          // 🚧 infer actual obstacle, ignoring transparent pixels
        },
      });
      e.stopPropagation();
    },
    onPointerUp(e) {
      const instanceId = /** @type {number} */ (e.instanceId);
      // info(`instanceId: ${instanceId}`);

      api.events.next({
        key: "pointerup",
        is3d: true,
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
          // 🚧 infer actual obstacle, ignoring transparent pixels
        },
      });

      // 🚧 temp turn off to permit navigation
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

  api.flat = state;

  React.useEffect(() => {
    state.addObstacleUvs();
    state.positionObstacles();
  }, [api.hash]);

  React.useEffect(() => {
    // (a) ensure initial draw (b) redraw onchange this file
    geomorphService.gmKeys.forEach(
      gmKey => api.floorImg[gmKey] && state.drawFloorAndCeil(gmKey)
    );
  }, []);

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
            map={api.gmClass[gm.key].floor[1]}
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
            map={api.gmClass[gm.key].ceil[1]}
            // depthWrite={false} // fix z-fighting
            alphaTest={0.9} // 0.5 flickered on (301, 101) border
          />
        </mesh>
      </group>
    ))}

    <instancedMesh
      name="static-obstacles"
      key={`${api.hash} static-obstacles`}
      ref={instances => instances && (state.obsInst = instances)}
      args={[quadGeometryXZ, undefined, api.derived.obstaclesCount]}
      frustumCulled={false}
      onPointerUp={state.onPointerUp}
      onPointerDown={state.onPointerDown}
      position={[0, 0.001, 0]} // 🚧 temp
    >
      <obstacleShaderMaterial
        key={glsl.ObstacleShaderMaterial.key}
        side={THREE.DoubleSide}
        transparent
        //@ts-expect-error
        map={api.obsTex}
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
 * @property {(gmKey: Geomorph.GeomorphKey) => void} drawFloorAndCeil
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerUp
 * @property {() => void} positionObstacles
 */

const tmpMat1 = new Mat();
const tmpMatFour1 = new THREE.Matrix4();
const emptyTex = new THREE.Texture();
