import React from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

import { defaultClassKey, defaultSkinKey, glbMeta, gmLabelHeightSgu, npcClassToMeta, spriteSheetDecorExtraScale } from "../service/const";
import { info, warn } from "../service/generic";
import { getCanvas } from "../service/dom";
import { createLabelSpriteSheet, toV3, yAxis } from "../service/three";
import { helper } from "../service/helper";
import { cmUvService } from "../service/uv";
import { Npc, hotModuleReloadNpc } from "./npc";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * @param {Props} props
 */
export default function Npcs(props) {
  const w = React.useContext(WorldContext);

  // const gltf = useGLTF(glbMeta.url);

  const state = useStateRef(/** @returns {State} */ () => ({
    gltf: /** @type {*} */ ({}),
    group: /** @type {*} */ (null),
    label: {
      numLabels: 0,
      lookup: {},
      tex: new THREE.CanvasTexture(getCanvas(`${w.key} npc.label`)),
    },
    npc: {},

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
        return null;
      } else {
        return p.distanceTo(closest) < maxDelta ? toV3(closest) : null;
      }
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
    remove(...npcKeys) {
      for (const npcKey of npcKeys) {
        const npc = state.getNpc(npcKey); // throw if n'exist pas
        // npc.setGmRoomId(null);
        delete state.npc[npcKey];
        npc.removeAgent();
        w.events.next({ key: 'removed-npc', npcKey });
      }
      update();
    },
    async spawn(e) {
      if (!(typeof e.npcKey === 'string' && /^[a-z0-9-_]+$/i.test(e.npcKey))) {
        throw Error(`npc key: ${JSON.stringify(e.npcKey)} must match /^[a-z0-9-_]+$/i`);
      } else if (!(e.point && typeof e.point.x === 'number' && typeof e.point.y === 'number')) {
        throw Error(`invalid point {x, y}: ${JSON.stringify(e.point)}`);
      } else if (e.requireNav && state.getClosestNavigable(toV3(e.point)) === null) {
        throw Error(`cannot spawn outside navPoly: ${JSON.stringify(e.point)}`);
      } else if (e.skinKey && !w.lib.isSkinKey(e.skinKey)) {
        throw Error(`invalid skinKey: ${JSON.stringify(e.skinKey)}`);
      }
      
      const gmRoomId = w.gmGraph.findRoomContaining(e.point, true);
      if (gmRoomId === null) {
        throw Error(`must be in some room: ${JSON.stringify(e.point)}`);
      }

      let npc = state.npc[e.npcKey];
      const position = toV3(e.point);

      if (npc !== undefined) {// Respawn
        await npc.cancel();
        npc.epochMs = Date.now();

        npc.def = {
          key: e.npcKey,
          angle: e.angle ?? npc.getAngle() ?? 0, // prev angle fallback
          classKey: e.classKey ?? npc.def.classKey ?? 'cuboid-man',
          skinKey: e.skinKey ?? npc.def.skinKey,
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
          classKey: e.classKey ?? defaultClassKey,
          skinKey: e.skinKey ?? defaultSkinKey,
          runSpeed: e.runSpeed ?? helper.defaults.runSpeed,
          walkSpeed: e.walkSpeed ?? helper.defaults.walkSpeed,
        }, w);

        npc.initialize(state.gltf[npc.def.classKey]);
      }

      npc.s.spawns === 0 && await new Promise(resolve => {
        npc.resolve = resolve;
        update();
      });

      npc.setupMixer(); // on respawn?
      npc.startAnimation('Idle');

      if (npc.agent === null) {
        npc.setPosition(position);
        npc.m.group.setRotationFromAxisAngle(yAxis, npc.def.angle);
        // if specified add an agent pinned to current position
        e.agent && npc.attachAgent().requestMoveTarget(npc.position);
      } else {
        if (e.agent === false) {
          npc.removeAgent();
        } else {
          npc.agent.teleport(position);
        }
      }
      
      npc.s.spawns++;
      w.events.next({ key: 'spawned', npcKey: npc.key, gmRoomId });

      // state.npc[e.npcKey].doMeta = e.meta?.do ? e.meta : null;
      return npc;
    },
    updateLabels(...labels) {
      w.menu.measure('npc.updateLabels');
      const fontHeight = gmLabelHeightSgu * spriteSheetDecorExtraScale;
      createLabelSpriteSheet(labels, state.label, { fontHeight });
      w.menu.measure('npc.updateLabels');
    },
  }));

  w.npc = state;
  w.n = state.npc;

  state.gltf["cuboid-man"] = useGLTF(npcClassToMeta["cuboid-man"].url);
  state.gltf["cuboid-pet"] = useGLTF(npcClassToMeta["cuboid-pet"].url);
  
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      info('hot-reloading npcs');
      Object.values(state.npc).forEach(npc =>
        state.npc[npc.key] = hotModuleReloadNpc(npc)
      );
    }
    cmUvService.initialize(state.gltf);
  }, []);

  const update = useUpdate();

  return (
    <group
      name="npcs"
      ref={x => void (state.group = x ?? state.group)}
      onPointerDown={state.onNpcPointerDown}
      onPointerUp={state.onNpcPointerUp}
    >
      {Object.values(state.npc).map(npc =>
        // <NPC key={npc.key} npc={npc} />
        <MemoizedNPC
          key={npc.key}
          npc={npc}
          epochMs={npc.epochMs} // override memo
        />
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
 * @property {Record<NPC.ClassKey, import("three-stdlib").GLTF & import("@react-three/fiber").ObjectMap>} gltf
 *
 * @property {(src: THREE.Vector3Like, dst: THREE.Vector3Like) => null | THREE.Vector3Like[]} findPath
 * @property {(npcKey: string, processApi?: any) => NPC.NPC} getNpc
 * Throws if does not exist
 * 🚧 any -> ProcessApi (?)
 * @property {(p: THREE.Vector3, maxDelta?: number) => null | THREE.Vector3} getClosestNavigable
 * @property {(p: THREE.Vector3Like) => boolean} isPointInNavmesh
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onNpcPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onNpcPointerUp
 * @property {() => void} restore
 * @property {(deltaMs: number) => void} onTick
 * @property {(npcKey: string) => void} remove
 * @property {(e: NPC.SpawnOpts) => Promise<NPC.NPC>} spawn
 * @property {(...labels: string[]) => void} updateLabels
 */

useGLTF.preload(glbMeta.url);

/**
 * @param {NPCProps} props 
 */
function NPC({ npc }) {
  const { bones, mesh, material } = npc.m;

  return (
    // <group
    //   ref={npc.onMount}
    //   scale={glbMeta.scale}
    //   // dispose={null}
    // >
    //   <group position={[0, 3, 0]}>
    //     {bones.map((bone, i) => <primitive key={i} object={bone} />)}
    //     <skinnedMesh
    //       geometry={mesh.geometry}
    //       position={mesh.position}
    //       skeleton={mesh.skeleton}
    //       userData={mesh.userData}
    //     >
    //       <meshPhysicalMaterial transparent map={material.map} />
    //     </skinnedMesh>
    //   </group>
    // </group>
    <group
      ref={npc.onMount}
      // scale={glbMeta.scale}
      scale={npc.scale}
      // dispose={null}
    >
      {bones.map((bone, i) => <primitive key={i} object={bone} />)}
      <skinnedMesh
        geometry={mesh.geometry}
        position={mesh.position}
        skeleton={mesh.skeleton}
        userData={mesh.userData}
      >
        <meshPhysicalMaterial transparent map={material.map} />
      </skinnedMesh>
    </group>
  )
}

/**
 * @typedef NPCProps
 * @property {NPC.NPC} npc
 */

/** @type {React.MemoExoticComponent<(props: NPCProps & { epochMs: number }) => JSX.Element>} */
const MemoizedNPC = React.memo(NPC);

useGLTF.preload(Object.values(npcClassToMeta).map(x => x.url));
