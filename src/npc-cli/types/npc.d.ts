declare namespace NPC {
  type Event =
    | PointerUpEvent
    | PointerMoveEvent
    | { key: "disabled" }
    | { key: "enabled" }
    | { key: "spawned-npc"; npcKey: string }
    | { key: "removed-npc"; npcKey: string };
  // ...

  interface PointerMoveEvent {
    key: "pointermove";
    /** Ordinate `y` */
    height: number;
    /** Properties of the thing we clicked. */
    meta: Geomorph.Meta;
    /** Coords `(x, z)` */
    point: Geom.VectJson;
    screenPoint: Geom.VectJson;
  }

  interface PointerUpEvent {
    key: "pointerup";
    /**  */
    clickId?: string;
    /** Distance in XZ plane from pointerdown */
    distance: number;
    /** Ordinate `y` */
    height: number;
    /** Was this a long press? */
    longPress: boolean;
    /** Coords `(x, z)` */
    point: Geom.VectJson;
    /** Was the right mouse button used?  */
    rmb: boolean;
    /** Properties of the thing we clicked. */
    meta: Geomorph.Meta<{
      /** `(x, z)` of target element centre if any */
      targetCenter?: Geom.VectJson;
    }>;
    screenPoint: Geom.VectJson;
  }
}
