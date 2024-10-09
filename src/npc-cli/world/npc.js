import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { dampLookAt } from "maath/easing";

import { defaultAgentUpdateFlags, glbFadeIn, glbFadeOut, npcClassToMeta, showLastNavPath } from '../service/const';
import { info, warn } from '../service/generic';
import { buildObjectLookup, emptyAnimationMixer, emptyGroup, getParentBones, textureLoader, tmpVectThree1, toV3 } from '../service/three';
import { helper } from '../service/helper';
import { addBodyKeyUidRelation, npcToBodyKey } from '../service/rapier';
import { cmUvService } from "../service/uv";

export class Npc {

  /** @type {string} User specified e.g. `rob` */ key;
  /** @type {import('./World').State} World API */ w;
  /** @type {NPC.NPCDef} Initial definition */ def;
  /** @type {number} When we (re)spawned */ epochMs;
  /** @type {number} Physics body identifier i.e. `hashText(key)` */ bodyUid;
  
  /** Model */
  m = {
    /** Clone of GLTF scene */
    gltf: emptyGroup,
    /** Root group */
    group: emptyGroup,
    
    /** Sub `nodes` and `materials` */
    sub: /** @type {import('@react-three/fiber').ObjectMap} */ ({}),
    mesh: /** @type {THREE.SkinnedMesh} */ ({}),
    /** Root bones */
    bones: /** @type {THREE.Bone[]} */ ([]),
    animations: /** @type {THREE.AnimationClip[]} */ ([]),
    animMap: /** @type {Record<NPC.AnimKey, THREE.AnimationAction>} */ ({}),
    material: /** @type {THREE.MeshPhysicalMaterial} */ ({}),
  }
  
  mixer = emptyAnimationMixer;
  /** Shortcut to `this.m.group.position` */
  position = tmpVectThree1;

  /** State */
  s = {
    cancels: 0,
    act: /** @type {NPC.AnimKey} */ ('Idle'),
    lookAt: /** @type {null | THREE.Vector3} */ (null),
    /** Is this npc moving? */
    moving: false,
    paused: false,
    rejectMove: emptyReject,
    run: false,
    spawns: 0,
    target: /** @type {null | THREE.Vector3} */ (null),
    quad: /** @type {import('../service/uv').CuboidManQuads} */ ({}),
  };

  /** @type {null | NPC.CrowdAgent} */
  agent = null;
  agentRadius = helper.defaults.radius;
  scale = 1;

  lastLookAt = new THREE.Vector3();
  lastTarget = new THREE.Vector3();
  lastCorner = new THREE.Vector3();
  /** @type {undefined | ((value?: any) => void)} */
  resolve;

