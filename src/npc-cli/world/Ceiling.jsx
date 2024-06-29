import React from "react";
import * as THREE from "three";

import { Poly } from "../geom";
import { wallHeight, gmFloorExtraScale, worldToSguScale } from "../service/const";
import { keys } from "../service/generic";
import { drawPolygons, isModifierKey, isRMB, isTouchDevice, strokeLine } from "../service/dom";
import { quadGeometryXZ } from "../service/three";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/**
 * @param {Props} props
 */
export default function Ceiling(props) {
  const api = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    tex: api.ceil.tex, // Pass in textures

    detectClick(e) {
      const gmId = Number(e.object.name.slice('ceil-gm-'.length));
      const gm = api.gms[gmId];
      
      // 3d point -> local world coords (ignoring y)
      const mat4 = gm.mat4.clone().invert();
      const localWorldPnt = e.point.clone().applyMatrix4(mat4);
      // local world coords -> canvas coords
      const worldToCanvas = worldToSguScale * gmFloorExtraScale;
      const canvasX = (localWorldPnt.x - gm.pngRect.x) * worldToCanvas;
      const canvasY = (localWorldPnt.z - gm.pngRect.y) * worldToCanvas;

      const ctxt = state.tex[gm.key][0];
      const { data: rgba } = ctxt.getImageData(canvasX, canvasY, 1, 1, { colorSpace: 'srgb' });
      // console.log(Array.from(rgba), { gmId, point3d: e.point, localWorldPnt, canvasX, canvasY });
      
      // ignore clicks on fully transparent pixels
      return rgba[3] === 0 ? null : { gmId };
    },
    drawGmKey(gmKey) {
      const [ct, tex, { width, height }] = state.tex[gmKey];
      const layout = api.geomorphs.layout[gmKey];
      const { pngRect } = layout;

      ct.resetTransform();
      ct.clearRect(0, 0, width, height);

      const worldToCanvas = worldToSguScale * gmFloorExtraScale;
      ct.setTransform(worldToCanvas, 0, 0, worldToCanvas, -pngRect.x * worldToCanvas, -pngRect.y * worldToCanvas);
      
      // wall/door tops
      const strokeColor = 'rgba(150, 150, 150, 1)';
      const fillColor = 'rgba(0, 0, 0, 1)';
      const hullWalls = layout.walls.filter(x => x.meta.hull);
      const { nonHullCeilTops } = api.gmsData[gmKey];
      drawPolygons(ct, nonHullCeilTops, [fillColor, strokeColor, 0.08]);
      drawPolygons(ct, layout.doors.map(x => x.poly), [fillColor, strokeColor, 0.04]);
      drawPolygons(ct, hullWalls, [strokeColor, strokeColor, 0.06]);
      
      tex.needsUpdate = true;
    },
    onPointerDown(e) {
      const result = state.detectClick(e);

      if (result !== null) {
        const { gmId } = result;
        api.events.next({
          key: "pointerdown",
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
            ceiling: true,
            gmId,
            height: wallHeight,
          },
        });
        e.stopPropagation();
      }
    },
    onPointerUp(e) {
      const result = state.detectClick(e);

      if (result !== null) {
        const { gmId } = result;
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
            ceiling: true,
            gmId,
            height: wallHeight,
          },
        });
        e.stopPropagation();
      }
    },
  }));

  api.ceil = state;

  React.useEffect(() => {// ensure initial + redraw on HMR
    // 🚧 handle removal from api.gms (dynamic nav-mesh)
    keys(state.tex).forEach(gmKey => state.drawGmKey(gmKey));
  }, []);

  return <>
    {api.gms.map((gm, gmId) => (
      <group
        key={`${gm.key} ${gmId} ${gm.transform}`}
        onUpdate={(group) => group.applyMatrix4(gm.mat4)}
        // ref={(group) => group?.applyMatrix4(gm.mat4)}
      >
        <mesh
          name={`ceil-gm-${gmId}`}
          geometry={quadGeometryXZ}
          scale={[gm.pngRect.width, 1, gm.pngRect.height]}
          position={[gm.pngRect.x, wallHeight, gm.pngRect.y]}
          onPointerDown={state.onPointerDown}
          onPointerUp={state.onPointerUp}
        >
          <meshBasicMaterial
            side={THREE.FrontSide}
            transparent
            map={state.tex[gm.key][1]}
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
 * @property {Record<Geomorph.GeomorphKey, import("../service/three").CanvasTexDef>} tex
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => null | { gmId: number; }} detectClick
 * @property {(gmKey: Geomorph.GeomorphKey) => void} drawGmKey
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerUp
 */
