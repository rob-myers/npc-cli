import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { dampLookAt } from "maath/easing";

import { glbFadeIn, glbFadeOut, glbMeta, showLastNavPath } from '../service/const';
import { info, warn } from '../service/generic';
import { buildObjectLookup, emptyAnimationMixer, emptyGroup, textureLoader, tmpVectThree1, tmpVectThree2, tmpVectThree3 } from '../service/three';
import { npcService } from '../service/npc';

export class Npc {

  /** @type {string} User specified e.g. `rob` */ key;
  /** @type {import('./World').State} World API */ api;
  /** @type {NPC.NPCDef} Initial definition */ def;
  /** @type {number} When we (re)spawned */ epochMs;
  
  group = emptyGroup;
  map = /** @type {import('@react-three/fiber').ObjectMap} */ ({});
  animMap = /** @type {Record<NPC.AnimKey, THREE.AnimationAction>} */ ({});
  mixer = emptyAnimationMixer;

  /** State */
  s = {
    cancels: 0,
    act: /** @type {NPC.AnimKey} */ ('Idle'),
    /** Is this NPC walking or running? */
    move: false,
    paused: false,
    rejectWalk: emptyReject,
    run: false,
    spawns: 0,
    target: /** @type {null | THREE.Vector3Like} */ (null),
  };

  /** @type {null | NPC.CrowdAgent} */
  agent = null;

