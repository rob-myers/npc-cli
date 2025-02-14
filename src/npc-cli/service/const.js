export const localStorageKey = {
  touchTtyCanType: "touch-tty-can-type",
  touchTtyOpen: "touch-tty-open",
  viewerBasePercentage: "viewer-base-percentage",
};

export const longPressMs = 500;

/** For individual Tabs, not all Tabs */
export const zIndexTabs  = /** @type {const} */ ({
  faderOverlay: 100,
  pausedControls: 110,
});

export const zIndexWorld = /** @type {const} */ ({
  stats: 10,
  logger: 20,
  loggerPopUp: 30,
  contextMenu: 40,
  touchCircle: 50,
  disconnectedMessage: 60,

  /** Inside ContextMenu */
  popUpInContextMenu: 1,
});

/** @type {import('@xterm/xterm').ITheme} */
export const xtermJsDebugTheme = {
  background: "#020",
  foreground: "#41FF00",
};

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

/** Unchangeable */
export const geomorphPngRectWidth = 30.3;

/** This is the width, but also the height even for edge geomorphs, because we use texture arrays */
export const floorTextureDimension = geomorphPngRectWidth * worldToSguScale * gmFloorExtraScale;

/** Can be any value in `[1, 5]`. */
export const spriteSheetSymbolExtraScale = 2.5;

/** Can be any value in `[1, 5]`. */
export const spriteSheetDecorExtraScale = 3;

/** Smaller e.g. `1.5` breaks "wall in room" e.g. 102 lab */
export const gmHitTestExtraScale = 2;

export const gmLabelHeightSgu = 12;

/** Higher resolution labels */
export const spriteSheetLabelExtraScale = 5;

/** Decimal place precision */
export const precision = 4;

export const wallOutset = 12 * sguToWorldScale;

export const obstacleOutset = 10 * sguToWorldScale;

/**
 * Walls with any of these tags will not be merged with adjacent walls
 * - `y` (numeric) Height of base off the floor
 * - `h` (numeric) Height of wall
 * - `broad` (true) Not thin e.g. back of lifeboat
 */
export const specialWallMetaKeys = /** @type {const} */ ([
  'y',
  'h',
  'broad',
  'hollow',
]);

export const wallHeight = 2;

export const doorHeight = 1.6;

/** Depth of doorway along line walking through hull door */
export const hullDoorDepth = 40 * sguToWorldScale * sguSymbolScaleDown;

/** Depth of doorway along line walking through door */
export const doorDepth = 20 * sguToWorldScale * sguSymbolScaleDown;

export const doorLockedColor = 'rgb(255, 230, 230)';

export const doorUnlockedColor = 'rgb(230, 255, 230)';

/** @type {NPC.ClassKey} */
export const defaultClassKey = 'cuboid-man';

/**
 * Fade out previous animation (seconds)
 * @type {Record<NPC.AnimKey, Record<NPC.AnimKey, number>>}
 */
export const glbFadeOut = {
    Idle: { Idle: 0, Run: 0.2, Walk: 0.2, Sit: 0.2, Lie: 0 },
    Lie: { Idle: 0, Run: 0, Walk: 0, Sit: 0, Lie: 0 },
    Run: { Idle: 0.05, Run: 0, Walk: 0.2, Sit: 0.2, Lie: 0 },
    Sit: { Idle: 0, Run: 0.2, Walk: 0.2, Sit: 0, Lie: 0 },
    Walk: { Idle: 0.05, Run: 0.2, Walk: 0, Sit: 0.25, Lie: 0 },
};

/**
 * Fade in next animation (seconds).
 * @type {Record<NPC.AnimKey, Record<NPC.AnimKey, number>>}
 */
 export const glbFadeIn = {
    Idle: { Idle: 0, Run: 0.1, Walk: 0.1, Sit: 0.1, Lie: 0 },
    Lie: { Idle: 0, Run: 0, Walk: 0, Sit: 0, Lie: 0 },
    Run: { Idle: 0.05, Run: 0, Walk: 0.1, Sit: 0.2, Lie: 0 },
    Sit: { Idle: 0.1, Run: 0.1, Walk: 0.1, Sit: 0, Lie: 0 },
    Walk: { Idle: 0.05, Run: 0.1, Walk: 0, Sit: 0.2, Lie: 0 },
};

export const defaultNpcInteractRadius = geomorphGridMeters;

/**
 * Maximum possible `1 + 2 + 4 + 8 + 16` i.e. `31`
 * - `DT_CROWD_ANTICIPATE_TURNS` ~ `1`
 * - `DT_CROWD_OBSTACLE_AVOIDANCE` ~ `2`
 * - `DT_CROWD_SEPARATION` ~ `4`
 * - `DT_CROWD_OPTIMIZE_VIS` ~ `8`
 * - `DT_CROWD_OPTIMIZE_TOPO` ~ `16`
 */
