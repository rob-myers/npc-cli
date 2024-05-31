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

export const wallOutset = 10 * worldScale;

export const obstacleOutset = 10 * worldScale;

export const agentRadius = 10 * worldScale;

export const wallHeight = 2;

export const glbMeta = /** @type {const} */ ({
  url: '/assets/3d/minecraft-anim.glb',
  /** Scale factor we'll apply */
  scale: 0.25,
  /** Actual height in Blender */
  height: 2,
  /** Inferred by manually testing using root bone */
  walkSpeed: 1.25,
  /** Inferred by manually testing using root bone */
  runSpeed: 2.5,
});

/** @type {NPC.NpcClassKey} */
export const defaultNpcClassKey = 'scientist-dabeyt--with-arms.png';