  /**
   * @param {NPC.NPCDef} def
   * @param {import('./World').State} w
   */
  constructor(def, w) {
    this.key = def.key;
    this.epochMs = Date.now();
    this.def = def;
    this.w = w;
    this.bodyUid = addBodyKeyUidRelation(npcToBodyKey(def.key), w.physics)
  }
  attachAgent() {
    return this.agent ??= this.w.crowd.addAgent(this.position, {
      ...crowdAgentParams,
      maxSpeed: this.s.run ? helper.defaults.runSpeed : helper.defaults.walkSpeed
    });
  }
  async cancel() {
    info(`${'cancel'}: cancelling ${this.key}`);

    const cancelCount = ++this.s.cancels;
    this.s.paused = false;

    await Promise.all([
      this.waitUntilStopped(),
      this.s.rejectMove(`${'cancel'}: cancelled move`),
    ]);

    if (cancelCount !== this.s.cancels) {
      throw Error(`${'cancel'}: cancel was cancelled`);
    }

    this.w.events.next({ key: 'npc-internal', npcKey: this.key, event: 'cancelled' });
  }
  getAngle() {// Assume only rotated about y axis
    return this.m.group.rotation.y;
  }
  /** @returns {Geom.VectJson} */
  getPoint() {
    const { x, z: y } = this.position;
    return { x, y };
  }
  getPosition() {
    return this.position;
  }
  getRadius() {
    return helper.defaults.radius;
  }
  getMaxSpeed() {
    return this.s.run === true ? this.def.runSpeed : this.def.walkSpeed;
  }
  /**
   * Initialization we can do before mounting
   * @param {import('three-stdlib').GLTF & import('@react-three/fiber').ObjectMap} gltf
   */
  initialize({ scene, animations }) {
    const { m } = this;
    const meta = npcClassToMeta[this.def.classKey];

    m.gltf = /** @type {THREE.Group} */ (SkeletonUtils.clone(scene));
    m.animations = animations;

    m.sub = buildObjectLookup(m.gltf);
    
    m.bones = getParentBones(Object.values(m.sub.nodes));
    m.mesh = /** @type {THREE.SkinnedMesh} */ (m.sub.nodes[meta.meshName]);
    m.material = /** @type {Npc['m']['material']} */ (m.mesh.material);
    m.mesh.userData.npcKey = this.key; // To decode pointer events

    m.mesh.updateMatrixWorld();
    m.mesh.computeBoundingBox();
    m.mesh.computeBoundingSphere();

    const npcClassKey = this.def.classKey;

    // 🚧
    const quadMeta = cmUvService.toQuadMetas[npcClassKey];
    this.scale = npcClassToMeta[npcClassKey].scale;
    this.s.quad = cmUvService.getDefaultUvQuads(this.def.classKey);

    // ℹ️ cannot setup mixer until <group> mounts
  }
  /**
   * @param {THREE.Vector3Like} dst
   * @param {object} [opts]
   * @param {boolean} [opts.debugPath]
   * @param {() => void} [opts.onStart]
   * A callback to invoke after npc has started walking in crowd
   */
  async moveTo(dst, opts = {}) {
    // await this.cancel();
    if (this.agent === null) {
      throw new Error(`${this.key}: npc lacks agent`);
    }

    const closest = this.w.npc.getClosestNavigable(toV3(dst), 0.15);
    if (closest === null) {
      throw new Error(`${this.key}: not navigable: ${JSON.stringify(dst)}`);
    }

    if (opts.debugPath ?? showLastNavPath) {
      const path = this.w.npc.findPath(this.getPosition(), closest);
      this.w.debug.setNavPath(path ?? []);
    }

    const position = this.getPosition();
    if (position.distanceTo(closest) < 0.25) {
      return;
    }

    this.s.moving = true;
    // this.mixer.timeScale = 1;
    this.agent.updateParameters({ maxSpeed: this.getMaxSpeed() });
    this.agent.requestMoveTarget(closest);
    if (opts.onStart !== undefined) {
      this.w.oneTimeTicks.push(opts.onStart);
    }
    this.s.target = this.lastTarget.copy(closest);
    const nextAct = this.s.run ? 'Run' : 'Walk';
    if (this.s.act !== nextAct) {
      this.startAnimation(nextAct);
    }
    
    try {
      await new Promise((resolve, reject) => {
        this.s.rejectMove = reject; // permit cancel
        this.waitUntilStopped().then(resolve).catch(resolve);
      });
    } catch (e) {
      this.stopMoving();
    } finally {
      this.s.moving = false;
    }
  }
  /**
   * An arrow function avoids using an inline-ref in <NPC>. However,
   * `this.onMount` changes on HMR so we rely on idempotence nonetheless.
   * @param {THREE.Group | null} group 
   */
  onMount = (group) => {
    if (group !== null) {
      // Reference mounted group
      this.m.group = group;
      // Setup shortcut
      this.position = group.position;
      // Resume `w.npc.spawn`
      this.resolve?.();
    }
  }
  /** @param {number} deltaMs  */
  onTick(deltaMs) {
    this.mixer.update(deltaMs);

    if (this.agent !== null) {
      this.onTickAgent(deltaMs, this.agent);
    }

    if (this.s.lookAt !== null) {
      dampLookAt(this.m.group, this.s.lookAt, 0.25, deltaMs);
    }
  }
  /**
   * @param {number} deltaMs
   * @param {import('@recast-navigation/core').CrowdAgent} agent
   */
  onTickAgent(deltaMs, agent) {
    const pos = agent.position();
    const vel = agent.velocity();
    const speed = Math.sqrt(vel.x ** 2 + vel.z ** 2);
    
    this.position.copy(pos);

    if (speed > 0.2) {
      this.s.lookAt = this.lastLookAt.copy(pos).add(vel);
    } 

    if (this.s.target === null) {
      return;
    }

    const nextCorner = agent.nextTargetInPath();
    if (this.lastCorner.equals(nextCorner) === false) {
      this.w.events.next({ key: 'way-point', npcKey: this.key,
        x: this.lastCorner.x, y: this.lastCorner.z,
        next: { x: nextCorner.x, y: nextCorner.z },
      });
      this.lastCorner.copy(nextCorner);
    }

    // this.mixer.timeScale = Math.max(0.5, speed / this.getMaxSpeed());
    const distance = this.s.target.distanceTo(pos);
    // console.log({ speed, distance, dVel: agent.raw.dvel, nVel: agent.raw.nvel });

    if (distance < 0.15) {// Reached target
      this.stopMoving();
      this.w.events.next({ key: 'way-point', npcKey: this.key,
        x: this.lastCorner.x, y: this.lastCorner.z,
        next: null,
      });
      return;
    }
    
    // if (distance < 2.5 * this.agentRadius && (agent.updateFlags & 2) !== 0) {
    //   // Turn off obstacle avoidance to avoid deceleration near nav border
    //   // 🤔 might not need for hyper casual
    //   agent.updateParameters({ updateFlags: agent.updateFlags & ~2 });
    // }

    // if (distance < 2 * this.agentRadius) {// undo speed scale
    //   // https://github.com/recastnavigation/recastnavigation/blob/455a019e7aef99354ac3020f04c1fe3541aa4d19/DetourCrowd/Source/DetourCrowd.cpp#L1205
    //   agent.updateParameters({
    //     maxSpeed: this.getMaxSpeed() * ((2 * this.agentRadius) / distance),
    //   });
    // }
  }
  removeAgent() {
    if (this.agent !== null) {
      this.w.crowd.removeAgent(this.agent.agentIndex);
      this.agent = null;
    }
  }
  setupMixer() {
    this.mixer = new THREE.AnimationMixer(this.m.group);
    this.m.animMap = this.m.animations.reduce((agg, a) => helper.isAnimKey(a.name)
      ? (agg[a.name] = this.mixer.clipAction(a), agg)
      : (warn(`ignored unexpected animation: ${a.name}`), agg)
    , /** @type {typeof this['m']['animMap']} */ ({}));
  }
  /** @param {THREE.Vector3Like} dst  */
  setPosition(dst) {
    this.position.copy(dst);
  }
  /** @param {NPC.AnimKey} act */
  startAnimation(act) {
    const anim = this.m.animMap[this.s.act];
    const next = this.m.animMap[act];
    anim.fadeOut(glbFadeOut[this.s.act][act]);
    next.reset().fadeIn(glbFadeIn[this.s.act][act]).play();
    this.mixer.timeScale = npcClassToMeta[this.def.classKey].timeScale[act] ?? 1;
    this.s.act = act;
  }
  stopMoving() {
    if (this.agent == null) {
      return;
    }

    const position = this.agent.position();
    this.s.target = null;
    this.s.lookAt = null;
    this.agent.updateParameters({
      maxSpeed: this.getMaxSpeed(),
      updateFlags: defaultAgentUpdateFlags,
    });
    
    this.startAnimation('Idle');
    // suppress final movement
    this.agent.teleport(position);
    // keep target, so moves out of the way of other npcs
    this.agent.requestMoveTarget(position);

    this.w.events.next({ key: 'stopped-moving', npcKey: this.key });
  }
  toJSON() {
    return {
      key: this.key,
      def: this.def,
      epochMs: this.epochMs,
      s: this.s,
    };
  }
  async waitUntilStopped() {
    if (this.s.moving === false) {
      return;
    }
    await new Promise((resolve, reject) => {
      const sub = this.w.events.pipe(
        this.w.lib.filter(e => 'npcKey' in e && e.npcKey === this.key)
      ).subscribe(e => {
        if (e.key === 'stopped-moving') {
          sub.unsubscribe();
          resolve(null);
        } else if (e.key === 'removed-npc') {
          sub.unsubscribe();
          reject(`${'waitUntilStopped'}: npc was removed`)
        }
      });
    });
  }
}