// export const defaultAgentUpdateFlags = 1 + 2 + 4;
// export const defaultAgentUpdateFlags = 1 + 2 + 4 + 8 + 16;
// export const defaultAgentUpdateFlags = 1 + 8 + 16;
// 🔔 remove 2 to avoid wobbles due to offMeshConnection
export const defaultAgentUpdateFlags = 1 + 4 + 8 + 16;

export const colliderHeight = 1.8;

/** In meters, or equivalently 2 grid squares */
export const decorGridSize = geomorphGridMeters * 2;

export const decorIconRadius = 5 * sguToWorldScale;

export const fallbackDecorImgKey = {
  /** @type {Geomorph.DecorImgKey} */
  point: 'icon--info',
  /** @type {Geomorph.DecorImgKey} */
  quad: 'icon--warn',
};

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

// export const defaultDoorCloseMs = 12000;
export const defaultDoorCloseMs = 3000;

/** Meters */
export const doorSwitchHeight = 1;

export const doorSwitchDecorImgKey = /** @type {const} */ ('icon--square');

/**
 * @typedef {keyof fromDecorImgKey} DecorImgKey
 */

/** Aligned to media/decor/{key}.svg */
export const fromDecorImgKey = {// 🔔 must extend when adding new decor
  'door--standard': true,
  'door--hull': true,
  'icon--info': true,
  'icon--doc': true,
  'icon--door-closed': true,
  'icon--door-locked': true,
  'icon--door-open': true,
  'icon--door-unlocked': true,
  'icon--warn': true,
  'icon--key-card': true,
  'icon--square': true,
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
  "cargo--003--2x4": true,
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
  "iris-valves--006--1x1": true,
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
  "window--001--0x1": true,
  "window--005--0x2": true,
  "window--007--0x2.4": true,

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
  "extra--020--table-2x0.66": true,
};

/** @type {Record<NPC.ClassKey, NPC.ClassDef>} */
export const npcClassToMeta = {
  'cuboid-man': {
    url: '/assets/3d/cuboid-man.glb',
    scale: 0.65,
    materialName: 'cuboid-man-material',
    meshName: 'cuboid-man-mesh',
    groupName: 'Scene',
    skinBaseName: 'cuboid-man.tex.png',
    timeScale: { 'Idle': 0.2, 'Walk': 0.5 },
    // 🚧
    radius: 0.5,
    walkSpeed: 2.5,
    runSpeed: 4,
  },
  'cuboid-pet': {
    url: '/assets/3d/cuboid-pet.glb',
    // scale: 1,
    scale: 0.6,
    materialName: 'cuboid-pet-material',
    meshName: 'cuboid-pet-mesh',
    groupName: 'Scene',
    skinBaseName: 'cuboid-pet.tex.png',
    timeScale: { 'Idle': 0.4, 'Walk': 0.5 },
    // 🚧
    radius: 0.5,
    walkSpeed: 2,
    runSpeed: 4,
  },
};

export const npcClassKeys = /** @type {NPC.ClassKey[]} */ (
  Object.keys(npcClassToMeta)
);

/**
 * Relates to `npc.def.uid` which is used for object-picking.
 * Technically we can choose any `maxNumberOfNpcs ≤ 2^16 = 65536`.
 */
export const maxNumberOfNpcs = 256;

export const npcNearUiDist = 1.2;

export const physicsConfig = {
  fps: 60,
  agentHeight: 1.5,
  agentRadius: 0.2,
};

/**
 * @type {Record<NPC.ObjectPickedType, boolean>}
 */
export const pickedTypesInSomeRoom = {
    wall: true,
    floor: true,
    ceiling: false,
    door: false,
    quad: true,
    obstacle: true,
    cuboid: true,
    npc: true, // technically not
    'lock-light': false,
};

export const offMeshConnectionHalfDepth = {
  hull: wallOutset + 0.25,
  nonHull: wallOutset + 0.125,
};

export const instancedMeshName = /** @type {const} */ ({
  ceiling: 'ceiling',
  doors: 'doors',
  floor: 'floor',
  obstacles: 'obstacles',
  decorCuboids: 'decorCuboids',
  decorLabels: 'decorLabels',
  decorQuads: 'decorQuads',
  walls: 'walls',
});

/** @type {Partial<Record<InstancedMeshName, true>>} */
export const fromXrayInstancedMeshName = {
  [instancedMeshName.ceiling]: true,
  [instancedMeshName.doors]: true,
  [instancedMeshName.walls]: true,
};

/**
 * @typedef {keyof typeof instancedMeshName} InstancedMeshName
 */

/** @type {Geom.SixTuple} */
export const switchDecorQuadScaleUp = [1, 0, 0, 1.5, 0, 0];
