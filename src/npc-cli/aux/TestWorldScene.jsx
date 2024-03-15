import React from "react";
import * as THREE from "three";

import { assertDefined, keys } from "../service/generic";
import { worldScale } from "../service/const";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { customQuadGeometry } from "../service/three";
import { Poly, Rect } from "../geom";
import { fillPolygons } from "../service/dom";
import { geomorphService } from "../service/geomorph";

/**
 * @param {Props} props
 */
export default function TestWorldScene(props) {
  /** @type {State} */
  const state = useStateRef(() => ({
    drawGeomorph(gmKey, img) {
      const { ctxt, layout } = api.gmClass[gmKey];
      const { pngRect } = layout;

      ctxt.clearRect(0, 0, pngRect.width, pngRect.width);
      ctxt.drawImage(img, 0, 0);

      // 🚧
      ctxt.fillStyle = "green";
      const { hullKey } = geomorphService.gmKeyToKeys(gmKey);
      const { doors } = api.assets.symbols[hullKey];
      const hullDoors = doors.flatMap(({ meta, poly }) => (meta.hull ? poly : []));
      ctxt.translate(-pngRect.x, -pngRect.y);
      // fillPolygons(ctxt, hullDoors);
      // fillPolygons(ctxt, [extHull]);
      ctxt.resetTransform();
    },
  }));

  const api = React.useContext(TestWorldContext);
  api.scene = state;

  React.useLayoutEffect(() => {
    keys(api.gmClass).forEach((gmKey) => {
      textureLoader.loadAsync(`/assets/debug/${gmKey}.png`).then((tex) => {
        const img = /** @type {HTMLImageElement} */ (tex.source.data);
        state.drawGeomorph(gmKey, img);
        assertDefined(api.gmClass[gmKey].tex).needsUpdate = true;
        update();
      });
    });
  }, [api.map]);

  const update = useUpdate();

  return (
    <>
      {api.gms.map((gm, gmId) => (
        <group key={gm.transform.toString()} onUpdate={(self) => self.applyMatrix4(gm.mat4)}>
          <mesh
            scale={[gm.pngRect.width * worldScale, 1, gm.pngRect.height * worldScale]}
            geometry={customQuadGeometry}
            position={[gm.pngRect.x * worldScale, 0, gm.pngRect.y * worldScale]}
          >
            <meshBasicMaterial
              side={THREE.DoubleSide}
              transparent
              map={api.gmClass[gm.key].tex}
              depthWrite={false} // fix z-fighting
            ></meshBasicMaterial>
          </mesh>
        </group>
      ))}
    </>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {(gmKey: Geomorph.GeomorphKey, img: HTMLImageElement) => void} drawGeomorph
 */

const textureLoader = new THREE.TextureLoader();
