import React from "react";
import * as THREE from "three";
import { boxGeometry, quadGeometryXZ } from "../service/three";
import * as glsl from "../service/glsl";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";

/** @param {Props} props */
export default function Decor(props) {
  const w = React.useContext(WorldContext);

  const state = useStateRef(/** @returns {State} */ () => ({
    cuboidInst: /** @type {*} */ (null),
    decorCuboidCount: 0,
    decorQuadCount: 0,
    quadInst: /** @type {*} */ (null),

    byGrid: [],
    byRoom: w.gms.map(_ => []),
    decor: {},

    addDecor(ds) {
      // ✅ need gmGraph.findRoomContaining

      // const grouped = ds.reduce((agg, d) => {
      //   const { gmId, roomId } = ensureDecorMetaGmRoomId(d, api.gmGraph);
      //   (agg[getGmRoomKey(gmId, roomId)] ??= { gmId, roomId, add: [], remove: [] }).add.push(d);
        
      //   const prev = state.decor[d.key];
      //   if (prev) {// Add pre-existing decor to removal group
      //     d.updatedAt = Date.now();
      //     const { gmId, roomId } = prev.meta;
      //     (agg[getGmRoomKey(gmId, roomId)] ??= { gmId, roomId, add: [], remove: [] }).remove.push(prev);
      //   }
      //   return agg;
      // }, /** @type {{ [key: string]: Geomorph.GmRoomId & { [x in 'add' | 'remove']: NPC.DecorDef[] }}} */ ({}));

      // 🚧
      // Object.values(grouped).forEach(({ gmId, roomId, remove }) =>
      //   state.removeRoomDecor(gmId, roomId, remove)
      // );
      // Object.values(grouped).forEach(({ gmId, roomId, add }) =>
      //   state.addRoomDecor(gmId, roomId, add)
      // );
    },

    onPointerDown(e) {
      // 🚧
    },
    onPointerUp(e) {
      // 🚧
    },
  }));

  w.decor = state;

  return <>
    <instancedMesh
      name="decor-cuboids"
      key={`${w.hash} ${state.decorCuboidCount} cuboids`}
      ref={instances => instances && (state.cuboidInst = instances)}
      args={[boxGeometry, undefined, state.decorCuboidCount]}
      frustumCulled={false}
      onPointerUp={state.onPointerUp}
      onPointerDown={state.onPointerDown}
    >
      <meshBasicMaterial
        color="red" // 🚧
      />
    </instancedMesh>

    <instancedMesh
      name="decor-quads"
      key={`${w.hash} ${state.decorQuadCount} quads`}
      ref={instances => instances && (state.quadInst = instances)}
      args={[quadGeometryXZ, undefined, state.decorQuadCount]}
      frustumCulled={false}
      onPointerUp={state.onPointerUp}
      onPointerDown={state.onPointerDown}
    >
      <instancedSpriteSheetMaterial
        key={glsl.InstancedSpriteSheetMaterial.key}
        side={THREE.DoubleSide}
        map={w.decorTex}
        transparent
      />
    </instancedMesh>
  </>;
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {THREE.InstancedMesh} quadInst
 * @property {Geomorph.DecorGrid} byGrid
 * PoCollidable decors in global grid where `byGrid[x][y]` covers the square:
 * (x * decorGridSize, y * decorGridSize, decorGridSize, decorGridSize)
 * @property {Geomorph.RoomDecor[][]} byRoom
 * Decor organised by `byRoom[gmId][roomId]` where (`gmId`, `roomId`) are unique
 * @property {THREE.InstancedMesh} cuboidInst
 * @property {Record<number, Geomorph.Decor>} decor
 * @property {number} decorCuboidCount Total number of decor cuboids
 * @property {number} decorQuadCount Total number of decor quads
 * @property {(ds: Geomorph.Decor[]) => void} addDecor
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerUp
 */
