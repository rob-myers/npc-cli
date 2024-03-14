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

/**
 * @param {Props} props
 */
export default function TestWorldScene(props) {
  /** @type {State} */
  const state = useStateRef(() => ({
    drawGeomorph(gmKey, img) {
      // 🚧
      const { ctxt, layout } = api.gmClass[gmKey];
      const bounds = new Rect(0, 0, layout.pngRect.width, layout.pngRect.height);

      ctxt.clearRect(0, 0, bounds.width, bounds.height);
      ctxt.drawImage(img, 0, 0);

      // prettier-ignore
      const extHull = new Poly(bounds.points, [bounds.clone().inset(6.5 + 6.5).points.reverse()]);
      // fix z-fighting
      ctxt.fillStyle = "green";
      fillPolygons(ctxt, [extHull]);
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
  }, [props.map]);

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
 * @property {Geomorph.MapDef} map
 */

/**
 * @typedef State
 * @property {(gmKey: Geomorph.GeomorphKey, img: HTMLImageElement) => void} drawGeomorph
 */

const textureLoader = new THREE.TextureLoader();
