declare namespace NPC {

  /** Skin names. */
  type SkinKey = keyof import('../service/helper').Helper['fromSkinKey'];

  type NPC = import('../world/npc').Npc;

  interface NPCDef {
    /** User specified e.g. `rob` */
    key: string;
    skinKey: SkinKey;
    /** Radians */
    angle: number;
    position: import("three").Vector3Like;
    /** World units per second */
    runSpeed: number;
    /** World units per second */
    walkSpeed: number;
  }

  interface SpawnOpts extends Partial<Pick<NPCDef, 'angle' | 'runSpeed' | 'walkSpeed'>> {
    npcKey: string;
    skinKey?: NPC.SkinKey;
    point: import("three").Vector3Like;
    meta?: Geom.Meta;
    requireNav?: boolean;
    /** Should NPC have agent? */
    agent?: boolean;
  }

  type AnimKey = keyof import('../service/helper').Helper['fromAnimKey'];

  type Event =
    | PointerUpOutsideEvent
    | PointerUpEvent
    | PointerDownEvent
    | LongPointerDownEvent
    // | PointerMoveEvent
    | { key: "disabled" }
    | { key: "enabled" }
    | { key: 'npc-internal'; npcKey: string; event: 'cancelled' | 'paused' | 'resumed' }
    | { key: "spawned"; npcKey: string }
    | { key: 'stopped-moving'; npcKey: string }
    | { key: "removed-npc"; npcKey: string }
    | { key: "way-point"; npcKey: string; } & Geom.VectJson
    | { key: "decor-instantiated" }
    | { key: "decors-removed"; decors: Geomorph.Decor[] }
    | { key: "decors-added"; decors: Geomorph.Decor[] }
    | { key: "opened-door"; gmId: number; doorId: number; npcKey?: string }
    | { key: "closed-door"; gmId: number; doorId: number; npcKey?: string }
    | { key: "locked-door"; gmId: number; doorId: number; npcKey?: string }
    | { key: "unlocked-door"; gmId: number; doorId: number; npcKey?: string }
    | { key: "entered-sensor" | "exited-sensor"; npcKey: string } & (
      | { type: 'door' } & Geomorph.GmDoorId
    )
    // 🚧 ...

  type PointerUpEvent = Pretty<BasePointerEvent & {
    key: "pointerup";
  }>;

  type PointerUp3DEvent = PointerUpEvent & { is3d: true };

  type PointerUpOutsideEvent = Pretty<BasePointerEvent & {
    key: "pointerup-outside";
    is3d: false;
  }>;

  type PointerDownEvent = Pretty<BasePointerEvent & {
    key: "pointerdown";
  }>;
  
  type LongPointerDownEvent = BasePointerEvent & {
    key: "long-pointerdown";
    is3d: false; // could extend to 3d
  }

  type BasePointerEvent = {
    /** For future use with CLI */
    clickId?: string;
    /** Distance in screen pixels from previous pointerdown. */
    distancePx: number;
    /** Was previous pointerdown held down for long? */
    justLongDown: boolean;
    /** Ctrl/Shift/Command was down */
    keys?: ('ctrl' | 'shift' | 'meta')[];
    /** Number of active pointers */
    pointers: number;
    /** Was the right mouse button being pressed?  */
    rmb: boolean;
    /** Screen position of pointer */
    screenPoint: Geom.VectJson;
    /** Touch device? */
    touch: boolean;
  } &  (
    | { is3d: false; }
    | {
        is3d: true;
        point: import("three").Vector3Like;
        /** Properties of the thing we clicked. */
        meta: Geom.Meta;
      }
  );

  type ClickMeta = Geom.VectJson & Pick<BasePointerEvent, 'keys'> & {
    meta: Geom.Meta;
    /** Original 3D point */
    v3: import('three').Vector3Like;
  };

  type TiledCacheResult = Extract<
    import("@recast-navigation/core").NavMeshImporterResult,
    { tileCache?: any }
  >;

  interface TileCacheConvexAreaDef {
    areaId: number;
    areas: {
      /** Must define a convex polygon */
      verts: import("three").Vector3Like[];
      hmin: number;
      hmax: number;
    }[];
  }

  type CrowdAgent = import("@recast-navigation/core").CrowdAgent;

  type Obstacle = {
    id: number;
    o: import("@recast-navigation/core").Obstacle;
    mesh: THREE.Mesh;
  };

  type ObstacleRef = import("@recast-navigation/core").ObstacleRef;

}
