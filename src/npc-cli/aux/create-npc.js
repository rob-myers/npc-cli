import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { dampLookAt } from "maath/easing";

import { glbMeta } from '../service/const';
import { info, warn } from '../service/generic';
import { buildObjectLookup, emptyAnimationMixer, emptyGroup, textureLoader, tmpVectThree1, tmpVectThree2, tmpVectThree3, yAxis } from '../service/three';
import { npcService } from '../service/npc';
import { tmpVec1 } from '../service/geom';

export class Npc {

  /** @type {string} User specified e.g. `rob` */ key;
  /** @type {import('./TestWorld').State} World API */ api;
  /** @type {NPC.NPCDef} Initial definition */ def;
  /** @type {number} When we (re)spawned */ epochMs;
  
  group = emptyGroup;
  map = /** @type {import('@react-three/fiber').ObjectMap} */ ({});
  animMap = /** @type {Record<NPC.AnimKey, THREE.AnimationAction>} */ ({});
  mixer = emptyAnimationMixer;
  /**
   * Fade out previous animation (seconds)
   * @type {Record<NPC.AnimKey, Record<NPC.AnimKey, number>>}
   */
  fadeOut = {
    Idle: { Idle: 0, Run: 0.2, Walk: 0.2 },
    Run: { Idle: 0.3, Run: 0, Walk: 0.2 },
    Walk: { Idle: 0.2, Run: 0.2, Walk: 0 },
  };
  /**
   * Fade in next animation (seconds).
   * @type {Record<NPC.AnimKey, Record<NPC.AnimKey, number>>}
   */
  fadeIn = {
    Idle: { Idle: 0, Run: 0.1, Walk: 0.1 },
    Run: { Idle: 0.3, Run: 0, Walk: 0.1 },
    Walk: { Idle: 0.2, Run: 0.1, Walk: 0 },
  };

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
    target: /** @type {null | Geom.VectJson} */ (null),
  };

  /** @type {null | import("@recast-navigation/core").CrowdAgent} */
  agent = null;

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
    return this.agent ??= this.api.crowd.addAgent(this.group.position,{
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
    this.changeSkin(npcClassKey); // 🚧 should be sync
  }
  /** @param {NPC.NpcClassKey} skinKey  */
  async changeSkin(skinKey) {
    const skinnedMesh = /** @type {THREE.SkinnedMesh} */ (this.map.nodes[glbMeta.skinnedMeshName]);
    const clonedMaterial = /** @type {THREE.MeshPhysicalMaterial} */ (skinnedMesh.material).clone();
    await textureLoader.loadAsync(`/assets/3d/minecraft-skins/${skinKey}`).then((tex) => {
      // console.log(material.map, tex);
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
    const { x, z } = this.group.position;
    return { x, y: z };
  }
  getRadius() {
    return npcService.defaults.radius;
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
    this.changeSkin('scientist-dabeyt--with-arms.png');
    
    this.group.position.set(this.def.position.x, 0, this.def.position.y);
    this.group.setRotationFromAxisAngle(yAxis, this.def.angle);
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
      const velocity = tmpVectThree2.copy(this.agent.velocity());
      
      this.group.position.copy(position);

      // 🚧 WIP
      if (
        this.s.target !== null &&
        Math.abs(this.s.target.x - position.x) < 0.1
        && Math.abs(this.s.target.y - position.z) < 0.1
      ) {
        console.log('should stop');
        this.s.target = null;
        this.mixer.timeScale = 1;
        this.startAnimation('Idle');
      }

      const speed = velocity.length();
      if (speed > 0.1) {
        dampLookAt(this.group, position.add(velocity), 0.25, deltaMs);
      }

      this.mixer.timeScale = Math.max(0.3, speed / this.def.walkSpeed);
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
    // anim.fadeOut(0.2);
    // next.reset().fadeIn(0.2).play();
    anim.fadeOut(this.fadeOut[this.s.act][act]);
    next.reset().fadeIn(this.fadeIn[this.s.act][act]).play();
    this.s.act = act;
    // if (act === 'Walk' || act === 'Run') {
    //   this.s.startMove = Date.now();
    // }
  }
  /** @param {Geom.VectJson} dst  */
  walkTo(dst, debugPath = false) {
    if (this.agent === null) {
      return warn(`npc ${this.key} cannot walkTo ${JSON.stringify(dst)} (no agent)`);
    }
    const api = this.api;

    if (debugPath) {
      const path = api.npc.findPath(this.getPosition(), dst);
      api.debug.setNavPath(path ?? []);
    }

    const closest = api.npc.getClosestNavigable(dst, 0.15);
    if (closest === null) {
      return;
    }
    // const position = this.getPosition();
    // if (tmpVec1.copy(position).distanceTo(closest) < 0.25) {
    //   return;
    // }

    // this.agent.raw.set_vel(0, 1);
    // this.agent.raw.set_vel(2, 1);
    this.agent.goto(tmpVectThree1.set(closest.x, 0, closest.y));
    this.s.target = closest;
    const nextAct = this.s.run ? 'Run' : 'Walk';
    if (this.s.act !== nextAct) {
      this.startAnimation(nextAct);
    }
  }
 
  toJSON() {
    return {
      key: this.key,
      // api: this.api,
      def: this.def,
      epochMs: this.epochMs,
      // group: this.group,
      // map: this.map,
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
  agent && agent.updateParameters({
    ...crowdAgentParams,
    maxSpeed: agent.maxSpeed,
  });
  const nextNpc = new Npc(def, npc.api);
  return Object.assign(nextNpc, { epochMs, group, s: Object.assign(nextNpc.s, s), map, animMap, mixer, agent });
}

/** @param {any} error */
function emptyReject(error) {}

/** @type {Partial<import("@recast-navigation/core").CrowdAgentParams>} */
export const crowdAgentParams = {
  radius: npcService.defaults.radius / 4, // 🔔 too large causes jerky collisions
  height: 1.5,
  maxAcceleration: 4,
  // maxSpeed: 0, // Set elsewhere
  pathOptimizationRange: npcService.defaults.radius * 20, // 🚧 clarify
  // collisionQueryRange: 2.5,
  collisionQueryRange: 0.7,
  separationWeight: 1,
  queryFilterType: 0,
  // userData, // 🚧 not working?
  // obstacleAvoidanceType
};
