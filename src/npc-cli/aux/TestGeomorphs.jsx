import React from "react";
import * as THREE from "three";
import { useQuery } from "@tanstack/react-query";

import { Poly } from "../geom";
import { info, keys } from "../service/generic";
import { FLOOR_IMAGES_QUERY_KEY, worldScale } from "../service/const";
import { quadGeometryXZ } from "../service/three";
import { drawPolygons } from "../service/dom";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * @param {Props} props
 */
export default function TestGeomorphs(props) {
  const api = React.useContext(TestWorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
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
      let oId = 0;
      api.gms.forEach(({ obstacles, transform: gmTransform }) => {
        obstacles.forEach(({ origPoly: { rect }, transform }) => {
          // 🚧 1st transform unit XZ square to rect
          // 🚧 then apply `transform` followed by `gmTransform`
          // obsInst.setMatrixAt(oId++, state.getObsMat(u, v, transform))
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

  React.useEffect(() => {
    state.positionObstacles();
  }, [api.mapKey, api.mapsHash, api.layoutsHash]);

  const update = useUpdate();

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
      key={`${api.mapsHash} ${api.layoutsHash}`}
      ref={instances => instances && (state.obsInst = instances)}
      args={[quadGeometryXZ, undefined, state.getNumObs()]}
      frustumCulled={false}
      onPointerUp={state.onClickObstacle}
    >
      <meshBasicMaterial side={THREE.DoubleSide} color="green" />
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
 * @property {(gmKey: Geomorph.GeomorphKey, img: HTMLImageElement) => void} drawGeomorph
 * @property {(o: Geomorph.LayoutObstacle) => THREE.Matrix4} getObsMat
 * @property {() => number} getNumObs
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onClickObstacle
 * @property {() => void} positionObstacles
 */

const textureLoader = new THREE.TextureLoader();
const tmpPoly1 = new Poly();
