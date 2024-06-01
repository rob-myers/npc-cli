import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

import { glbMeta } from '../service/const';
import { info } from '../service/generic';
import { buildObjectLookup, yAxis } from '../service/three';
import CharacterController from './character-controller';

export class Npc {

  /** @type {string} User specified e.g. `rob` */ key;
  /** @type {NPC.NpcClassKey} */ classKey;
  /** @type {import('./TestWorld').State} World API */ api;
  /** @type {NPC.NPCDef} Initial definition */ def;
  /** @type {number} When we (re)spawned */ epochMs;
  
  group = emptyGroup;
  map = /** @type {import('@react-three/fiber').ObjectMap} */ ({});
  ctrl = /** @type {CharacterController} */ ({});

  cancelCount = 0;
  /** Is this NPC walking or running? */
  moving = false;
  rejectWalk = emptyReject;

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
  }

  async cancel() {
    info(`${'cancel'}: cancelling ${this.key}`);

    const cancelCount = ++this.cancelCount;
    this.paused = false;
    // this.s.body.tint = 0xffffff;
    // this.s.head.tint = 0xffffff;
    const api = this.api;
    
    this.rejectWalk(new Error(`${'cancel'}: cancelled walk`));

    if (this.moving) {
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
    return this.group.rotation.y;
  }
  /**
   * @param {import('three-stdlib').GLTF & import('@react-three/fiber').ObjectMap} gltf
   */
  initialize(gltf) {
    this.group = /** @type {THREE.Group} */ (SkeletonUtils.clone(gltf.scene));

    const scale = glbMeta.scale;
    this.group.scale.set(scale, scale, scale);

    const mixer = new THREE.AnimationMixer(this.group);
    const animLookup = /** @type {Record<import("./character-controller").AnimKey, THREE.AnimationAction>} */ ({});
    gltf.animations.forEach(a => {
      // info('saw animation:', a.name);
      if (a.name === 'Idle' || a.name === 'Walk' || a.name === 'Run') {
        animLookup[a.name] = mixer.clipAction(a);
      }
    });

    this.ctrl = new CharacterController({
      model: /** @type {THREE.Group} */ (this.group),
      mixer,
      animationMap: animLookup,
      opts: { initAnimKey: 'Idle', walkSpeed: this.def.walkSpeed, runSpeed: this.def.runSpeed, },
    });

    this.map = buildObjectLookup(this.group);
    
    this.group.position.set(this.def.position.x, 0, this.def.position.y);
    this.group.setRotationFromAxisAngle(yAxis, this.def.angle);
    // this.setGmRoomId(api.gmGraph.findRoomContaining(this.def.position, true));
  }
  /** @param {NPC.AnimKey} animKey */
  startAnimation(animKey) {
    // 🚧
  }
 
  toJSON() {
    return {
      key: this.key,
      classKey: this.classKey,
      // api: this.api,
      def: this.def,
      epochMs: this.epochMs,
      // group: this.group,
      // map: this.map,
      // ctrl: this.ctrl,
      cancelCount: this.cancelCount,
      isMoving: this.moving,
    };
  }

}

/**
 * Mutates provided @see npc
 * @param {NPC.NPC} npc 
 * @returns {NPC.NPC}
 */
export function hotModuleReloadNpc(npc) {
  const { def, epochMs, ctrl, moving, group: model, paused, rejectWalk, map } = npc;
  // return Object.assign(npc, new Npc(def, npc.api), { epochMs, controller, moving, model, paused, rejectWalk, map });
  return Object.assign(new Npc(def, npc.api), { epochMs, ctrl, moving, model, paused, rejectWalk, map });
}

const emptyGroup = new THREE.Group();

/** @param {any} error */
function emptyReject(error) {}
