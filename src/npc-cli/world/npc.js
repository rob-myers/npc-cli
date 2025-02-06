import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { damp, dampAngle } from "maath/easing";

import { Vect } from '../geom';
import { defaultAgentUpdateFlags, defaultNpcInteractRadius, glbFadeIn, glbFadeOut, npcClassToMeta } from '../service/const';
import { error, info, warn } from '../service/generic';
import { geom } from '../service/geom';
import { buildObjectLookup, emptyAnimationMixer, emptyGroup, getParentBones, tmpVectThree1, toV3, toXZ } from '../service/three';
import { helper } from '../service/helper';
import { addBodyKeyUidRelation, npcToBodyKey } from '../service/rapier';
import { cmUvService } from "../service/uv";

export class Npc {

  /** @type {string} User specified e.g. `rob` */
  key;
  /** @type {import('./World').State} World API */
  w;
  /** @type {NPC.NPCDef} Initial definition */
  def;
  /** @type {number} When we (re)spawned */
  epochMs;
  /** @type {number} Physics body identifier i.e. `hashText(key)` */
  bodyUid;
  
  /** Model */
  m = {
    animations: /** @type {THREE.AnimationClip[]} */ ([]),
    /** Root bones */
    bones: /** @type {THREE.Bone[]} */ ([]),
    /** Root group available on mount */
    group: emptyGroup,
    /** Mounted material (initially THREE.MeshPhysicalMaterial via GLTF) */
    material: /** @type {THREE.ShaderMaterial} */ ({}),
    /** Mounted mesh */
    mesh: /** @type {THREE.SkinnedMesh} */ ({}),
    quad: /** @type {import('../service/uv').CuboidManQuads} */ ({}),
    toAct: /** @type {Record<NPC.AnimKey, THREE.AnimationAction>} */ ({}),
    scale: 1,
  }
  
  mixer = emptyAnimationMixer;
  /** Shortcut to `this.m.group.position` */
  position = tmpVectThree1;

  /** State */
  s = {
    act: /** @type {NPC.AnimKey} */ ('Idle'),
    agentState: /** @type {null | number} */ (null),
    cancels: 0,
    doMeta: /** @type {null | Geom.Meta} */ (null),
    faceId: /** @type {null | NPC.UvQuadId} */ (null),
    fadeSecs: 0.3,
    iconId: /** @type {null | NPC.UvQuadId} */ (null),
    label: /** @type {null | string} */ (null),
    /** Desired look angle (rotation.y) */
    lookAngleDst: /** @type {null | number} */ (null),
    lookSecs: 0.3,
    /** An offMeshConnection traversal */
    offMesh: /** @type {null | NPC.OffMeshState} */ (null),
    opacity: 1,
    /** Desired opacity */
    opacityDst: /** @type {null | number} */ (null),
    run: false,
    spawns: 0,
    target: /** @type {null | THREE.Vector3} */ (null),
    /** Target gmRoomId */
    targetGrId: /** @type {null | Geomorph.GmRoomId} */ (null),
    selectorColor: /** @type {[number, number, number]} */ ([0.6, 0.6, 1]),
    showSelector: false,
    wayIndex: 0,
  };
  
  /** @type {null | NPC.CrowdAgent} */
  agent = null;
  /** @type {null | dtCrowdAgentAnimation} */
  agentAnim = null;
  
  /**
   * - Current target (if moving)
   * - Last set one (if not)
   */
  lastTarget = new THREE.Vector3();

  resolve = {
    fade: /** @type {undefined | ((value?: any) => void)} */ (undefined),
    move: /** @type {undefined | ((value?: any) => void)} */ (undefined),
    spawn: /** @type {undefined | ((value?: any) => void)} */ (undefined),
    turn: /** @type {undefined | ((value?: any) => void)} */ (undefined),
  };

  reject = {
    fade: /** @type {undefined | ((error: any) => void)} */ (undefined),
    move: /** @type {undefined | ((error: any) => void)} */ (undefined),
    // spawn: /** @type {undefined | ((error: any) => void)} */ (undefined),
    turn: /** @type {undefined | ((error: any) => void)} */ (undefined),
  };

