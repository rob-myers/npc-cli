declare namespace NPC {
  type Event =
    | PointerUpOutsideEvent
    | PointerUpEvent
    // | PointerMoveEvent
    | PointerDownEvent
    | LongPointerDownEvent
    | { key: "disabled" }
    | { key: "enabled" }
    | { key: "spawned-npc"; npcKey: string }
    | { key: "removed-npc"; npcKey: string }
    | { key: "draw-floor-ceil"; gmKey: Geomorph.GeomorphKey };
  // ...

  // interface PointerMoveEvent {
  //   key: "pointermove";
  //   /** Ordinate `y` */
  //   height: number;
  //   /** Properties of the thing we clicked. */
  //   meta: Geom.Meta;
  //   /** Coords `(x, z)` */
  //   point: Geom.VectJson;
  //   screenPoint: Geom.VectJson;
  // }

  interface PointerUpEvent extends BasePointerUpEvent {
    key: "pointerup";
    point: import("three").Vector3Like;
    /** Properties of the thing we clicked. */
    meta: Geom.Meta<{
      /** `(x, z)` of target element centre if any */
      targetCenter?: Geom.VectJson;
    }>;
  }

  interface PointerUpOutsideEvent extends BasePointerUpEvent {
    key: "pointerup-outside";
  }

  interface PointerDownEvent {
    key: "pointerdown";
    // 🚧 ...
  }
  
  interface LongPointerDownEvent {
    key: "long-pointerdown";
    /** Distance in screen pixels from pointerdown */
    distancePx: number;
    screenPoint: Geom.VectJson;
  }

  interface BasePointerUpEvent {
    clickId?: string;
    /** Distance in screen pixels from pointerdown */
    distancePx: number;
    /** Was this a long press? */
    longPress: boolean;
    /** Was the right mouse button used?  */
    rmb: boolean;
    justLongDown: boolean;
    screenPoint: Geom.VectJson;
  }

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
