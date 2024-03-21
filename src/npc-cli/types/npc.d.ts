declare namespace NPC {
  type Event =
    | PointerUpOutsideEvent
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
    meta: Geom.Meta;
    /** Coords `(x, z)` */
    point: Geom.VectJson;
    screenPoint: Geom.VectJson;
  }

  interface PointerUpEvent extends BasePointerUpEvent {
    key: "pointerup";
    /** Ordinate `y` */
    height: number;
    /** Coords `(x, z)` */
    point: Geom.VectJson;
    /** Properties of the thing we clicked. */
    meta: Geom.Meta<{
      /** `(x, z)` of target element centre if any */
      targetCenter?: Geom.VectJson;
    }>;
  }

  interface PointerUpOutsideEvent extends BasePointerUpEvent {
    key: "pointerup-outside";
  }

  interface BasePointerUpEvent {
    /** 🚧 */
    clickId?: string;
    /** Distance in XZ plane from pointerdown */
    distance: number;
    /** Was this a long press? */
    longPress: boolean;
    /** Was the right mouse button used?  */
    rmb: boolean;
    screenPoint: Geom.VectJson;
  }
}
