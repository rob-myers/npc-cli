declare namespace NPC {

  /** Skin names. */
  type NpcClassKey = keyof import('../service/npc').NpcService['fromNpcClassKey'];

  type NPC = import('../aux/create-npc').Npc;

  interface NPCDef {
    /** User specified e.g. `rob` */
    key: string;
    classKey: NpcClassKey;
    /** Radians */
    angle: number;
    position: Geom.VectJson;
    /** World units per second */
    runSpeed: number;
    /** World units per second */
    walkSpeed: number;
  }

  interface SpawnOpts extends Partial<Pick<NPCDef, 'angle' | 'runSpeed' | 'walkSpeed'>> {
    npcKey: string;
    npcClassKey?: NPC.NpcClassKey;
    point: Geom.VectJson;
    meta?: Geom.Meta;
    requireNav?: boolean;
  }

  interface BasicAgentMeta {
    /** `agent.userData.key` falling back to `${agent.agentId}` */
    agentKey: string;
    position: THREE.Vector3Like;
    target: THREE.Vector3Like | null;
  }

  // 🚧 WIP
  type AnimKey = 'Idle' | 'Walk' | 'Run';

  type Event =
    | PointerUpOutsideEvent
    | PointerUpEvent
    | PointerDownEvent
    | LongPointerDownEvent
    // | PointerMoveEvent
    | { key: "disabled" }
    | { key: "draw-floor-ceil"; gmKey: Geomorph.GeomorphKey }
    | { key: "enabled" }
    | { key: 'npc-internal'; npcKey: string; event: 'cancelled' | 'paused' | 'resumed' }
    | { key: "spawned"; npcKey: string; }
    | { key: 'stopped-walking'; npcKey: string; }
    | { key: "removed-npc"; npcKey: string }
    // 🚧 ...

  type PointerUpEvent = Pretty<BasePointerEvent & {
    key: "pointerup";
  }>;

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
