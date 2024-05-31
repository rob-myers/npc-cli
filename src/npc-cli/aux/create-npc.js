import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { info } from '../service/generic';
import { buildObjectLookup, yAxis } from '../service/three';
import CharacterController from './character-controller';

export class Npc {

  /** @type {string} User specified e.g. `rob` */ key;
  /** @type {NPC.NpcClassKey} */ classKey;
  /** @type {import('./TestWorld').State} World API */ api;
  /** @type {NPC.NPCDef} Initial definition */ def;
  /** @type {number} When we (re)spawned */ epochMs;
  
  root = emptyGroup;
  model = /** @type {THREE.Object3D} */ (emptyGroup);
  subModel = /** @type {import('@react-three/fiber').ObjectMap} */ ({});
  controller = /** @type {CharacterController} */ ({});

  cancelCount = 0;
  /** Is walking or running? */
  isMoving = false;
  rejectWalk = emptyReject;
  /**
   * Initially `false` until set `true` on mount.
   * May also set false for cached un-rendered.
   */
  spawned = false;

  /**
   * @param {NPC.NPCDef} def
   * @param {import('./TestWorld').State} api
   */
  constructor(def, api) {
    this.key = def.key;
    this.classKey = def.classKey;
    this.epochMs = Date.now();
    this.def = def;
    this.api = api;
    this.spawned = false;
  }

  async cancel() {
    info(`${'cancel'}: cancelling ${this.key}`);

    const cancelCount = ++this.cancelCount;
    this.paused = false;
    // this.s.body.tint = 0xffffff;
    // this.s.head.tint = 0xffffff;
    const api = this.api;
    
    this.rejectWalk(new Error(`${'cancel'}: cancelled walk`));

    if (this.isMoving) {
      await api.lib.firstValueFrom(api.events.pipe(
        api.lib.filter(e => e.key === "stopped-walking" && e.npcKey === this.key)
      ));
    }
    if (cancelCount !== this.cancelCount) {
      throw Error(`${'cancel'}: cancel was cancelled`);
    }
    api.events.next({ key: 'npc-internal', npcKey: this.key, event: 'cancelled' });
  }
  /** @param {NPC.NpcClassKey} npcClassKey */
  changeClass(npcClassKey) {
    this.classKey = npcClassKey;
  }
  getAngle() {// Assume only rotated about y axis
    return this.root.rotation.y;
  }
  /**
   * @param {import('three-stdlib').GLTF & import('@react-three/fiber').ObjectMap} gltf
   */
  initialize(gltf) {
    this.model = SkeletonUtils.clone(gltf.scene);

    const mixer = new THREE.AnimationMixer(this.model);
    const animLookup = /** @type {Record<import("./character-controller").AnimKey, THREE.AnimationAction>} */ ({});
    gltf.animations.forEach(a => {
      // info('saw animation:', a.name);
      if (a.name === 'Idle' || a.name === 'Walk' || a.name === 'Run') {
        animLookup[a.name] = mixer.clipAction(a);
      }
    });

    this.controller = new CharacterController({
      model: /** @type {THREE.Group} */ (this.model),
      mixer,
      animationMap: animLookup,
      opts: { initAnimKey: 'Idle', walkSpeed: this.def.walkSpeed, runSpeed: this.def.runSpeed, },
    });

    this.subModel = buildObjectLookup(this.model);
    
    this.root.position.set(this.def.position.x, 0, this.def.position.y);
    this.root.setRotationFromAxisAngle(yAxis, this.def.angle);
    // this.setGmRoomId(api.gmGraph.findRoomContaining(this.def.position, true));
  }
  /** @param {NPC.AnimKey} animKey */
  startAnimation(animKey) {
    // 🚧
  }
  
}

/**
 * Mutates provided @see npc
 * @param {NPC.NPC} npc 
 * @returns {NPC.NPC}
 */
export function hotModuleReloadNpc(npc) {
  const { def, epochMs, controller, isMoving, model, paused, rejectWalk, root, spawned, subModel } = npc;
  // return Object.assign(npc, new Npc(def, npc.api), { epochMs, controller, isMoving, model, paused, rejectWalk, root, spawned, subModel });
  return Object.assign(new Npc(def, npc.api), { epochMs, controller, isMoving, model, paused, rejectWalk, root, spawned, subModel });
}

const emptyGroup = new THREE.Group();

/** @param {any} error */
function emptyReject(error) {}
