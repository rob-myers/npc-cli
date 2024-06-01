import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

import { glbMeta } from '../service/const';
import { info, warn } from '../service/generic';
import { buildObjectLookup, tmpVectThree1, yAxis } from '../service/three';
import CharacterController from './character-controller';

export class Npc {

  /** @type {string} User specified e.g. `rob` */ key;
  /** @type {import('./TestWorld').State} World API */ api;
  /** @type {NPC.NPCDef} Initial definition */ def;
  /** @type {number} When we (re)spawned */ epochMs;
  
  group = emptyGroup;
  map = /** @type {import('@react-three/fiber').ObjectMap} */ ({});
  ctrl = /** @type {CharacterController} */ ({});

  flag = {
    cancels: 0,
    /** Is this NPC walking or running? */
    move: false,
    paused: false,
    spawns: 0,
  };

  /** @type {null | import("@recast-navigation/core").CrowdAgent} */
  agent = null;
  rejectWalk = emptyReject;

  /**
   * @param {NPC.NPCDef} def
   * @param {import('./TestWorld').State} api
   */
  constructor(def, api) {
    this.key = def.key;
    this.epochMs = Date.now();
    this.def = def;
    this.api = api;
  }
  /** @param {Record<string, any>} userData */
  attachAgent(userData = {}) {
    this.agent ??= this.api.crowd.addAgent(this.group.position, {
      radius: glbMeta.radius,
      height: 1.5,
      maxAcceleration: 4,
      maxSpeed: 2,
      pathOptimizationRange: glbMeta.radius * 20, // 🚧 ?
      // collisionQueryRange: 2.5,
      collisionQueryRange: 0.7,
      separationWeight: 1,
      queryFilterType: 0,
      userData,
      // obstacleAvoidanceType
    });
  }
  async cancel() {
    info(`${'cancel'}: cancelling ${this.key}`);

    const api = this.api;
    const cancelCount = ++this.flag.cancels;
    this.flag.paused = false;
    
    this.rejectWalk(new Error(`${'cancel'}: cancelled walk`));
    
    if (this.flag.move === true) {
      await api.lib.firstValueFrom(api.events.pipe(
        api.lib.filter(e => e.key === "stopped-walking" && e.npcKey === this.key)
      ));
    }
    if (cancelCount !== this.flag.cancels) {
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
  getPosition() {
    return this.group.position.clone();
  }
  /** @param {Geom.VectJson} dst  */
  goto(dst) {
    if (this.agent !== null) {
      this.agent.goto(tmpVectThree1.set(dst.x, 0, dst.y));
    } else {// jump directly
      this.group.position.set(dst.x, 0, dst.y);
    }
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
  removeAgent() {
    if (this.agent !== null) {
      this.api.crowd.removeAgent(this.agent.agentIndex);
      this.agent = null;
    }
  }
  /** @param {NPC.AnimKey} animKey */
  startAnimation(animKey) {
    // 🚧
  }
  /** @param {Geom.VectJson} dst  */
  walkTo(dst) {
    if (this.agent === null) {
      return warn(`npc ${this.key} cannot walkTo ${JSON.stringify(dst)} (no agent)`);
    }

    const api = this.api;
    const src = this.getPosition();
    const dst3 = tmpVectThree1.set(dst.x, 0, dst.y);
    const query = api.crowd.navMeshQuery;
    // Agent may follow different path
    const path = query.computePath(src, dst3, {
      filter: api.crowd.getFilter(0),
    });

    if (path.length > 0 && dst3.distanceTo(path[path.length - 1]) < 0.05) {
      api.debug.setNavPath(path);
      this.agent.goto(dst3); // nearest point/polygon relative to crowd defaults
    }
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
      flag: this.flag,
    };
  }
}

/**
 * Mutates provided @see npc
 * @param {NPC.NPC} npc 
 * @returns {NPC.NPC}
 */
export function hotModuleReloadNpc(npc) {
  const { def, epochMs, ctrl, group, flag, rejectWalk, map } = npc;
  // return Object.assign(npc, new Npc(def, npc.api), { epochMs, ctrl, group, flag, rejectWalk, map });
  return Object.assign(new Npc(def, npc.api), { epochMs, ctrl, group, flag, rejectWalk, map });
}

const emptyGroup = new THREE.Group();

/** @param {any} error */
function emptyReject(error) {}