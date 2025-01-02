import { fromDecorImgKey, fromSymbolKey, npcClassToMeta } from "./const";

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

  /** @type {Record<NPC.ClassKey, true>} */
  fromNpcClassKey: {
    'cuboid-man': true,
    "cuboid-pet": true,
  },

  /** Global over all `queryFilter`s */
  navPolyFlag: /** @type {const} */ ({
    /** `2^0` */
    unWalkable: 1,
    /** `2^1` */
    walkable: 2,
  }),

  /** Recast-Detour */
  queryFilterType: /** @type {const} */ ({
    default: 0,
    /** Constructed lazily */
    excludeDoors: 1,
  }),

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
    radius: npcClassToMeta["cuboid-man"].radius * npcClassToMeta["cuboid-man"].scale / 2,
    runSpeed: npcClassToMeta["cuboid-man"].runSpeed * npcClassToMeta["cuboid-man"].scale,
    walkSpeed: npcClassToMeta["cuboid-man"].walkSpeed * npcClassToMeta["cuboid-man"].scale,
  },

  // 🚧 fix types
  // /** @type {Record<NPC.AnimKey, true>} */
  fromAnimKey: {
    Idle: true,
    Lie: true,
    Run: true,
    Sit: true,
    Walk: true,
  },

  /**
   * Try construct degenerate "id" from partial.
   * @param {Partial<Geomorph.GmDoorId>} meta 
   * @returns {null | Geomorph.GmDoorId}
   */
  extractGmDoorId(meta) {
    if (typeof meta.gdKey === 'string') {
      return {
        gdKey: meta.gdKey,
        gmId: meta.gmId ?? Number(meta.gdKey.slice(1).split('d', 1)[0]),
        doorId: meta.doorId ?? Number(meta.gdKey.split('d', 1)[1]),
      };
    } else if (typeof meta.gmId === 'number' &&  typeof meta.doorId === 'number') {
      return {
        gdKey: `g${meta.gmId}d${meta.doorId}`,
        gmId: meta.gmId,
        doorId: meta.doorId,
      };
    } else {
      return null;
    }
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
   * @returns {input is NPC.ClassKey}
   */
  isNpcClassKey(input) {
    return input in helper.fromNpcClassKey;
  },
  
  /**
   * @param {string} input 
   * @returns {input is NPC.AnimKey}
   */
  isAnimKey(input) {
    return input in helper.fromAnimKey;
  },

};

/**
 * @typedef {typeof helper} Helper
 */
