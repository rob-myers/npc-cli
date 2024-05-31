import * as THREE from 'three';
import { info } from '../service/generic';
import { yAxis } from '../service/three';

export class Npc {

  /** @type {string} User specified e.g. `rob` */ key;
  /** @type {NPC.NpcClassKey} */ classKey;
  /** @type {import('./TestWorld').State} World API */ api;
  /** @type {NPC.NPCDef} Initial definition */ def;
  /** @type {number} When we (re)spawned */ epochMs;
  
  root = emptyGroup;

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
  initialize() {
    this.root.position.set(this.def.position.x, 0, this.def.position.y);
    this.root.setRotationFromAxisAngle(yAxis, this.def.angle);
    // this.setGmRoomId(api.gmGraph.findRoomContaining(this.def.position, true));
  }
  /** @param {NPC.AnimKey} animKey */
  startAnimation(animKey) {
    // 🚧
  }
  
}

const emptyGroup = new THREE.Group();

/** @param {any} error */
function emptyReject(error) {}
