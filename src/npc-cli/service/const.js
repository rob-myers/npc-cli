export const localStorageKey = {
  touchTtyCanType: "touch-tty-can-type",
  touchTtyOpen: "touch-tty-open",
};

export const longPressMs = 500;

export const zIndex = /** @type {const} */ ({
  ttyTouchHelper: 5,
});

/**
 * Convert Starship Geomorph units (sgu) into world coordinates (meters).
 * e.g. 1 tile is 60 sgu, which becomes 1.5 meters
 */
export const worldScale = (1 / 60) * 1.5;

/** Can be any value in `[1, 5]`. */
export const spriteSheetNonHullExtraScale = 2.5;

/** Decimal place precision */
export const precision = 4;

export const wallOutset = 12 * worldScale;

export const obstacleOutset = 10 * worldScale;

export const wallHeight = 2;

/** Depth of doorway along line walking through hull door */
export const hullDoorDepth = 8 * worldScale;

/** Depth of doorway along line walking through door */
export const doorDepth = (20 / 5) * worldScale;

/**
 * Properties of exported GLB file.
 */
export const glbMeta = /** @type {const} */ ({
  url: '/assets/3d/minecraft-anim.glb',
  skinnedMeshName: 'minecraft-character-mesh',
  /** Scale factor we'll apply to original model */
  scale: 1.5 / 8,
  /** Height of original model (meters) */
  height: 8,
  /** Dimension [x, y, z] of original model (meters) */
  dimensions: [4, 8, 2],
  /**
   * Collide radius of original model (meters)
   * 🚧 larger for running legs?
   */
  radius: 4,
  /**
   * Walking speed of original model (meters per second).
   * Inferred by manually testing using root bone.
   */
  walkSpeed: 5,
  /**
   * Running speed of original model (meters per second).
   * Inferred by manually testing using root bone.
   */
  runSpeed: 10,
});

/** @type {NPC.NpcClassKey} */
export const defaultNpcClassKey = 'scientist-dabeyt--with-arms.png';

/**
 * Fade out previous animation (seconds)
 * @type {Record<NPC.AnimKey, Record<NPC.AnimKey, number>>}
 */
export const glbFadeOut = {
    Idle: { Idle: 0, Run: 0.2, Walk: 0.2, IdleLeftLead: 0.2, IdleRightLead: 0.2 },
    IdleLeftLead: { Idle: 0, Run: 0.2, Walk: 0.2, IdleLeftLead: 0.2, IdleRightLead: 0.2 },
    IdleRightLead: { Idle: 0, Run: 0.2, Walk: 0.2, IdleLeftLead: 0.2, IdleRightLead: 0.2 },
    Run: { Idle: 0.3, Run: 0, Walk: 0.2, IdleLeftLead: 0.3, IdleRightLead: 0.3 },
    Walk: { Idle: 0.25, Run: 0.2, Walk: 0, IdleLeftLead: 0.25, IdleRightLead: 0.25 },
};

/**
 * Fade in next animation (seconds).
 * @type {Record<NPC.AnimKey, Record<NPC.AnimKey, number>>}
 */
 export const glbFadeIn = {
    Idle: { Idle: 0, Run: 0.1, Walk: 0.1, IdleLeftLead: 0.2, IdleRightLead: 0.2 },
    IdleLeftLead: { Idle: 0, Run: 0.1, Walk: 0.1, IdleLeftLead: 0.1, IdleRightLead: 0.1 },
    IdleRightLead: { Idle: 0, Run: 0.1, Walk: 0.1, IdleLeftLead: 0.1, IdleRightLead: 0.1 },
    Run: { Idle: 0.3, Run: 0, Walk: 0.1, IdleLeftLead: 0.3, IdleRightLead: 0.3 },
    Walk: { Idle: 0.25, Run: 0.1, Walk: 0, IdleLeftLead: 0.25, IdleRightLead: 0.25 },
};

export const showLastNavPath = false;

/**
 * Maximum `1 + 2 + 4 + 8 + 16`
 */
export const defaultAgentUpdateFlags = 1 + 2 + 4;