/**
 * Creates a new NPC loaded with previous one's data.
 * @param {NPC.NPC} npc 
 * @returns {NPC.NPC}
 */
export function hotModuleReloadNpc(npc) {
  const { def, epochMs, m, s, mixer, position, agent, lastLookAt, lastTarget, lastCorner, scale } = npc;
  agent?.updateParameters({ maxSpeed: agent.maxSpeed });
  // npc.changeSkin('robot-vaccino.png'); // 🔔 Skin debug
  const nextNpc = new Npc(def, npc.w);
  return Object.assign(nextNpc, /** @type {Partial<Npc>} */ ({
    epochMs,
    m,
    s: Object.assign(nextNpc.s, s),
    mixer,
    position,
    agent,
    lastLookAt,
    lastTarget,
    lastCorner,
    scale,
  }));
}

/** @param {any} error */
function emptyReject(error) {}

/** @type {Partial<import("@recast-navigation/core").CrowdAgentParams>} */
export const crowdAgentParams = {
  radius: helper.defaults.radius, // 🔔 too large causes jerky collisions
  height: 1.5,
  maxAcceleration: 10, // Large enough for 'Run'
  // maxSpeed: 0, // Set elsewhere
  pathOptimizationRange: helper.defaults.radius * 20, // 🚧 clarify
  // collisionQueryRange: 2.5,
  collisionQueryRange: 0.7,
  separationWeight: 1,
  queryFilterType: 0,
  // userData, // 🚧 not working?
  // obstacleAvoidanceType
  updateFlags: defaultAgentUpdateFlags,
};