  /**
   * @param {NPC.NPCDef} def
   * @param {import('./World').State} api
   */
  constructor(def, api) {
    this.key = def.key;
    this.epochMs = Date.now();
    this.def = def;
    this.api = api;
  }
  attachAgent() {
    return this.agent ??= this.api.crowd.addAgent(this.group.position, {
      ...crowdAgentParams,
      maxSpeed: this.s.run ? npcService.defaults.runSpeed : npcService.defaults.walkSpeed
    });
  }
  async cancel() {
    info(`${'cancel'}: cancelling ${this.key}`);

    const api = this.api;
    const cancelCount = ++this.s.cancels;
    this.s.paused = false;
    
    this.s.rejectWalk(new Error(`${'cancel'}: cancelled walk`));
    
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
    this.def.classKey = npcClassKey;
    this.changeSkin(npcClassKey);
  }
  /**
   * 🚧 remove async once skin sprite-sheet available
   * @param {NPC.NpcClassKey} skinKey
   */
  async changeSkin(skinKey) {
    const skinnedMesh = /** @type {THREE.SkinnedMesh} */ (this.map.nodes[glbMeta.skinnedMeshName]);
    const clonedMaterial = /** @type {THREE.MeshPhysicalMaterial} */ (skinnedMesh.material).clone();
    // clonedMaterial.color = new THREE.Color('#aaa'); // darken (multiply)
    // clonedMaterial.emissive = new THREE.Color('#222'); // lighten (add)
    // clonedMaterial.emissiveIntensity = 3;
    await textureLoader.loadAsync(`/assets/3d/minecraft-skins/${skinKey}`).then((tex) => {
      tex.flipY = false;
      tex.wrapS = tex.wrapT = 1000;
      tex.colorSpace = "srgb";
      tex.minFilter = 1004;
      tex.magFilter = 1003;
      clonedMaterial.map = tex;
      skinnedMesh.material = clonedMaterial;
    });
  }
  getAngle() {// Assume only rotated about y axis
    return this.group.rotation.y;
  }
  getPosition() {
    return this.group.position;
  }
  getRadius() {
    return npcService.defaults.radius;
  }
  getMaxSpeed() {
    return this.s.run === true ? this.def.runSpeed : this.def.walkSpeed;
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
      if (npcService.isAnimKey(a.name)) {
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

    // this.changeSkin('scientist-dabeyt--with-arms.png');
    this.changeSkin(this.def.classKey);
    // this.setGmRoomId(api.gmGraph.findRoomContaining(this.def.position, true));
  }
  /** @param {number} deltaMs  */
  onTick(deltaMs) {
    this.mixer.update(deltaMs);

    if (this.agent === null) {
      // Support move/turn without agent
    } else {
      // Moving or stationary with agent
      const position = tmpVectThree1.copy(this.agent.position());
      // const position = tmpVectThree1.copy(this.agent.interpolatedPosition);
      const velocity = tmpVectThree2.copy(this.agent.velocity());
      const forward = tmpVectThree3.copy(position).add(velocity);
      const speed = velocity.length();

      this.group.position.copy(position);
      speed > 0.2 && dampLookAt(this.group, forward, 0.25, deltaMs);

      if (this.s.target === null) {
        return;
      }

      this.mixer.timeScale = Math.max(0.5, speed / this.getMaxSpeed());
      const distance = position.distanceTo(this.s.target);

      if (distance < 0.15) {// Reached target
        this.s.target = null;
        this.agent.updateParameters({ maxSpeed: this.getMaxSpeed() });
        const time = this.mixer.time % 1;

        this.startAnimation('Idle');
        // this.startAnimation(// 🚧 WIP
        //   time >= 7/8 ? 'Idle' : time >= 5/8 ? 'IdleRightLead' : time >= 3/8 ? 'Idle' : 'IdleLeftLead'
        // );

        // keep target, so "moves out of the way"
        this.agent.teleport(position); // suppress final movement
        this.agent.requestMoveTarget(position);
      }

      // undo speed scale
      // https://github.com/recastnavigation/recastnavigation/blob/455a019e7aef99354ac3020f04c1fe3541aa4d19/DetourCrowd/Source/DetourCrowd.cpp#L1205
      if (distance < 2 * agentRadius) {
        this.agent.updateParameters({ maxSpeed: this.getMaxSpeed() * ((2 * agentRadius) / distance) });
      }
    }
  }
  removeAgent() {
    if (this.agent !== null) {
      this.api.crowd.removeAgent(this.agent.agentIndex);
      this.agent = null;
    }
  }
  /** @param {THREE.Vector3Like} dst  */
  setPosition(dst) {
    this.group.position.copy(dst);
  }
  /** @param {NPC.AnimKey} act */
  startAnimation(act) {
    const anim = this.animMap[this.s.act];
    const next = this.animMap[act];
    anim.fadeOut(glbFadeOut[this.s.act][act]);
    next.reset().fadeIn(glbFadeIn[this.s.act][act]).play();
    this.s.act = act;
  }
  /** @param {THREE.Vector3Like} dst  */
  walkTo(dst, debugPath = showLastNavPath) {
    if (this.agent === null) {
      return warn(`npc ${this.key} cannot walkTo ${JSON.stringify(dst)} (no agent)`);
    }
    const api = this.api;
    const closest = api.npc.getClosestNavigable(dst, 0.15);

    if (closest === null) {
      return;
    }
    if (debugPath) {
      const path = api.npc.findPath(this.getPosition(), closest);
      api.debug.setNavPath(path ?? []);
    }
    const position = this.getPosition();
    if (position.distanceTo(closest) < 0.25) {
      return;
    }

    this.mixer.timeScale = 1;
    this.agent.updateParameters({ maxSpeed: this.getMaxSpeed() });

    this.agent.requestMoveTarget(closest);
    this.s.target = {...closest}; // crucial
    const nextAct = this.s.run ? 'Run' : 'Walk';
    if (this.s.act !== nextAct) {
      this.startAnimation(nextAct);
    }
  }
 
  toJSON() {
    return {
      key: this.key,
      def: this.def,
      epochMs: this.epochMs,
      s: this.s,
    };
  }
}

/**
 * Creates a new NPC loaded with previous one's data.
 * @param {NPC.NPC} npc 
 * @returns {NPC.NPC}
 */
export function hotModuleReloadNpc(npc) {
  const { def, epochMs, group, s, map, animMap, mixer, agent } = npc;
  agent?.updateParameters({ maxSpeed: agent.maxSpeed });
  // npc.changeSkin('robot-vaccino.png'); // 🔔 Skin debug
  const nextNpc = new Npc(def, npc.api);
  return Object.assign(nextNpc, { epochMs, group, s: Object.assign(nextNpc.s, s), map, animMap, mixer, agent });
}

/** @param {any} error */
function emptyReject(error) {}

const agentRadius = npcService.defaults.radius / 3;

/** @type {Partial<import("@recast-navigation/core").CrowdAgentParams>} */
export const crowdAgentParams = {
  radius: agentRadius, // 🔔 too large causes jerky collisions
  height: 1.5,
  maxAcceleration: 10, // Large enough for 'Run'
  // maxSpeed: 0, // Set elsewhere
  pathOptimizationRange: npcService.defaults.radius * 20, // 🚧 clarify
  // collisionQueryRange: 2.5,
  collisionQueryRange: 0.7,
  separationWeight: 1,
  queryFilterType: 0,
  // userData, // 🚧 not working?
  // obstacleAvoidanceType
};