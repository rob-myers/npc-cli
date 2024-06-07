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
  // idleFrames: 48,
  // runFrames: 24,
  // walkFrames: 24,
});

/** @type {NPC.NpcClassKey} */
export const defaultNpcClassKey = 'scientist-dabeyt--with-arms.png';
