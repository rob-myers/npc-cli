import { glbMeta } from "./const";

/**
 * - Use object so can merge into `w.lib`.
 * - Used in web workers.
 * - Used in server script assets.js.
 */
export const helper = {
  
  defaults: {
    /** 🔔 division by 3 improves collisions */
    radius: glbMeta.radius * glbMeta.scale / 3,
    runSpeed: glbMeta.runSpeed * glbMeta.scale,
    walkSpeed: glbMeta.walkSpeed * glbMeta.scale,
  },

  /** static/assets/3d/minecraft-skins/* */
  fromSkinKey: {
    'minecraft-alex-with-arms.png': true,
    'minecraft-ari.png': true,
    'minecraft-borders.128x128.png': true,
    'minecraft-efe-with-arms.png': true,
    'minecraft-kai.png': true,
    'minecraft-makena-with-arms.png': true,
    'minecraft-noor-with-arms.png': true,
    'minecraft-steve.png': true,
    'minecraft-sunny.png': true,
    'minecraft-zuri.png': true,
    'scientist-dabeyt--with-arms.png': true,
    'scientist-4w4ny4--with-arms.png': true,
    'soldier-_Markovka123_.png': true,
    'soldier-russia.png': true,
    'soldier-darkleonard2.png': true,
    'robot-vaccino.png': true,
  },

  // 🚧 fix types
  // /** @type {Record<NPC.AnimKey, true>} */
  fromAnimKey: {
    Idle: true,
    IdleLeftLead: true,
    IdleRightLead: true,
    Walk: true,
    Run: true,
  },

  /**
   * Usage:
   * - `getGmDoorId(gdKey)`
   * - `getGmDoorId(gmId, doorId)`
   * @param {[Geomorph.GmDoorKey] | [number, number]} input
   * @returns {Geomorph.GmDoorId}
   */
  getGmDoorId(...input) {
    if (typeof input[0] === 'string') {
      const [, gStr, dStr] = input[0].split(/[gd]/);
      return { gdKey: input[0], gmId: Number(gStr), doorId: Number(dStr) };
    } else {
      return { gdKey: helper.getGmDoorKey(input[0], input[1]), gmId: input[0], doorId: input[1] };
    }
  },

  /**
   * @param {number} gmId
   * @param {number} doorId
   * @returns {Geomorph.GmDoorKey}
   */
  getGmDoorKey(gmId, doorId) {
    return `g${gmId}d${doorId}`;
  },

  /**
   * @param {number} gmId
   * @param {number} roomId
   * @returns {Geomorph.GmRoomKey}
   */
  getGmRoomKey(gmId, roomId) {
    return `g${gmId}r${roomId}`;
  },

  /**
   * @param {string} input 
   * @returns {input is NPC.SkinKey}
   */
  isSkinKey(input) {
    return input in helper.fromSkinKey;
  },
  
  /**
   * @param {string} input 
   * @returns {input is NPC.AnimKey}
   */
  isAnimKey(input) {
    return input in helper.fromAnimKey;
  }

};

/**
 * @typedef {typeof helper} Helper
 */
