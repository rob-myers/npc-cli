import { fromDecorImgKey, fromSymbolKey, glbMeta } from "./const";

/**
 * 🚧 try singleton instance instead, including other methods
 * - Use object so can merge into `w.lib`.
 * - Used in web workers.
 * - Used in server script assets.js.
 */
export const helper = {

  /** Aligned to media/symbol/{key}.svg */
  fromSymbolKey,

  /** Aligned to media/decor/{key}.svg */
  fromDecorImgKey,

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

  /** @type {Record<Geomorph.GeomorphNumber, Geomorph.GeomorphKey>} */
  toGmKey: {
    101: "g-101--multipurpose",
    102: "g-102--research-deck",
    103: "g-103--cargo-bay",
    301: "g-301--bridge",
    302: "g-302--xboat-repair-bay",
    303: "g-303--passenger-deck",
  },

  /** @type {Record<Geomorph.GeomorphKey, Geomorph.GeomorphNumber>} */
  toGmNum: {
    "g-101--multipurpose": 101,
    "g-102--research-deck": 102,
    "g-103--cargo-bay": 103,
    "g-301--bridge": 301,
    "g-302--xboat-repair-bay": 302,
    "g-303--passenger-deck": 303,
  },

  /** @type {Record<Geomorph.GeomorphKey, Geomorph.SymbolKey>} */
  toHullKey: {
    "g-101--multipurpose": "101--hull",
    "g-102--research-deck": "102--hull",
    "g-103--cargo-bay": "103--hull",
    "g-301--bridge": "301--hull",
    "g-302--xboat-repair-bay": "302--hull",
    "g-303--passenger-deck": "303--hull",
  },
  
  defaults: {
    /** 🔔 division by 3 improves collisions */
    radius: glbMeta.radius * glbMeta.scale / 3,
    runSpeed: glbMeta.runSpeed * glbMeta.scale,
    walkSpeed: glbMeta.walkSpeed * glbMeta.scale,
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
   * Usage:
   * - `getGmRoomId(grKey)`
   * - `getGmRoomId(gmId, roomId)`
   * @param {[Geomorph.GmRoomKey] | [number, number]} input
   * @returns {Geomorph.GmRoomId}
   */
  getGmRoomId(...input) {
    if (typeof input[0] === 'string') {
      const [, gStr, rStr] = input[0].split(/[gr]/);
      return { grKey: input[0], gmId: Number(gStr), roomId: Number(rStr) };
    } else {
      return { grKey: helper.getGmRoomKey(input[0], input[1]), gmId: input[0], roomId: input[1] };
    }
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
