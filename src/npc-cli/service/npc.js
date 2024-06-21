import { glbMeta } from "./const";

/**
 * Use object so can merge into `api.lib`.
 */
export const npcService = {

  defaults: {
    /** 🔔 division by 3 improves collisions */
    radius: glbMeta.radius * glbMeta.scale / 3,
    runSpeed: glbMeta.runSpeed * glbMeta.scale,
    walkSpeed: glbMeta.walkSpeed * glbMeta.scale,
  },

  fromNpcClassKey: {
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
   * @param {string} input 
   * @returns {input is NPC.NpcClassKey}
   */
  isNpcClassKey(input) {
    return input in npcService.fromNpcClassKey;
  },
  
  /**
   * @param {string} input 
   * @returns {input is NPC.AnimKey}
   */
  isAnimKey(input) {
    return input in npcService.fromAnimKey;
  }

};

/**
 * @typedef {typeof npcService} NpcService
 */
