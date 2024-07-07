import React from "react";
import * as THREE from "three";
import { testNever } from "../service/generic";
import { geomorphService } from "../service/geomorph";
import { addToDecorGrid, removeFromDecorGrid } from "../service/grid";
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
    nextDecorCid: 0,

    addDecor(ds) {
      const grouped = ds.reduce((agg, d) => {
        const { gmId, roomId } = state.ensureGmRoomId(d);
        (agg[geomorphService.getGmRoomKey(gmId, roomId)]
          ??= { gmId, roomId, add: [], remove: [] }
        ).add.push(d);
        
        const prev = state.decor[d.key];
        if (prev) {// Add pre-existing decor to removal group
          d.updatedAt = Date.now();
          const { gmId, roomId } = prev.meta;
          (agg[geomorphService.getGmRoomKey(gmId, roomId)] ??= { gmId, roomId, add: [], remove: [] }).remove.push(prev);
        }
        return agg;
      }, /** @type {Record<`g${number}r${number}`, Geomorph.GmRoomId & { [x in 'add' | 'remove']: Geomorph.Decor[] }>} */ ({}));

      // 🚧
      for (const { gmId, roomId, remove } of Object.values(grouped)) {
        state.removeRoomDecor(gmId, roomId, remove);
      }
      for (const { gmId, roomId, add } of Object.values(grouped)) {
        state.addRoomDecor(gmId, roomId, add);
      }
    },
    addRoomDecor(gmId, roomId, ds) {
      // 🔔 We assume the provided decor does not currently exist
      if (ds.length === 0) {
        return;
      }
      
      for (const d of ds) {
        addToDecorGrid(d, state.byGrid);

        // 🚧 must add to InstancedMesh too
        state.decor[d.key] = d;
        const atRoom = state.byRoom[gmId][roomId];
        atRoom.decor[d.key] = d;

        if (geomorphService.isDecorPoint(d)) {
          atRoom.points.push(d);
        } else if (geomorphService.isDecorCollidable(d)) {
          atRoom.colliders.push(d);
        } // else 'cuboid'
      }

      w.events.next({ key: 'decors-added', decors: ds });
    },
    ensureGmRoomId(decor) {
      if (!(decor.meta.gmId >= 0 && decor.meta.roomId >= 0)) {
        const decorOrigin = state.getDecorOrigin(decor);
        const gmRoomId = w.gmGraph.findRoomContaining(decorOrigin);
        if (gmRoomId) {
          Object.assign(decor.meta, gmRoomId);
        } else {
          throw new Error(`decor origin must reside in some room: ${JSON.stringify(decor)}`);
        }
      }
      return decor.meta;
    },
    getDecorOrigin(decor) {
      switch (decor.type) {
        case 'circle':
        case 'cuboid':
        case 'poly':
          return decor.center;
        case 'point':
          return decor;
        default:
          throw testNever(decor);
      }
    },
    onPointerDown(e) {
      // 🚧
    },
    onPointerUp(e) {
      // 🚧
    },
    removeRoomDecor(gmId, roomId, ds) {
      if (!ds.length) {
        return;
      }
      
      // 🚧 must remove from InstancedMesh too 
      // e.g. by only changing one transform, and recording "gap"

      // update data structures
      const atRoom = state.byRoom[gmId][roomId];
      ds.forEach(d => {
        delete state.decor[d.key];
        delete atRoom.decor[d.key];
      });

      const points = ds.filter(geomorphService.isDecorPoint);
      atRoom.points = atRoom.points.filter(d => !points.includes(d));
      points.forEach(d => removeFromDecorGrid(d, state.byGrid));
      const colliders = ds.filter(geomorphService.isDecorCollidable);
      atRoom.colliders = atRoom.colliders.filter(d => !colliders.includes(d));
      colliders.forEach(d => removeFromDecorGrid(d, state.byGrid));

      w.events.next({ key: 'decors-removed', decors: ds });
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
 * @property {Geomorph.DecorGrid} byGrid
 * PoCollidable decors in global grid where `byGrid[x][y]` covers the square:
 * (x * decorGridSize, y * decorGridSize, decorGridSize, decorGridSize)
 * @property {Geomorph.RoomDecor[][]} byRoom
 * Decor organised by `byRoom[gmId][roomId]` where (`gmId`, `roomId`) are unique
 * @property {THREE.InstancedMesh} cuboidInst
 * @property {Record<string, Geomorph.Decor>} decor
 * @property {number} decorCuboidCount Total number of decor cuboids
 * @property {number} decorQuadCount Total number of decor quads
 * @property {THREE.InstancedMesh} quadInst
 * @property {number} nextDecorCid
 *
 * @property {(ds: Geomorph.Decor[]) => void} addDecor
 * @property {(gmId: number, roomId: number, decors: Geomorph.Decor[]) => void} addRoomDecor
 * @property {(d: Geomorph.Decor) => Geomorph.GmRoomId} ensureGmRoomId
 * @property {(d: Geomorph.Decor) => Geom.VectJson} getDecorOrigin
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onPointerUp
 * @property {(gmId: number, roomId: number, decors: Geomorph.Decor[]) => void} removeRoomDecor
 */
