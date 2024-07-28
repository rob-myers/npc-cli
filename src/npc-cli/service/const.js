export const localStorageKey = {
  touchTtyCanType: "touch-tty-can-type",
  touchTtyOpen: "touch-tty-open",
};

export const longPressMs = 500;

export const zIndex = /** @type {const} */ ({
  ttyTouchHelper: 5,
});

/** Size of starship geomorphs grid side in meters */
export const geomorphGridMeters = 1.5;

/** SVG symbols are drawn 5 times larger */
export const sguSymbolScaleUp = 5;

/** SVG symbols are drawn 5 times larger */
export const sguSymbolScaleDown = 1 / sguSymbolScaleUp;

/**
 * Convert Starship Geomorph units (sgu) into world coordinates (meters).
 * e.g. 1 tile is 60 sgu, which becomes 1.5 meters
 */
export const sguToWorldScale = (1 / 60) * geomorphGridMeters;
/**
 * Convert world coordinates (meters) into Starship Geomorph units (sgu).
 * e.g. 1 tile is 1.5 meters, which becomes 60 sgu
 */
export const worldToSguScale = 1 / sguToWorldScale;

/** Higher resolution floors */
export const gmFloorExtraScale = 2;

/** Can be any value in `[1, 5]`. */
export const spriteSheetSymbolExtraScale = 2.5;

/** Can be any value in `[1, 5]`. */
export const spriteSheetDecorExtraScale = 3;

export const gmLabelHeightSgu = 12;

/** Higher resolution labels */
export const spriteSheetLabelExtraScale = 5;

/** Decimal place precision */
export const precision = 4;

export const wallOutset = 12 * sguToWorldScale;

export const obstacleOutset = 10 * sguToWorldScale;

export const wallHeight = 2;

/** Depth of doorway along line walking through hull door */
export const hullDoorDepth = 8 * sguToWorldScale * sguSymbolScaleDown;

/** Depth of doorway along line walking through door */
export const doorDepth = 20 * sguToWorldScale * sguSymbolScaleDown;

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

/** @type {NPC.SkinKey} */
export const defaultSkinKey = 'scientist-dabeyt--with-arms.png';

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

/** In meters, or equivalently 2 grid squares */
export const decorGridSize = geomorphGridMeters * 2;

export const decorIconRadius = 5 * sguToWorldScale;

/** @type {Geomorph.DecorImgKey} */
export const decorPointFallbackImgKey = 'icon--info';
/** @type {Geomorph.DecorImgKey} */
export const decorQuadFallbackImgKey = 'icon--warn';

/**
 * - Each value is an integer in [0, 255].
 * - Fix alpha as `1` otherwise get pre-multiplied values.
 */
export const hitTestRed = /** @type {const} */ ({
  /** rgba encoding `(255, 0, doorId, 1)` */
  door: 255,
  /** rgba encoding `(0, roomId, 255, 1)` */
  room: 0,
});

export const defaultDoorCloseMs = 12000;

/**
 * @typedef {keyof fromDecorImgKey} DecorImgKey
 */

/** Aligned to media/decor/{key}.svg */
export const fromDecorImgKey = {// 🔔 must extend when adding new decor
  'door--standard': true,
  'door--hull': true,
  'icon--info': true,
  'icon--doc': true,
  'icon--warn': true,
  'icon--key-card': true,
  'white': true,
};

/**
 * @typedef {keyof fromSymbolKey} SymbolKey
 */

