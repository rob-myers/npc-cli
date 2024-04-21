import React from "react";
import * as THREE from "three";
import { useQuery } from "@tanstack/react-query";

import { keys } from "../service/generic";
import { FLOOR_IMAGES_QUERY_KEY, worldScale } from "../service/const";
import { quadGeometryXZ } from "../service/three";
import { TestWorldContext } from "./test-world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";
import { drawPolygons } from "../service/dom";

/**
 * @param {Props} props
 */
export default function TestGeomorphs(props) {
  const api = React.useContext(TestWorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
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

  const update = useUpdate();

  return api.gms.map((gm, gmId) => (
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
        />
      </mesh>
    </group>
  ));
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
