import React from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

import { defaultSkinKey, glbMeta, gmLabelHeightSgu, spriteSheetDecorExtraScale } from "../service/const";
import { info, warn } from "../service/generic";
import { createDebugBox, createDebugCylinder, createLabelSpriteSheet, tmpVectThree1, yAxis } from "../service/three";
import { helper } from "../service/helper";
import { Npc, hotModuleReloadNpc } from "./npc";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * @param {Props} props
 */
export default function Npcs(props) {
  const w = React.useContext(WorldContext);

  const gltf = useGLTF(glbMeta.url);

  const state = useStateRef(/** @returns {State} */ () => ({
    group: /** @type {*} */ (null),
    label: {
      numLabels: 0,
      lookup: {},
      tex: new THREE.CanvasTexture(document.createElement('canvas')),
    },
    nextObstacleId: 0,
    npc: {},
    obstacle: {},
    select: { curr: null, prev: null, many: [] },

    findPath(src, dst) {// 🔔 agent may follow different path
      const query = w.crowd.navMeshQuery;
      const { path, success } = query.computePath(src, dst, {
        filter: w.crowd.getFilter(0),
      });
      if (success === false) {
        warn(`${'findPath'} failed: ${JSON.stringify({ src, dst })}`);
      }
      return success === false || path.length === 0 ? null : path;
    },
    getClosestNavigable(p, maxDelta = 0.01) {
      const { success, point: closest } = w.crowd.navMeshQuery.findClosestPoint(p);
      if (success === false) {
        warn(`${'getClosestNavigable'} failed: ${JSON.stringify(p)}`);
      }
      return success === true && tmpVectThree1.copy(closest).distanceTo(p) < maxDelta ? closest : null;
    },
    getNpc(npcKey, processApi) {
      const npc = processApi === undefined
        ? state.npc[npcKey]
        : undefined // 🚧 state.connectNpcToProcess(processApi, npcKey);
      ;
      if (npc === undefined) {
        throw Error(`npc "${npcKey}" does not exist`);
      } else {
        return npc;
      }
    },
    isPointInNavmesh(p) {
      const { success } = w.crowd.navMeshQuery.findClosestPoint(p, { halfExtents: { x: 0, y: 0.1, z: 0 } });
      return success;
    },
    onNpcPointerDown(e) {
      const npcKey = /** @type {string} */ (e.object.userData.npcKey);
      w.events.next(w.ui.getNpcPointerEvent({
        key: "pointerdown",
        event: e,
        is3d: true,
        meta: { npc: true, npcKey },
      }));
      e.stopPropagation();
    },
    onNpcPointerUp(e) {
      const npcKey = /** @type {string} */ (e.object.userData.npcKey);
      w.events.next(w.ui.getNpcPointerEvent({
        key: "pointerup",
        event: e,
        is3d: true,
        meta: { npc: true, npcKey },
      }));
      e.stopPropagation();
    },
    onTick(deltaMs) {
      const npcs = Object.values(state.npc);
      const npcPositions = /** @type {number[]} */ ([]);

      for (const npc of npcs) {
        npc.onTick(deltaMs);
        if (npc.s.moving === true) {
          const { x, y, z } = npc.position;
          npcPositions.push(npc.bodyUid, x, y, z);
        }
      }

      // 🔔 Float32Array caused issues i.e. decode failed
      const positions = new Float64Array(npcPositions);
      w.physics.worker.postMessage({ type: 'send-npc-positions', positions }, [positions.buffer]);
    },
    restore() {// onchange nav-mesh
      // restore agents
      Object.values(state.npc).forEach(npc => {
        if (npc.agent === null) {
          return;
        }
        npc.removeAgent();
        const agent = npc.attachAgent();
        const closest = state.getClosestNavigable(npc.getPosition());
        if (closest === null) {// Agent outside nav keeps target but `Idle`s 
          npc.startAnimation('Idle');
        } else if (npc.s.target !== null) {
          npc.moveTo(npc.s.target);
        } else {// so they'll move "out of the way" of other npcs
          agent.requestMoveTarget(npc.getPosition());
        }
      });
    },
    remove(npcKey) {
      const npc = state.getNpc(npcKey); // throw if n'exist pas
      // npc.setGmRoomId(null);
      delete state.npc[npcKey];
      npc.removeAgent();
      update();
      
      w.events.next({ key: 'removed-npc', npcKey });
    },
    async spawn(e) {
      if (!(e.npcKey && typeof e.npcKey === 'string' && e.npcKey.trim())) {
        throw Error(`invalid npc key: ${JSON.stringify(e.npcKey)}`);
      } else if (!(e.point && typeof e.point.x === 'number' && typeof e.point.z === 'number')) {
        throw Error(`invalid point: ${JSON.stringify(e.point)}`);
      } else if (e.requireNav && state.getClosestNavigable(e.point) === null) {
        throw Error(`cannot spawn outside navPoly: ${JSON.stringify(e.point)}`);
      } else if (e.skinKey && !w.lib.isSkinKey(e.skinKey)) {
        throw Error(`invalid skinKey: ${JSON.stringify(e.skinKey)}`);
      }
      
      const gmRoomId = w.gmGraph.findRoomContaining({ x: e.point.x, y: e.point.z }, true);
      if (gmRoomId === null) {
        throw Error(`must be in some room: ${JSON.stringify(e.point)}`);
      }

      let npc = state.npc[e.npcKey];

      if (npc !== undefined) {// Respawn
        await npc.cancel();
        npc.epochMs = Date.now();

        npc.def = {
          key: e.npcKey,
          angle: e.angle ?? npc.getAngle() ?? 0, // prev angle fallback
          skinKey: e.skinKey ?? npc.def.skinKey,
          position: e.point, // 🚧 remove?
          runSpeed: e.runSpeed ?? helper.defaults.runSpeed,
          walkSpeed: e.walkSpeed ?? helper.defaults.walkSpeed,
        };
        if (typeof e.skinKey === 'string') {
          npc.changeSkin(e.skinKey);
        }
        // Reorder keys
        delete state.npc[e.npcKey];
        state.npc[e.npcKey] = npc;
      } else {
        // Spawn
        npc = state.npc[e.npcKey] = new Npc({
          key: e.npcKey,
          angle: e.angle ?? 0,
          skinKey: e.skinKey ?? defaultSkinKey,
          position: e.point,
          runSpeed: e.runSpeed ?? helper.defaults.runSpeed,
          walkSpeed: e.walkSpeed ?? helper.defaults.walkSpeed,
        }, w);

        npc.initialize(gltf);
      }
      
      // 🚧 rethink
      if (npc.agent !== null) {
        if (e.agent === false) {
          npc.removeAgent();
        } else {
          npc.agent.teleport(e.point);
          // npc.startAnimation('Idle');
        }
      } else {
        npc.setPosition(e.point);
        this.group.setRotationFromAxisAngle(yAxis, npc.def.angle);
        // pin to current position, so "moves out of the way"
        e.agent && npc.attachAgent().requestMoveTarget(e.point);
      }

      update();
      npc.s.spawns++;
      w.events.next({ key: 'spawned', npcKey: npc.key, gmRoomId });
      // state.npc[e.npcKey].doMeta = e.meta?.do ? e.meta : null;
      return npc;
    },
    updateLabels(labels) {
      const fontHeight = gmLabelHeightSgu * spriteSheetDecorExtraScale;
      createLabelSpriteSheet(labels, state.label, fontHeight);
    },
  }));

  w.npc = state;
  w.n = state.npc;

  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      info('hot-reloading npcs');
      Object.values(state.npc).forEach(npc =>
        state.npc[npc.key] = hotModuleReloadNpc(npc)
      );
    }
  }, []);

  const update = useUpdate();

  return (
    <group
      name="npcs"
      ref={x => state.group = x ?? state.group}
      onPointerDown={state.onNpcPointerDown}
      onPointerUp={state.onNpcPointerUp}
    >
      {Object.values(state.npc).map(npc =>
        <NPC key={npc.key} npc={npc} />
      )}
    </group>
  );
}