  /** Shortcut */
  get baseTexture() {
    return this.w.npc.tex[this.def.classKey];
  }
  /** Shortcut */
  get labelTexture() {
    return this.w.npc.tex.labels;
  }

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
    this.agent ??= this.w.crowd.addAgent(this.position, {
      ...crowdAgentParams,
      maxSpeed: this.s.run ? helper.defaults.runSpeed : helper.defaults.walkSpeed,
      queryFilterType: this.w.lib.queryFilterType.excludeDoors,
    });
    this.agentAnim = this.w.crowd.raw.getAgentAnimation(this.agent.agentIndex) ?? null;
    return this.agent;
  }

  async cancel() {
    info(`${'cancel'}: cancelling ${this.key}`);

    this.reject.fade?.(`${'cancel'}: cancelled fade`);
    this.reject.move?.(`${'cancel'}: cancelled move`);
    this.reject.turn?.(`${'cancel'}: cancelled turn`);

    this.w.events.next({ key: 'npc-internal', npcKey: this.key, event: 'cancelled' });
  }

  dispose() {// 🚧

  }

  /**
   * Either:
   * - `p.meta.do` i.e. p is a "do point"
   * - `p.meta.nav` and `npc.doMeta` i.e. point navigable, npc at a "do point"
   * - `p` is nearly navigable and `npc` is off-mesh
   * 
   * @param {Geom.Meta<Geom.VectJson | THREE.Vector3Like>} p 
   * @param {object} opts
   * @param {any[]} [opts.extraParams] // 🚧 clarify
   */
  async do(p, opts = {}) {
    if (!Vect.isVectJson(p)) {
      throw Error('point expected');
    }
    if (!p.meta) {
      throw Error('point.meta expected');
    }

    const point = { ...toXZ(p), meta: p.meta }; // handle v3
    const srcNav = this.w.npc.isPointInNavmesh(this.getPoint());
    
    // point.meta.do
    if (point.meta.do === true) {
      if (srcNav === true) {// nav -> do point
        // await this.onMeshDo(point, { ...opts, preferSpawn: !!point.meta.longClick });
        await this.onMeshDo(point, { ...opts, preferSpawn: false });
      } else {// off nav -> do point
        await this.offMeshDo(point);
      }
      return;
    }

    // point.meta.nav && npc.doMeta
    if (point.meta.nav === true && this.s.doMeta !== null) {
      if (srcNav === true) {
        this.s.doMeta = null;
        await this.moveTo(point);
      // } else if (this.w.npc.canSee(this.getPosition(), point, this.getInteractRadius())) {
      } else if (true) {
        await this.fadeSpawn(point);
      } else {
        throw Error('cannot reach navigable point')
      }
      return;
    }

    // handle offMesh and click near nav
    if (srcNav === false && point.meta.nav === false) {
      const closest = this.w.npc.getClosestNavigable(toV3(p));
      if (closest !== null) await this.offMeshDo({...toXZ(closest), meta: { nav: true }});
    }
  }

  /**
   * @param {number} [opacityDst] 
   * @param {number} [ms] 
   */
  async fade(opacityDst = 0.2, ms = 300) {
    if (!Number.isFinite(opacityDst)) {
      throw new Error(`${'fade'}: 1st arg must be numeric`);
    }
    this.s.opacityDst = opacityDst;
    this.s.fadeSecs = ms / 1000;
    
    try {
      await new Promise((resolve, reject) => {
        this.resolve.fade = resolve;
        this.reject.fade = reject;
      });
    } catch (e) {
      this.s.opacityDst = null;
      throw e;
    }
  }

  /**
   * Fade out, spawn, then fade in.
   * - `spawn` sets `npc.doMeta` when `meta.do === true`
   * @param {Geom.MaybeMeta<Geom.VectJson>} point 
   * @param {object} opts
   * @param {Geom.Meta} [opts.meta]
   * @param {boolean} [opts.agent]
   * @param {number} [opts.angle]
   * @param {NPC.ClassKey} [opts.classKey]
   * @param {boolean} [opts.requireNav]
   */
  async fadeSpawn(point, opts = {}) {
    try {
      const meta = opts.meta ?? point.meta ?? {};
      point.meta ??= meta; // 🚧 justify
      await this.fade(0, 300);

      const currPoint = this.getPoint();
      const dx = point.x - currPoint.x;
      const dy = point.y - currPoint.y;

      await this.w.npc.spawn({
        agent: opts.agent,
        // -dy because "ccw east" relative to (+x,-z)
        angle: opts.angle ?? (dx === 0 && dy === 0 ? undefined : Math.atan2(-dy, dx)),
        classKey: opts.classKey,
        meta: opts.meta,
        npcKey: this.key,
        point,
        requireNav: opts.requireNav,
      });
    } finally {
      await this.fade(1, 300);
    }
  }

  forceUpdate() {
    this.epochMs = Date.now();
    this.w.npc.update();
  }

  /**
   * ccw from east convention
   */
  getAngle() {// Assume only rotated about y axis
    return geom.radRange(Math.PI/2 - this.m.group.rotation.y);
  }

  /**
   * @param {number} ccwEastAngle ccw from east (standard mathematical convention)
   * @returns {number} respective value of `rotation.y` taking initial facing angle into account
   * - euler y rotation has same sense/sign as "ccw from east"
   * - +pi/2 because character initially facing along +z
   */
  getEulerAngle(ccwEastAngle) {
    return Math.PI/2 + ccwEastAngle;
  }

  getInteractRadius() {
    return defaultNpcInteractRadius;
  }

  /** @returns {Geom.VectJson} */
  getPoint() {
    const { x, z: y } = this.position;
    return { x, y };
  }

  getPosition() {
    return this.position;
  }

  /**
   * Radius depends on whether idle, walking or running.
   */
  getRadius() {
    if (this.s.target === null) {
      return helper.defaults.radius;
    } else if (this.s.run === true) {
      return helper.defaults.radius * 3;
    } else {
      return helper.defaults.radius * 2;
    }
  }

  getSlowSpeed() {
    return this.def.walkSpeed * 0.5;
  }

  getMaxSpeed() {
    // return 0.5;
    return this.s.run === true ? this.def.runSpeed : this.def.walkSpeed;
  }

  /**
   * 1. Step `offMesh.seg` through `[0, 1, 2]`
   * 
   * 1. Handle turns onto/along an offMeshConnection.
   * 
   * 1. Handle collisions during initial segment of offMeshConnection.
   * Recast-Detour doesn't support collisions from `this` agent's perspective,
   * and we've turned off its handling of the other agent.
   * 
   * To get neighbours working during offMeshConnections, we modified `dtCrowd::update`.
   * 
   * We also changed `dtCrowd::update` to ignore collisions of
   * a neighbour on initial part of an offMeshConnection.
   *
   * @param {NPC.CrowdAgent} agent
   * @param {NPC.OffMeshState} offMesh
   */
  handleOffMeshConnection(agent, offMesh) {
    const anim = /** @type {dtCrowdAgentAnimation} */ (this.agentAnim);

    if (offMesh.seg === 0) {// handle collisions
      const closeDist = helper.defaults.radius * 1.8;
      const closerDist = helper.defaults.radius * 1;

      const nneis  = agent.raw.nneis;
      /** @type {dtCrowdNeighbour} */ let nei;

      for (let i = 0; i < nneis; i++) {
        nei = agent.raw.get_neis(i);
        if (nei.dist < closeDist) {// maybe cancel traversal and other
          const other = this.w.npc.getByNpcUid(nei.idx);
          if (other.s.target === null && !(nei.dist < closerDist)) {
            continue;
          }
          this.stopMoving();
          if (other.s.offMesh !== null && other.s.offMesh.seg > 0) {
            continue;
          }
          other.stopMoving();
          break;
        }
      }
    }

    if (offMesh.seg === 0 && anim.t > anim.tmid) {
      offMesh.seg = 1;
      // 🚧 move to useHandleEvents
      // 🔔 on enter offMeshConnection main seg, if another is traversing main seg, go slowly
      for (const tr of this.w.e.doorToOffMesh[offMesh.orig.gdKey] ?? []) {
        if (tr.npcKey === this.key) continue;
        if (tr.seg === 0) continue;
        const anim = /** @type {dtCrowdAgentAnimation} */ (this.agentAnim);
        anim.set_tmax(anim.t + this.position.distanceTo(toV3(offMesh.dst)) / this.getSlowSpeed());
        agent.updateParameters({ maxSpeed: this.getSlowSpeed() });
        this.startAnimation('Walk');
      }
    } else if (offMesh.seg === 1 && anim.t > 0.5 * (anim.tmid + anim.tmax)) {
      offMesh.seg = 2;
    }

    let dirX = 0, dirY = 0;
    if (offMesh.seg === 0) {
      // 🤔 should init/main be unit vectors?
      dirX = offMesh.init.x + (anim.t / anim.tmid)**2 * (offMesh.main.x - offMesh.init.x);
      dirY = offMesh.init.y + (anim.t / anim.tmid)**2 * (offMesh.main.y - offMesh.init.y);
    } else {
      dirX = offMesh.main.x;
      dirY = offMesh.main.y;
    }
    
    this.s.lookAngleDst = this.getEulerAngle(Math.atan2(-dirY, dirX));

  }

  /**
   * Initialization we can do before mounting
   * @param {import('three-stdlib').GLTF & import('@react-three/fiber').ObjectMap} gltf
   */
  initialize({ scene, animations }) {
    const { m } = this;
    const meta = npcClassToMeta[this.def.classKey];
    const clonedRoot = /** @type {THREE.Group} */ (SkeletonUtils.clone(scene));
    const objectLookup = buildObjectLookup(clonedRoot);

    m.animations = animations;
    // cloned bones
    m.bones = getParentBones(Object.values(objectLookup.nodes));
    // cloned mesh (overridden on mount)
    m.mesh = /** @type {THREE.SkinnedMesh} */ (objectLookup.nodes[meta.meshName]);
    // overridden on mount
    m.material = /** @type {Npc['m']['material']} */ (m.mesh.material);
    m.mesh.userData.npcKey = this.key; // To decode pointer events

    m.mesh.updateMatrixWorld();
    m.mesh.computeBoundingBox();
    m.mesh.computeBoundingSphere();
    
    const npcClassKey = this.def.classKey;
    m.scale = npcClassToMeta[npcClassKey].scale;
    m.quad = cmUvService.getDefaultUvQuads(this.def.classKey);
    // ℹ️ see w.npc.spawn for more initialization
  }

  /**
   * @param {number | Geom.VectJson | THREE.Vector3Like} input
   * - radians (ccw from east), or
   * - point
   * @param {number} [ms]
   */
  async look(input, ms = 300) {
    if (this.w.lib.isVectJson(input)) {
      const src = this.getPoint();
      const p = toXZ(input); // handle v3
      input = src.x === p.x && src.y === p.y
        ? this.getAngle()
        : Math.atan2(-(p.y - src.y), p.x - src.x)
      ;
    }

    if (!Number.isFinite(input)) {
      throw new Error(`${'look'}: 1st arg must be radians or point`);
    }

    this.s.lookAngleDst = this.getEulerAngle(input);
    this.s.lookSecs = ms / 1000;

    try {
      await new Promise((resolve, reject) => {
        this.resolve.turn = resolve;
        this.reject.turn = reject;
      });
    } catch (e) {
      this.s.lookAngleDst = null;
      throw e;
    }
  }

  /**
   * @param {Geom.MaybeMeta<Geom.VectJson | THREE.Vector3Like>} dst
   * @param {object} [opts]
   * @param {boolean} [opts.debugPath]
   */
  async moveTo(dst, opts = {}) {
    if (this.agent === null) {
      throw new Error(`${this.key}: npc lacks agent`);
    }

    // doorway half-depth 0.3 or 0.4, i.e. ≤ 0.5
    const closest = this.w.npc.getClosestNavigable(toV3(dst), 0.5);
    if (closest === null) {
      throw new Error(`${this.key}: not navigable: ${JSON.stringify(dst)}`);
    }

    // usually have target gmRoomId via dst.meta.grKey in `click`
    this.s.targetGrId = dst.meta?.grKey !== undefined
      ? helper.getGmRoomId(dst.meta.grKey)
      : this.w.gmGraph.findRoomContaining(toXZ(closest))
    ;

    if (opts.debugPath ?? showLastNavPath) {
      const path = this.w.npc.findPath(this.getPosition(), closest);
      this.w.debug.setNavPath(path ?? []);
    }

    this.s.wayIndex = 0;
    this.s.lookSecs = 0.15;

    this.agent.updateParameters({
      maxAcceleration: movingMaxAcceleration,
      maxSpeed: this.getMaxSpeed(),
      radius: (this.s.run ? 3 : 2) * helper.defaults.radius, // reset
      // radius: helper.defaults.radius * 1.5, // reset
      collisionQueryRange: movingCollisionQueryRange,
      separationWeight: movingSeparationWeight,
      queryFilterType: this.w.lib.queryFilterType.excludeDoors,
    });
    this.agent.requestMoveTarget(closest);

    this.s.target = this.lastTarget.copy(closest);
    const nextAct = this.s.run ? 'Run' : 'Walk';
    if (this.s.act !== nextAct) {
      this.startAnimation(nextAct);
    }
    
    try {
      this.w.events.next({ key: 'started-moving', npcKey: this.key });
      await this.waitUntilStopped();
    } catch (e) {
      this.stopMoving();
    }
  }

  /**
   * @param {Geom.MaybeMeta<Geom.VectJson>} point 
   */
  async offMeshDo(point) {
    const src = Vect.from(this.getPoint());
    const meta = point.meta ?? {};

    // if (meta.do !== true && meta.nav !== true) {
    //   throw Error('not doable nor navigable');
    // }

    if (
      !(src.distanceTo(point) <= this.getInteractRadius())
      || !this.w.gmGraph.inSameRoom(src, point)
      // || !this.w.npc.canSee(src, point, this.getInteractRadius())
    ) {
      throw Error('too far away');
    }

    await this.fadeSpawn(
      {...meta.doPoint ?? point}, // 🚧 do points should have meta.doPoint
      {
        angle: meta.nav === true && meta.do !== true
          // use direction src --> point if entering navmesh
          ? src.equals(point)
            ? undefined
            : src.angleTo(point)
          // use meta.orient if staying off-mesh
          : typeof meta.orient === 'number'
            ? Math.PI/2 - (meta.orient * (Math.PI / 180)) // convert to "ccw from east"
            : undefined,
        // fadeOutMs: opts.fadeOutMs,
        meta,
      },
    );    
  }

  /**
   * @param {import('@recast-navigation/core').CrowdAgent} agent
   * @param {number} next
   */
  onChangeAgentState(agent, next) {
    if (next === 2) {// enter offMeshConnection
      // find off-mesh-connection via lookup
      const offMesh = (
        this.w.nav.offMeshLookup[geom.to2DString(agent.raw.get_cornerVerts(0), agent.raw.get_cornerVerts(2))]
        ?? this.w.nav.offMeshLookup[geom.to2DString(agent.raw.get_cornerVerts(3), agent.raw.get_cornerVerts(5))]
        ?? this.w.nav.offMeshLookup[geom.to2DString(agent.raw.get_cornerVerts(6), agent.raw.get_cornerVerts(8))]
        ?? null
      );

      if (offMesh === null) {
        agent.teleport(this.position);
        return error(`${this.key}: bailed out of unknown offMeshConnection: ${JSON.stringify(this.position)}`);
      }
      
      // 🔔 this.s.offMesh set in useHandleEvents
      this.w.events.next({ key: 'enter-off-mesh', npcKey: this.key, offMesh });
      return;
    }
    
    if (this.s.agentState === 2) {// exit offMeshConnection
      if (this.s.offMesh !== null) {
        this.w.events.next({ key: 'exit-off-mesh', npcKey: this.key, offMesh: this.s.offMesh.orig  });
      } else {
        warn(`${this.key}: exited offMeshConnection but this.s.offMesh already null`);
      }
      return;
    }
  }

  /**
   * @param {Geom.MaybeMeta<Geom.VectJson>} point 
   * @param {object} opts
   * @param {boolean} [opts.preferSpawn]
   */
  async onMeshDo(point, opts = {}) {
    const src = this.getPoint();
    const meta = point.meta ?? {};

    /** 🚧 Actual "do point" usually differs from clicked point */
    const doPoint = /** @type {Geom.VectJson} */ (meta.doPoint) ?? point;

    if (meta.do !== true) {
      throw Error('not doable');
    }
    if (!this.w.gmGraph.inSameRoom(src, doPoint)) {
      throw Error('too far away');
    }

    /**
     * `meta.orient` (degrees) uses "cw from north",
     * so convert to more-standard "ccw from east"
     */
    const dstRadians = typeof meta.orient === 'number'
      ? Math.PI/2 - (meta.orient * (Math.PI / 180))
      : undefined
    ;
    
    // ℹ️ could do visibility check (raycast)
    if (!opts.preferSpawn && this.w.npc.isPointInNavmesh(doPoint) === true) {
      /**
       * Walk, [Turn], Do
       */
      await this.moveTo(doPoint);
      if (typeof dstRadians === 'number') {
        await this.look(dstRadians, 500 * geom.compareAngles(this.getAngle(), dstRadians));
      }
      // this.startAnimation('Idle');
      this.startAnimation(meta);
      this.doMeta = meta.do === true ? meta : null;
    } else {
      // sets `this.s.doMeta` because `meta.do === true`
      await this.fadeSpawn(doPoint, {
        angle: dstRadians,
        requireNav: false,
        meta,
        // fadeOutMs: opts.fadeOutMs,
      });
    }
  }

  /**
   * An arrow function avoids using an inline-ref in <NPC>. However,
   * `this.onMount` changes on HMR so we rely on idempotence nonetheless.
   * @param {THREE.Group | null} group 
   */
  onMount(group) {
    if (group !== null) {
      this.m.group = group;
      // Setup shortcut
      this.position = group.position;
      // Resume `w.npc.spawn`
      this.resolve.spawn?.();
    } else {
      this.m.group = emptyGroup;
      this.position = tmpVectThree1;
    }
  }

  /**
   * @param {number} deltaMs
   * @param {number[]} positions
   * Format `[..., bodyUid_i, x_i, y_i, z_i, ...]` for physics.worker
   */
  onTick(deltaMs, positions) {
    this.mixer.update(deltaMs);

    if (this.s.lookAngleDst !== null) {
      if (dampAngle(this.m.group.rotation, 'y', this.s.lookAngleDst, this.s.lookSecs, deltaMs, Infinity, undefined, 0.01) === false) {
        this.s.lookAngleDst = null;
        this.resolve.turn?.();
      }
    }

    if (this.s.opacityDst !== null) {
      if (damp(this.s, 'opacity', this.s.opacityDst, this.s.fadeSecs, deltaMs, undefined, undefined, 0.1) === false) {
        this.s.opacityDst = null;
        this.resolve.fade?.();
      }
      this.setUniform('opacity', this.s.opacity);
    }

    if (this.agent === null) {
      return;
    }

    this.onTickAgent(deltaMs, this.agent);

    if (this.agent.raw.dvel !== 0 || this.s.offMesh !== null) {
      const { x, y, z } = this.position;
      positions.push(this.bodyUid, x, y, z);
    }
  }

  /**
   * @param {number} deltaMs
   * @param {import('@recast-navigation/core').CrowdAgent} agent
   */
  onTickAgent(deltaMs, agent) {
    const pos = agent.position();
    const state = agent.state();
    
    this.position.copy(pos);

    if (state !== this.s.agentState) {
      this.onChangeAgentState(agent, state);
      this.s.agentState = state;
    }

    if (this.s.offMesh !== null) {
      this.handleOffMeshConnection(agent, this.s.offMesh);
      return; // Avoid stopMoving whilst offMesh
    }

    if (this.s.target === null) {
      return;
    }

    this.onTickAgentTurn(agent);

    const distance = this.s.target.distanceTo(pos);

    if (distance < 0.15) {// Reached target
      this.stopMoving();
      return;
    }
  }

  /**
   * @param {import('@recast-navigation/core').CrowdAgent} agent
   */
  onTickAgentTurn(agent) {
    const vel = agent.velocity();
    const speedSqr = vel.x ** 2 + vel.z ** 2;

    if (speedSqr > 0.2 ** 2) {
      this.s.lookAngleDst = this.getEulerAngle(Math.atan2(-vel.z, vel.x));
    }
  }

  removeAgent() {
    if (this.agent === null) {
      return;
    }

    this.w.crowd.removeAgent(this.agent.agentIndex);
    
    this.agent = null;
    this.agentAnim = null;
    this.s.offMesh = null;
  }

  setupMixer() {
    this.mixer = new THREE.AnimationMixer(this.m.group);

    this.m.toAct = this.m.animations.reduce((agg, a) => helper.isAnimKey(a.name)
      ? (agg[a.name] = this.mixer.clipAction(a), agg)
      : (warn(`ignored unexpected animation: ${a.name}`), agg)
    , /** @type {typeof this['m']['toAct']} */ ({}));
  }

  /**
   * @param {null | NPC.UvQuadId} faceId 
   */
  setFace(faceId) {
    this.s.faceId = faceId;
    cmUvService.updateFaceQuad(this);
    // directly change uniform sans render
    const { texId, uvs } = this.m.quad.face;
    this.setUniform('uFaceTexId', texId);
    this.setUniform('uFaceUv', uvs);
    this.updateUniforms();
  }

  /**
   * @param {null | NPC.UvQuadId} iconId 
   */
  setIcon(iconId) {
    this.s.iconId = iconId;
    cmUvService.updateIconQuad(this);
    // directly change uniform sans render
    const { texId, uvs } = this.m.quad.icon;
    this.setUniform('uIconTexId', texId);
    this.setUniform('uIconUv', uvs);
    this.updateUniforms();
  }

  /**
   * Updates label sprite-sheet if necessary.
   * @param {string | null} label
   */
  setLabel(label) {
    this.s.label = label;

    const changedLabelsSheet = label !== null && this.w.npc.updateLabels(label) === true;

    if (changedLabelsSheet === true) {
      // 🔔 might need to update every npc
      // avoidable by previously ensuring labels
      Object.values(this.w.n).forEach((npc) => {
        cmUvService.updateLabelQuad(npc);
        npc.epochMs = Date.now();
      });
    } else {
      cmUvService.updateLabelQuad(this);
      this.epochMs = Date.now();
    }
    
    this.w.npc.update();
  }

  /** @param {THREE.Vector3Like} dst  */
  setPosition(dst) {
    this.position.copy(dst);
  }

  /**
   * @param {number} r in `[0, 1]`
   * @param {number} g in `[0, 1]`
   * @param {number} b in `[0, 1]`
   */
  setSelectorRgb(r, g, b) {
    /** @type {[number, number, number]} */
    const selectorColor = [Number(r) || 0, Number(g) || 0, Number(b) || 0];
    // directly change uniform sans render
    this.setUniform('selectorColor', selectorColor);
    this.updateUniforms();
    // remember for next render
    this.s.selectorColor = selectorColor;
  }

  /**
   * 🚧 refine type
   * @param {'opacity' | 'uFaceTexId' | 'uFaceUv' | 'uIconTexId' | 'uIconUv' | 'selectorColor' | 'showSelector'} name 
   * @param {number | THREE.Vector2[] | [number, number, number] | boolean} value 
   */
  setUniform(name, value) {
    this.m.material.uniforms[name].value = value; 
  }

  /**
   * @param {boolean} shouldShow
   */
  showSelector(shouldShow = !this.s.showSelector) {
    shouldShow = Boolean(shouldShow);
    this.s.showSelector = shouldShow;
    // directly change uniform sans render
    this.setUniform('showSelector', this.s.showSelector);
    this.updateUniforms();
  }

  /**
   * Start specific animation, or animation induced by meta.
   * Returns height to raise off ground e.g. for beds. 
   * @param {NPC.AnimKey | Geom.Meta} input
   * @returns {number}
   */
  startAnimation(input) {
    if (typeof input === 'string') {
      const curr = this.m.toAct[this.s.act];
      const next = this.m.toAct[input];
      curr.fadeOut(glbFadeOut[this.s.act][input]);
      next.reset().fadeIn(glbFadeIn[this.s.act][input]).play();
      this.mixer.timeScale = npcClassToMeta[this.def.classKey].timeScale[input] ?? 1;
      this.s.act = input;
      return 0;
    } else { // input is Geom.Meta
      switch (true) {
        case input.sit:
          this.startAnimation('Sit');
          return typeof input.y === 'number' ? input.y : 0;
        case input.stand:
          this.startAnimation('Idle');
          return 0;
        case input.lie:
          this.startAnimation('Lie');
          return typeof input.y === 'number' ? input.y : 0;
        default:
          this.startAnimation('Idle');
          return 0;
      }
    }
  }

  stopMoving() {
    if (this.agent === null || this.s.target === null) {
      return;
    }

    this.s.target = null;
    this.s.targetGrId = null;
    this.s.lookAngleDst = null;
    this.agent.updateParameters({
      maxSpeed: this.getMaxSpeed() * 0.75,
      maxAcceleration: staticMaxAcceleration,
      updateFlags: defaultAgentUpdateFlags,
      radius: helper.defaults.radius,
      collisionQueryRange: staticCollisionQueryRange,
      separationWeight: staticSeparationWeight,
      // queryFilterType: this.w.lib.queryFilterType.excludeDoors,
      // updateFlags: 1,
    });
    
    this.startAnimation('Idle');

    if (this.s.offMesh === null || this.s.offMesh.seg === 0) {
      const position = this.agent.position();
      this.agent.teleport(position);
      this.agent.requestMoveTarget(position);
      /** @type {dtCrowdAgentAnimation} */ (this.agentAnim).set_active(false);
    } else {// midway through traversal, so stop when finish
      this.agent.requestMoveTarget(toV3(this.s.offMesh.dst));
    }

    this.resolve.move?.();
    this.w.events.next({ key: 'stopped-moving', npcKey: this.key });
  }

  updateUniforms() {
    this.m.material.uniformsNeedUpdate = true;
  }

  async waitUntilStopped() {
    this.s.target !== null && await new Promise((resolve, reject) => {
      this.resolve.move = resolve; // see "stopped-moving"
      this.reject.move = reject; // see w.npc.remove
    });
  }
}

const staticMaxAcceleration = 4;
const movingMaxAcceleration = 8;
const staticSeparationWeight = 2;
const movingSeparationWeight = 0.5;
const staticCollisionQueryRange = 1;
const movingCollisionQueryRange = 1.5;

/** @type {Partial<import("@recast-navigation/core").CrowdAgentParams>} */
export const crowdAgentParams = {
  radius: helper.defaults.radius, // 🔔 too large causes jerky collisions
  height: 1.5,
  maxAcceleration: staticMaxAcceleration,
  pathOptimizationRange: helper.defaults.radius * 30,
  collisionQueryRange: staticCollisionQueryRange,
  separationWeight: staticSeparationWeight,
  queryFilterType: 0,
  updateFlags: defaultAgentUpdateFlags,
};

const showLastNavPath = false;
const tmpVector3 = new THREE.Vector3();

/**
 * @typedef {ReturnType<
 *  import('@recast-navigation/core').Crowd['raw']['getAgentAnimation']
 * >} dtCrowdAgentAnimation
 */

/**
 * @typedef {import('@recast-navigation/wasm').default.dtCrowdNeighbour} dtCrowdNeighbour
 */
