import React from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

import { defaultClassKey, gmLabelHeightSgu, maxNumberOfNpcs, npcClassKeys, npcClassToMeta, spriteSheetDecorExtraScale, wallHeight } from "../service/const";
import { info, range, takeFirst, warn } from "../service/generic";
import { getCanvas } from "../service/dom";
import { createLabelSpriteSheet, emptyTexture, textureLoader, toV3, yAxis } from "../service/three";
import { helper } from "../service/helper";
import { cmUvService } from "../service/uv";
import { CuboidManMaterial } from "../service/glsl";
import { Npc, hotModuleReloadNpc } from "./npc";
import { WorldContext } from "./world-context";
import useStateRef from "../hooks/use-state-ref";
import useUpdate from "../hooks/use-update";

/**
 * @param {Props} props
 */
export default function Npcs(props) {
  const w = React.useContext(WorldContext);

  const update = useUpdate();

  const state = useStateRef(/** @returns {State} */ () => ({
    gltf: /** @type {*} */ ({}),
    group: /** @type {*} */ (null),
    label: {
      numLabels: 0,
      lookup: {},
      tex: new THREE.CanvasTexture(getCanvas(`${w.key} npc.label`)),
    },
    npc: {},
    physicsPositions: [],
    pickUid: {
      free: new Set(range(maxNumberOfNpcs)),
      toKey: new Map(),
    },
    tex: /** @type {*} */ ({}),

    clearLabels() {
      w.menu.measure('npc.clearLabels');
      const fontHeight = gmLabelHeightSgu * spriteSheetDecorExtraScale;
      createLabelSpriteSheet([], state.label, { fontHeight });
      state.tex.labels = state.label.tex;
      // 🔔 warns from npc with non-null label
      Object.values(state.npc).forEach(npc => cmUvService.updateLabelQuad(npc));
      w.menu.measure('npc.clearLabels');
    },
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
    getClosestNavigable(p, maxDelta = 0.5) {
      const { success, point: closest } = w.crowd.navMeshQuery.findClosestPoint(p, {
        halfExtents: new THREE.Vector3(maxDelta / 2, maxDelta / 2, maxDelta / 2),
      });
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
      const { success, point } = w.crowd.navMeshQuery.findClosestPoint(toV3(p), { halfExtents: { x: 0, y: 0.01, z: 0 } });
      return success === true && Math.abs(point.x - p.x) < 0.001 && Math.abs(point.z - p.y) < 0.001;
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
      Object.values(state.npc).forEach(npc => npc.onTick(deltaMs, state.physicsPositions));
      // 🔔 Float32Array caused issues i.e. decode failed
      const positions = new Float64Array(state.physicsPositions);
      w.physics.worker.postMessage({ type: 'send-npc-positions', positions}, [positions.buffer]);
      state.physicsPositions.length = 0;
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
          npc.moveTo({ x: npc.s.target.x, y: npc.s.target.z });
        } else {// so they'll move "out of the way" of other npcs
          agent.requestMoveTarget(npc.getPosition());
        }
      });
    },
    remove(...npcKeys) {
      for (const npcKey of npcKeys) {
        const npc = state.getNpc(npcKey); // throw if n'exist pas
        npc.cancel(); // rejects promises
        npc.removeAgent();
        
        delete state.npc[npcKey];
        state.pickUid.free.add(npc.def.pickUid);
        state.pickUid.toKey.delete(npc.def.pickUid);

        w.events.next({ key: 'removed-npc', npcKey });
      }
      update();
    },
    async spawn(e) {
      if (!(typeof e.npcKey === 'string' && /^[a-z0-9-_]+$/i.test(e.npcKey))) {
        throw Error(`npc key: ${JSON.stringify(e.npcKey)} must match /^[a-z0-9-_]+$/i`);
      } else if (!(typeof e.point?.x === 'number' && typeof e.point.y === 'number')) {
        throw Error(`invalid point {x, y}: ${JSON.stringify(e)}`);
      }

      const dstNav = state.isPointInNavmesh(e.point);
      // 🔔 attach agent by default if dst navigable
      dstNav === true && (e.agent ??= true);

      if (e.requireNav === true && dstNav === false) {
        throw Error(`cannot spawn outside navPoly: ${JSON.stringify(e)}`);
      } else if (e.agent === true && dstNav === false) {
        throw Error(`cannot add agent outside navPoly`);
      } else if (e.classKey !== undefined && !w.lib.isNpcClassKey(e.classKey)) {
        throw Error(`invalid classKey: ${JSON.stringify(e)}`);
      }
      
      const gmRoomId = w.gmGraph.findRoomContaining(e.point, true);
      if (gmRoomId === null) {
        throw Error(`must be in some room: ${JSON.stringify(e)}`);
      }

      let npc = state.npc[e.npcKey];
      const position = toV3(e.point);

      if (npc !== undefined) {// Respawn
        await npc.cancel();
        npc.epochMs = Date.now();

        npc.def = {
          key: e.npcKey,
          pickUid: npc.def.pickUid,
          angle: e.angle ?? npc.getAngle() ?? 0, // prev angle fallback
          classKey: e.classKey ?? npc.def.classKey ?? defaultClassKey,
          runSpeed: e.runSpeed ?? helper.defaults.runSpeed,
          walkSpeed: e.walkSpeed ?? helper.defaults.walkSpeed,
        };

        // Reorder keys
        delete state.npc[e.npcKey];
        state.npc[e.npcKey] = npc;
      } else {
        
        // Spawn
        npc = state.npc[e.npcKey] = new Npc({
          key: e.npcKey,
          pickUid: takeFirst(state.pickUid.free),
          angle: e.angle ?? 0,
          classKey: e.classKey ?? defaultClassKey,
          runSpeed: e.runSpeed ?? helper.defaults.runSpeed,
          walkSpeed: e.walkSpeed ?? helper.defaults.walkSpeed,
        }, w);
        state.pickUid.toKey.set(npc.def.pickUid, e.npcKey);

        npc.initialize(state.gltf[npc.def.classKey]);
      }

      if (npc.s.spawns === 0) {
        await new Promise(resolve => {
          npc.resolve.spawn = resolve;
          update();
        });
        npc.setupMixer();
      }

      // npc.startAnimation('Idle');
      position.y = npc.startAnimation(e.meta ?? 'Idle');
      npc.m.group.rotation.y = npc.getEulerAngle(npc.def.angle);

      if (npc.agent === null) {
        npc.setPosition(position);
        if (e.agent === true) {
          const agent = npc.attachAgent();
          // 🔔 pin to current position
          agent.requestMoveTarget(npc.position);
          // must tell physics.worker because not moving
          state.physicsPositions.push(npc.bodyUid, position.x, position.y, position.z);
        }
      } else {
        if (dstNav === false || e.agent === false) {
          npc.setPosition(position);
          npc.removeAgent();
          // must tell physics.worker because not moving
          state.physicsPositions.push(npc.bodyUid, position.x, position.y, position.z);
        } else {
          npc.agent.teleport(position);
        }
      }
      
      npc.s.spawns++;
      npc.s.doMeta = e.meta?.do === true ? e.meta : null;
      w.events.next({ key: 'spawned', npcKey: npc.key, gmRoomId });

      return npc;
    },
    update,
    updateLabels(...incomingLabels) {
      const { lookup } = state.label;
      const unseenLabels = incomingLabels.filter(label => !(label in lookup));

      if (unseenLabels.length === 0) {
        return false;
      }
      
      w.menu.measure('npc.updateLabels');
      const nextLabels = [...Object.keys(lookup), ...unseenLabels];
      const fontHeight = gmLabelHeightSgu * spriteSheetDecorExtraScale;
      createLabelSpriteSheet(nextLabels, state.label, { fontHeight });
      state.tex.labels = state.label.tex;
      w.menu.measure('npc.updateLabels');

      // update npc labels (avoidable by precomputing labels)
      Object.values(state.npc).forEach(npc => cmUvService.updateLabelQuad(npc));
      return true;
    },
  }));

  w.npc = state;
  w.n = state.npc;

  state.gltf["cuboid-man"] = useGLTF(npcClassToMeta["cuboid-man"].url);
  state.gltf["cuboid-pet"] = useGLTF(npcClassToMeta["cuboid-pet"].url);
  
  React.useEffect(() => {
    cmUvService.initialize(state.gltf);

    if (process.env.NODE_ENV === 'development') {
      info('hot-reloading npcs');
      Object.values(state.npc).forEach(npc =>
        state.npc[npc.key] = hotModuleReloadNpc(npc)
      );
    }
  }, []);

  React.useEffect(() => {// npc textures
    Promise.all(npcClassKeys.map(async classKey => {
      state.tex[classKey] = emptyTexture;
      const { skinBaseName } = npcClassToMeta[classKey];
      const tex = await textureLoader.loadAsync(`/assets/3d/${skinBaseName}?v=${w.hash.sheets}`);
      tex.flipY = false;
      state.tex[classKey] = tex;
    })).then(() => Object.values(state.npc).forEach(npc => npc.forceUpdate()));
  }, [w.hash.sheets]);

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
 * @property {Record<NPC.ClassKey, import("three-stdlib").GLTF & import("@react-three/fiber").ObjectMap>} gltf
 * @property {{ [npcKey: string]: Npc }} npc
 * @property {number[]} physicsPositions
 * Format `[npc.bodyUid, npc.position.x, npc.position.y, npc.position.z, ...]`
 * @property {Record<NPC.TextureKey, THREE.Texture>} tex
 * @property {{ free: Set<number>; toKey: Map<number, string> }} pickUid
 * `uid.free` are the as-yet-unused npc uids.
 * They are removed/added on spawn/remove npc.
 *
 * @property {() => void} clearLabels
 * @property {(src: THREE.Vector3Like, dst: THREE.Vector3Like) => null | THREE.Vector3Like[]} findPath
 * @property {(npcKey: string, processApi?: any) => NPC.NPC} getNpc
 * Throws if does not exist
 * 🚧 any -> ProcessApi (?)
 * @property {(p: THREE.Vector3, maxDelta?: number) => null | THREE.Vector3} getClosestNavigable
 * @property {(p: Geom.VectJson) => boolean} isPointInNavmesh
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onNpcPointerDown
 * @property {(e: import("@react-three/fiber").ThreeEvent<PointerEvent>) => void} onNpcPointerUp
 * @property {() => void} restore
 * @property {(deltaMs: number) => void} onTick
 * @property {(npcKey: string) => void} remove
 * @property {(e: NPC.SpawnOpts) => Promise<NPC.NPC>} spawn
 * @property {() => void} update
 * @property {(...incomingLabels: string[]) => boolean} updateLabels
 * - Ensures incomingLabels i.e. does not replace.
 * - Returns `true` iff the label sprite-sheet had to be updated.
 * - Every npc label may need updating,
     avoidable by precomputing labels 
 */