/** Aligned to media/symbol/{key}.svg */
export const fromSymbolKey = {// 🔔 must extend when adding new symbols

  "101--hull": true,
  "102--hull": true,
  "103--hull": true,
  "301--hull": true,
  "302--hull": true,
  "303--hull": true,

  "bed--003--1x1.6": true,
  "bed--004--0.8x1.4": true,
  "bed--005--0.6x1.2": true,
  "bridge--042--8x9": true,
  "cargo--002--2x2": true,
  "cargo--010--2x4": true,
  "cargo--003--2x4.svg": true,
  "console--005--1.2x4": true,
  "console--006--1.2x3": true,
  "console--010--1.2x2": true,
  "console--011--1.2x2": true,
  "console--018--1x1": true, 
  "console--019--2x2": true, 
  "console--022--1x2": true,
  "console--031--1x1.2": true,
  "console--033--0.4x0.6": true,
  "console--051--0.4x0.6": true,
  "couch-and-chairs--006--0.4x2": true,
  "couch-and-chairs--007--0.6x1.4": true,
  "counter--007--0.4x1": true,
  "counter--009--0.4x0.4": true,
  "counter--010--0.4x0.4": true,
  "empty-room--006--2x2": true,
  "empty-room--013--2x3": true,
  "empty-room--019--2x4": true,
  "empty-room--020--2x4": true,
  "empty-room--039--3x4": true,
  "empty-room--060--4x4": true,
  "engineering--045--6x4": true,
  "engineering--047--4x7": true,
  "fresher--002--0.4x0.6": true,
  "fresher--015--1x2": true,
  "fresher--020--2x2": true,
  "fresher--025--3x2": true,
  "fresher--036--4x2": true,
  "fuel--010--4x2": true,
  "iris-valves--005--1x1": true,
  "lab--012--4x3": true,
  "lab--018--4x4": true,
  "lab--023--4x4": true,
  "lifeboat--small-craft--2x4": true,
  "lounge--015--4x2": true,
  "lounge--017--4x2": true,
  "low-berth--003--1x1": true,
  "machinery--155--1.8x3.6": true,
  "machinery--156--2x4": true,
  "machinery--158--1.8x3.6": true,
  "machinery--357--4x2": true,
  "medical-bed--005--0.6x1.2": true,
  "medical-bed--006--1.6x3.6": true,
  "medical--007--3x2": true,
  "medical--008--3x2": true,
  "misc-stellar-cartography--020--10x10": true,
  "misc-stellar-cartography--023--4x4": true,
  "office--001--2x2": true,
  "office--004--2x2": true,
  "office--006--2x2": true,
  "office--026--2x3": true,
  "office--020--2x3": true,
  "office--023--2x3": true,
  "office--061--3x4": true,
  "office--074--4x4": true,
  "office--089--4x4": true,
  "ships-locker--003--1x1": true,
  "ships-locker--007--2x1": true,
  "ships-locker--011--2x1": true,
  "ships-locker--020--2x2": true,
  "shop--027--1.6x0.4": true,
  "shop--028--1.6x0.8": true,
  "shop--031--0.4x0.8": true,
  "shop--033--0.6x1.6": true,
  "shop--035--0.4x0.8": true,
  "shop--037--0.4x0.8": true,
  "stateroom--012--2x2": true,
  "stateroom--014--2x2": true,
  "stateroom--018--2x3": true,
  "stateroom--019--2x3": true,
  "stateroom--020--2x3": true,
  "stateroom--035--2x3": true,
  "stateroom--036--2x4": true,
  "table--004--1.2x2.4": true,
  "table--009--0.8x0.8": true,
  "table--012--0.8x0.8": true,

  "extra--001--fresher--0.5x0.5": true,
  "extra--002--fresher--0.5x0.5": true,
  "extra--003--chair--0.25x0.25": true,
  "extra--004--desk--0.5x1": true,
  "extra--005--chair-0.25x0.25": true,
  "extra--006--desk--0.4x1": true,
  "extra--007--desk--0.4x0.66": true,
  "extra--008--desk--0.4x1.33": true,
  "extra--009--table--4x4": true,
  "extra--010--machine--2x1": true,
  "extra--011--machine--1x3": true,
  "extra--012--battery--3x2": true,
  "extra--013--privacy-screen--1.5x0.2": true,
  "extra--014--table--2x3": true,
  "extra--015--table--3x0.5": true,
  "extra--016--table--4x0.5": true,
  "extra--017--table--2x0.5": true,
  "extra--018--table-0.25x0.25": true,
  "extra--019--table-0.5x2": true,
};
