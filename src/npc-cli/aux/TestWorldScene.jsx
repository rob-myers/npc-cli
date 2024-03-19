import React from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";

import { assertDefined, keys, warn } from "../service/generic";
import { worldScale } from "../service/const";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { quadGeometryXY, quadGeometryXZ } from "../service/three";
import { Mat, Vect } from "../geom";
import { drawPolygons, strokeLine } from "../service/dom";
import { geomorphService } from "../service/geomorph";

/**
 * @param {Props} props
 */
export default function TestWorldScene(props) {
  const api = React.useContext(TestWorldContext);

  const state = useStateRef(
    /** @returns {State} */ () => ({
      wallsKey: api.scene.wallsKey,
      wallInstances: /** @type {*} */ (null),
      drawGeomorph(gmKey, img) {
        const { ctxt, layout } = api.gmData[gmKey];
        const { pngRect } = layout;
        const { hullKey } = geomorphService.gmKeyToKeys(gmKey);
        const { doors: hullDoors, symbols: subSymbols } = api.assets.symbols[hullKey];

        ctxt.clearRect(0, 0, pngRect.width, pngRect.width);
        ctxt.drawImage(img, 0, 0);

        // draw hull doors
        ctxt.translate(-pngRect.x, -pngRect.y);
        ctxt.lineWidth = 2;
        ctxt.strokeStyle = "rgba(0, 0, 0, 1)";
        ctxt.fillStyle = "rgba(255, 255, 255, 1)";
        drawPolygons(ctxt, hullDoors, "fill-stroke");

        ctxt.resetTransform();
      },
      positionWalls() {
        const instances = state.wallInstances;
        const height = 2;
        const [src, dst] = [new Vect(), new Vect()];
        let offset = 0;
        api.gms.forEach(({ key: gmKey, wallSegs, transform }, gmId) => {
          tmpMat1.feedFromArray(transform);
          wallSegs.forEach(([u, v], segId) => {
            if (u.equalsAlmost(v)) {
              return warn(`${gmKey}: ${segId}: ignored degen wallSeg: ${JSON.stringify(u.json)}`);
            }
            const segLength = u.distanceTo(v) * worldScale;
            tmpMat1.transformPoint(src.copy(u));
            tmpMat1.transformPoint(dst.copy(v));
            const radians = Math.atan2(dst.y - src.y, dst.x - src.x);
            // prettier-ignore
            instances.setMatrixAt(offset, geomorphService.embedXZMat4(
              [segLength * Math.cos(radians), segLength * Math.sin(radians), -Math.sin(radians), Math.cos(radians), src.x, src.y],
              height,
              tmpMatFour1,
            ));
            offset++;
          });
        });
        instances.instanceMatrix.needsUpdate = true;
      },
    })
  );

  api.scene = state;

  React.useEffect(() => {
    keys(api.gmData).forEach((gmKey) => {
      textureLoader.loadAsync(`/assets/debug/${gmKey}.png`).then((tex) => {
        const img = /** @type {HTMLImageElement} */ (tex.source.data);
        state.drawGeomorph(gmKey, img);
        assertDefined(api.gmData[gmKey].tex).needsUpdate = true;
        update();
      });
    });
    state.wallInstances && state.positionWalls();
  }, [api.assets, api.map]);

  const update = useUpdate();

  // const testUvTex = useLoader(THREE.TextureLoader, "/assets/debug/test-uv-texture.png");

  return (
    <>
      {api.gms.map((gm, gmId) => (
        <group key={gm.transform.toString()} onUpdate={(self) => self.applyMatrix4(gm.mat4)}>
          <mesh
            scale={[gm.pngRect.width * worldScale, 1, gm.pngRect.height * worldScale]}
            geometry={quadGeometryXZ}
            position={[gm.pngRect.x * worldScale, 0, gm.pngRect.y * worldScale]}
          >
            <meshBasicMaterial
              side={THREE.DoubleSide}
              transparent
              map={api.gmData[gm.key].tex}
              depthWrite={false} // fix z-fighting
            />
          </mesh>
        </group>
      ))}

      <instancedMesh
        key={state.wallsKey}
        onUpdate={(instances) => {
          state.wallInstances = instances;
          // state.positionWalls();
        }}
        args={[quadGeometryXY, undefined, state.wallsKey]}
        frustumCulled={false}
      >
        <meshBasicMaterial
          side={THREE.DoubleSide}
          // map={testUvTex}
          // toneMapped={false}
          color="black"
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
 * @property {number} wallsKey Used to remount walls
 * @property {THREE.InstancedMesh} wallInstances
 * @property {(gmKey: Geomorph.GeomorphKey, img: HTMLImageElement) => void} drawGeomorph
 * @property {() => void} positionWalls
 */

const textureLoader = new THREE.TextureLoader();
const tmpMat1 = new Mat();
const tmpMatFour1 = new THREE.Matrix4();
const tmpMatFour2 = new THREE.Matrix4();