/**
 * @param {NPCProps} props 
 */
function NPC({ npc }) {
  const { bones, mesh, quad, material } = npc.m;

  return (
    <group
      key={npc.key}
      ref={npc.onMount}
      scale={npc.m.scale}
      renderOrder={1}
      // dispose={null}
    >
      {bones.map((bone, i) => <primitive key={i} object={bone} />)}
      <skinnedMesh
        geometry={mesh.geometry}
        position={mesh.position}
        skeleton={mesh.skeleton}
        userData={mesh.userData}
        onUpdate={(skinnedMesh) => {// 🔔 keep shader up-to-date
          npc.m.mesh = skinnedMesh; 
          npc.m.material = /** @type {THREE.ShaderMaterial} */ (skinnedMesh.material);
        }}
      >
        {/* <meshPhysicalMaterial transparent map={material.map} /> */}
        <cuboidManMaterial
          key={CuboidManMaterial.key}
          diffuse={[1, 1, 1]}
          transparent
          opacity={npc.s.opacity}
          uNpcUid={npc.def.pickUid}
          // objectPick={true}

          labelHeight={wallHeight * (1 / 0.65)}
          selectorColor={npc.s.selectorColor}
          showSelector={npc.s.showSelector}
          // showLabel={false}

          uBaseTexture={npc.baseTexture}
          uLabelTexture={npc.labelTexture}
          uAlt1Texture={emptyTexture}
          
          uFaceTexId={quad.face.texId}
          uIconTexId={quad.icon.texId}
          uLabelTexId={quad.label.texId}

          uFaceUv={quad.face.uvs}
          uIconUv={quad.icon.uvs}
          uLabelUv={quad.label.uvs}
          
          uLabelDim={quad.label.dim}
        />
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
