import React from "react";
import * as THREE from "three";

import { wallHeight, gmFloorExtraScale, worldToSguScale, sguToWorldScale } from "../service/const";
import { keys, pause } from "../service/generic";
import { drawPolygons } from "../service/dom";
import { getQuadGeometryXZ } from "../service/three";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Ceiling(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    thickerTops: false,
    tex: w.ceil.tex, // Pass in textures

    detectClick(e) {
      const gmId = Number(e.object.name.slice('ceil-gm-'.length));
      const gm = w.gms[gmId];
      
      // 3d point -> local world coords (ignoring y)
      const mat4 = gm.mat4.clone().invert();
      const localWorldPnt = e.point.clone().applyMatrix4(mat4);
      // local world coords -> canvas coords
      const worldToCanvas = worldToSguScale * gmFloorExtraScale;
      const canvasX = (localWorldPnt.x - gm.pngRect.x) * worldToCanvas;
      const canvasY = (localWorldPnt.z - gm.pngRect.y) * worldToCanvas;

      const { ct } = state.tex[gm.key];
      const { data: rgba } = ct.getImageData(canvasX, canvasY, 1, 1, { colorSpace: 'srgb' });
      // console.log(Array.from(rgba), { gmId, point3d: e.point, localWorldPnt, canvasX, canvasY });
      
      // ignore clicks on fully transparent pixels
      return rgba[3] === 0 ? null : { gmId };
    },
    async draw() {
      for (const gmKey of keys(state.tex)) {
        state.drawGmKey(gmKey);
        await pause();
      }
    },
    drawGmKey(gmKey) {
      const { ct, tex, canvas} = state.tex[gmKey];
      const layout = w.geomorphs.layout[gmKey];
      const { pngRect } = layout;

      ct.resetTransform();
      ct.clearRect(0, 0, canvas.width, canvas.height);

      const worldToCanvas = worldToSguScale * gmFloorExtraScale;
      ct.setTransform(worldToCanvas, 0, 0, worldToCanvas, -pngRect.x * worldToCanvas, -pngRect.y * worldToCanvas);
      
      const { tops, polyDecals } = w.gmsData[gmKey];
      
      // wall/door tops
      const black = 'rgb(0, 0, 0)';
      const grey90 = 'rgb(90, 90, 90)';
      const grey60 = 'rgb(60, 60, 60)';
      const grey100 = 'rgb(100, 100, 100)';
      const thinLineWidth = 0.04;
      const thickLineWidth = 0.08;

      if (state.thickerTops) {
        drawPolygons(ct, tops.nonHull, [grey60, null]);
        drawPolygons(ct, tops.door.filter(x => !x.meta.hull), [grey60, null]);
        drawPolygons(ct, tops.door.filter(x => x.meta.hull), [grey60, null]);
        drawPolygons(ct, tops.broad, [black, grey90, thickLineWidth]);
      } else {
        drawPolygons(ct, tops.nonHull, [black, grey60, thinLineWidth]);
        drawPolygons(ct, tops.door.filter(x => !x.meta.hull), [black, grey60, thinLineWidth]);
        drawPolygons(ct, tops.door.filter(x => x.meta.hull), [grey60, grey60]);
      }

      const hullWalls = layout.walls.filter(x => x.meta.hull);
      drawPolygons(ct, hullWalls, [grey60, grey60]);
      
      // decals
      polyDecals.filter(x => x.meta.ceil === true).forEach(x => {
        const strokeWidth = typeof x.meta.strokeWidth === 'number'
          ? x.meta.strokeWidth * sguToWorldScale
          : 0.08;
        drawPolygons(ct, x, [x.meta.fill || 'red', x.meta.stroke || 'white', strokeWidth]);
        // drawPolygons(ct, x, ['red', 'white', 0.08]);
      });

      tex.needsUpdate = true;
    },
    onPointerDown(e) {
      const result = state.detectClick(e);

      if (result !== null) {
        const { gmId } = result;
        w.events.next(w.ui.getNpcPointerEvent({
          key: "pointerdown",
          event: e,
          is3d: true,
          meta: {
            ceiling: true,
            gmId,
            height: wallHeight,
          },
        }));
        e.stopPropagation();
      }
    },
    onPointerUp(e) {
      const result = state.detectClick(e);

      if (result !== null) {
        const { gmId } = result;
        w.events.next(w.ui.getNpcPointerEvent({
          key: "pointerup",
          event: e,
          is3d: true,
          meta: {
            ceiling: true,
            gmId,
            height: wallHeight,
          },
        }));
        e.stopPropagation();
      }
    },
  }));

  w.ceil = state;

  React.useEffect(() => {
    // ensure initial + redraw on HMR
    // 🚧 handle removal from w.gms (dynamic nav-mesh)
    state.draw();
  }, [w.mapKey, w.hash.full, w.hmr.createGmsData]);

  return <>
    {w.gms.map((gm, gmId) => (
      <group
        key={`${gm.key} ${gmId} ${gm.transform}`}
        onUpdate={(group) => group.applyMatrix4(gm.mat4)}
        // ref={(group) => group?.applyMatrix4(gm.mat4)}
      >
        <mesh
          name={`ceil-gm-${gmId}`}
          geometry={getQuadGeometryXZ('vanilla-xz')}
          scale={[gm.pngRect.width, 1, gm.pngRect.height]}
          position={[gm.pngRect.x, wallHeight, gm.pngRect.y]}
          onPointerDown={state.onPointerDown}
          onPointerUp={state.onPointerUp}
        >
          <meshBasicMaterial
            side={THREE.FrontSide}
            transparent
            map={state.tex[gm.key].tex}
            // depthWrite={false} // fix z-fighting
            alphaTest={0.9} // 0.5 flickered on (301, 101) border
          />
        </mesh>
      </group>
    ))}
  </>
  
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {boolean} thickerTops
 * @property {Record<Geomorph.GeomorphKey, import("../service/three").CanvasTexMeta>} tex
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => null | { gmId: number; }} detectClick
 * @property {() => Promise<void>} draw
 * @property {(gmKey: Geomorph.GeomorphKey) => void} drawGmKey
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerUp
 */
