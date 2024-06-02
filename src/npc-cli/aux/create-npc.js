import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { dampLookAt } from "maath/easing";

import { glbMeta } from '../service/const';
import { info, warn } from '../service/generic';
import { buildObjectLookup, emptyAnimationMixer, emptyGroup, tmpVectThree1, tmpVectThree2, yAxis } from '../service/three';
import { npcService } from '../service/npc';

export class Npc {

  /** @type {string} User specified e.g. `rob` */ key;
  /** @type {import('./TestWorld').State} World API */ api;
  /** @type {NPC.NPCDef} Initial definition */ def;
  /** @type {number} When we (re)spawned */ epochMs;
  
  group = emptyGroup;
  map = /** @type {import('@react-three/fiber').ObjectMap} */ ({});
  animMap = /** @type {Record<NPC.AnimKey, THREE.AnimationAction>} */ ({});
  mixer = emptyAnimationMixer;

  /** State */
  s = {
    cancels: 0,
    /** @type {NPC.AnimKey} */
    act: 'Idle',
    /** Fade duration between animations */
    fadeSecs: 0.2,
    /** Is this NPC walking or running? */
    move: false,
    paused: false,
    run: false,
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
  attachAgent() {
    return this.agent ??= this.api.crowd.addAgent(this.group.position, {
      radius: npcService.defaults.radius,
      height: 1.5,
      maxAcceleration: 4,
      maxSpeed: 2,
      pathOptimizationRange: npcService.defaults.radius * 20, // 🚧 ?
      // collisionQueryRange: 2.5,
      collisionQueryRange: 0.7,
      separationWeight: 1,
      queryFilterType: 0,
      // userData, // 🚧 not working?
      // obstacleAvoidanceType
    });
  }
  async cancel() {
    info(`${'cancel'}: cancelling ${this.key}`);

    const api = this.api;
    const cancelCount = ++this.s.cancels;
    this.s.paused = false;
    
    this.rejectWalk(new Error(`${'cancel'}: cancelled walk`));
    
    if (this.s.move === true) {
      await api.lib.firstValueFrom(api.events.pipe(
        api.lib.filter(e => e.key === "stopped-walking" && e.npcKey === this.key)
      ));
    }
    if (cancelCount !== this.s.cancels) {
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
  getRadius() {
    return npcService.defaults.radius;
  }
  /** @param {Geom.VectJson} dst  */
  goto(dst) {
    if (this.agent === null) {
      return warn(`npc ${this.key} cannot goto ${JSON.stringify(dst)} (no agent)`);
    }
    this.agent.goto(tmpVectThree1.set(dst.x, 0, dst.y));
  }
  /**
   * @param {import('three-stdlib').GLTF & import('@react-three/fiber').ObjectMap} gltf
   */
  initialize(gltf) {
    const scale = glbMeta.scale;
    this.group = /** @type {THREE.Group} */ (SkeletonUtils.clone(gltf.scene));
    this.group.scale.set(scale, scale, scale);

    this.mixer = new THREE.AnimationMixer(this.group);

    this.animMap = gltf.animations.reduce((agg, a) => {
      if (a.name === 'Idle' || a.name === 'Walk' || a.name === 'Run') {
        agg[a.name] = this.mixer.clipAction(a);
      } else {
        warn(`ignored unexpected animation: ${a.name}`);
      }
      return agg;
    }, /** @type {typeof this['animMap']} */ ({}));

    this.map = buildObjectLookup(this.group);
    // Mutate userData to decode pointer events
    const skinnedMesh = this.map.nodes[glbMeta.skinnedMeshName];
    skinnedMesh.userData.npcKey = this.key;
    
    this.group.position.set(this.def.position.x, 0, this.def.position.y);
    this.group.setRotationFromAxisAngle(yAxis, this.def.angle);
    // this.setGmRoomId(api.gmGraph.findRoomContaining(this.def.position, true));
  }
  /** @param {number} deltaMs  */
  onTick(deltaMs) {
    this.mixer.update(deltaMs);

    if (this.agent === null) {
      // 🚧 can turn
    } else {// Move and turn
      const position = tmpVectThree1.copy(this.agent.position());
      const velocity = tmpVectThree2.copy(this.agent.velocity());
      
      this.group.position.copy(position);
      if (velocity.length() > 0.2) {
        dampLookAt(this.group, position.add(velocity), 0.25, deltaMs);
      }
    }
  }
  removeAgent() {
    if (this.agent !== null) {
      this.api.crowd.removeAgent(this.agent.agentIndex);
      this.agent = null;
    }
  }
  /** @param {Geom.VectJson} dst  */
  setPosition(dst) {
    this.group.position.set(dst.x, 0, dst.y);
  }
  /** @param {NPC.AnimKey} act */
  startAnimation(act) {
    const anim = this.animMap[this.s.act];
    const next = this.animMap[act];
    anim.fadeOut(this.s.fadeSecs);
    next.reset().fadeIn(this.s.fadeSecs).play();
    this.s.act = act;
  }
  /** @param {Geom.VectJson} dst  */
  walkTo(dst) {
    if (this.agent === null) {
      return warn(`npc ${this.key} cannot walkTo ${JSON.stringify(dst)} (no agent)`);
    }

    // 🚧 move path creation into own function
    const api = this.api;
    const src = this.getPosition();
    const dst3 = tmpVectThree1.set(dst.x, 0, dst.y);
    const query = api.crowd.navMeshQuery;
    // Agent may follow different path
    const path = query.computePath(src, dst3, {
      filter: api.crowd.getFilter(0),
    });

    if (
      path.length > 0
      && dst3.distanceTo(path[path.length - 1]) < 0.05
    ) {
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
      s: this.s,
    };
  }
}

/**
 * Mutates provided @see npc
 * @param {NPC.NPC} npc 
 * @returns {NPC.NPC}
 */
export function hotModuleReloadNpc(npc) {
  const { def, epochMs, group, s, rejectWalk, map } = npc;
  // return Object.assign(npc, new Npc(def, npc.api), { epochMs, group, s, rejectWalk, map });
  return Object.assign(new Npc(def, npc.api), { epochMs, group, s, rejectWalk, map });
}

/** @param {any} error */
function emptyReject(error) {}