/**
 * @typedef Props
 * @property {boolean} [disabled]
 */

/**
 * @typedef State
 * @property {THREE.Group} group
 * @property {import("../service/three").LabelsSheetAndTex} label
 * @property {{ [npcKey: string]: Npc }} npc
 * @property {{ curr: null | string; prev: null | string; many: string[]; }} select 🚧 move to script
 * @property {number} nextObstacleId
 * @property {Record<string, NPC.Obstacle>} obstacle
 *
 * @property {(src: THREE.Vector3Like, dst: THREE.Vector3Like) => null | THREE.Vector3Like[]} findPath
 * @property {(npcKey: string, processApi?: any) => NPC.NPC} getNpc
 * Throws if does not exist
 * 🚧 any -> ProcessApi (?)
 * @property {(p: THREE.Vector3Like, maxDelta?: number) => null | THREE.Vector3Like} getClosestNavigable
 * @property {(p: THREE.Vector3Like) => boolean} isPointInNavmesh
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onNpcPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onNpcPointerUp
 * @property {() => void} restore
 * @property {(deltaMs: number) => void} onTick
 * @property {(npcKey: string) => void} remove
 * @property {(e: NPC.SpawnOpts) => Promise<NPC.NPC>} spawn
 * @property {(labels: string[]) => void} updateLabels
 */

useGLTF.preload(glbMeta.url);

/**
 * @param {{ npc: Npc }} props 
 */
function NPC({ npc }) {
  const { m } = npc;

  return (
    <group
      ref={npc.onMount} // avoid inline ref
      scale={glbMeta.scale}
      // dispose={null}
    >
      <group position={[0, 3, 0]}>
        {m.bones.map((bone, i) => <primitive key={i} object={bone} />)}
        <skinnedMesh
          geometry={m.mesh.geometry}
          position={m.mesh.position}
          skeleton={m.mesh.skeleton}
          userData={m.mesh.userData}
        >
          <meshPhysicalMaterial transparent map={m.material.map} />
        </skinnedMesh>
      </group>
    </group>
  )
}
