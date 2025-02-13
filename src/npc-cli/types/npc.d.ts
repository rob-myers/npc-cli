declare namespace NPC {

  type NPC = import('../world/npc').Npc;

  interface NPCDef {
    /** User specified e.g. `rob` */
    key: string;
    /** Numeric id used in object-picking */
    pickUid: number;
    /** Specifies the underlying 3D model */
    classKey: ClassKey;
    /** Radians */
    angle: number;
    /** World units per second */
    runSpeed: number;
    /** World units per second */
    walkSpeed: number;
  }

  type ClassKey = (
    | 'cuboid-man'
    | 'cuboid-pet'
  );
  
  type TextureKey = (
    | ClassKey
    | 'labels'
    // | 'cuboid-man-alt-1'
  );

  interface UvQuadId {
    uvMapKey: NPC.TextureKey;
    uvQuadKey: string;
  }

  interface ClassDef {
    /** e.g. '/assets/3d/cuboid-man.glb' */
    url: string;
    /** e.g. `1` */
    scale :number;
    /** e.g. 'cuboid-man-material' */
    materialName: string; 
    /** e.g. 'cuboid-man' */
    meshName: string;
    /** e.g. 'Scene' */
    groupName: string;
    /** e.g. 'cuboid-man.tex.png' */
    skinBaseName: string;
    /** Animation to timeScale, default 1 */
    timeScale: { [animName: string]: number };
    /** Pre-scale */
    radius: number;
    walkSpeed: number;
    runSpeed: number;
  }

  interface TexMeta {
    /**
     * e.g. `cuboid-man`
     * 🚧 refine type
     */
    npcClassKey: string;
    /** e.g. `cuboid-man.tex.svg` */
    svgBaseName: string;
    svgPath: string;
    pngPath: string;
    canSkip: boolean;
  }

  interface SpawnOpts extends Partial<Pick<NPCDef, 'angle' | 'classKey' | 'runSpeed' | 'walkSpeed'>> {
    npcKey: string;
  }

  type AnimKey = keyof import('../service/helper').Helper['fromAnimKey'];

  type Event = (
    | PointerUpEvent
    | PointerDownEvent
    | LongPointerDownEvent
    // | PointerMoveEvent
    | { key: "disabled" }
    | { key: "enabled" }
    | { key: "npc-internal"; npcKey: string; event: "cancelled" | "paused" | "resumed" }
    | { key: "spawned"; npcKey: string; gmRoomId: Geomorph.GmRoomId }
    | { key: "started-moving"; npcKey: string; showNavPath: boolean }
    | { key: "stopped-moving"; npcKey: string }
    | { key: "removed-npc"; npcKey: string }
    | { key: "enter-doorway"; npcKey: string } & Geomorph.GmDoorId
    | { key: "exit-doorway"; npcKey: string } & Geomorph.GmDoorId
    | { key: "enter-room"; npcKey: string } & Geomorph.GmRoomId
    | { key: "exit-room"; npcKey: string } & Geomorph.GmRoomId
    | UpdatedGmDecorEvent
    | { key: "decors-removed"; decors: Geomorph.Decor[] }
    | { key: "decors-added"; decors: Geomorph.Decor[] }
    | {
      /** Try close door after countdown, and keep trying thereafter */
      key: "try-close-door";
      gmId: number; doorId: number; meta?: Meta
    }
    | { key: "opened-door"; gmId: number; doorId: number; meta?: Meta }
    | { key: "closed-door"; gmId: number; doorId: number; meta?: Meta }
    | { key: "locked-door"; gmId: number; doorId: number; meta?: Meta }
    | { key: "unlocked-door"; gmId: number; doorId: number; meta?: Meta }
    | { key: "changed-zoom"; level: 'near' | 'far' }
    | { key: "enter-collider"; npcKey: string; } & BaseColliderEvent
    | { key: "exit-collider"; npcKey: string; } & BaseColliderEvent
    | {
        key: "pre-request-nav";
        /**
         * `changedGmIds[gmId]` is `true` iff either:
         * - `map.gms[gmId]` has different `gmKey` or `transform`
         * - geomorph `map.gms[gmId].gmKey` has different navPoly
         * 
         * The latter is true whenever a room polygon changes.
         * 
         * It is defined for each `gmId` in current map.
         */
        changedGmIds: boolean[];
      }
    | { key: "pre-setup-physics" }
    | { key: "nav-updated" }
    | { key: 'contextmenu-link'; linkKey: string }
    | { key: 'clear-off-mesh'; npcKey: string; }
    | { key: 'enter-off-mesh'; npcKey: string; offMesh: NPC.OffMeshLookupValue }
    | { key: 'enter-off-mesh-main'; npcKey: string }
    | { key: 'exit-off-mesh'; npcKey: string; offMesh: NPC.OffMeshLookupValue }
    | { key: 'logger-link'; npcKey: string; } & NPC.LoggerLinkEvent
    | { key: 'speech'; npcKey: string; speech: string }
    // ...
  );

  type UpdatedGmDecorEvent = { key: "updated-gm-decor" } & (
    | { type: 'partial'; gmIds: number[]; } // partial <=> gmsIds.length did not change
    | { type: 'all' }
  );

  type BaseColliderEvent = (
    | { type: 'circle' | 'rect'; decorKey: string }
    | { type: 'nearby' } & Geomorph.GmDoorId
  );

  type PointerUpEvent = Pretty<BasePointerEvent & {
    key: "pointerup";
  }>;

  type PointerDownEvent = Pretty<BasePointerEvent & {
    key: "pointerdown";
  }>;
  
  type LongPointerDownEvent = BasePointerEvent & {
    key: "long-pointerdown";
  }

  type BasePointerEvent = {
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
    position: import("three").Vector3Like;
    /** `{ x: position.x, y: position.z }` */
    point: Geom.VectJson;
    /** Properties of the thing we clicked. */
    meta: Meta;
  };

  type ClickOutput = import('three').Vector3Like & {
    keys?: BasePointerEvent['keys'];
    meta: Meta;
    xz: Geom.VectJson;
  };

  type TiledCacheResult = import('@recast-navigation/core').ImportTileCacheResult;

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

  type SrcToOffMeshLookup = {
    [xz2DString: `${number},${number}`]: OffMeshLookupValue;
  };
  type DoorToOffMeshLookup = {
    [gdKey: Geomorph.GmDoorKey]: OffMeshLookupValue[];
  };

  type OffMeshLookupValue = Geomorph.GmDoorId & {
    offMeshRef: number;
    src: import('three').Vector3Like;
    dst: import('three').Vector3Like;
    /** Key of connection in lookup. */
    key: keyof SrcToOffMeshLookup;
    /** Key of connection in reverse direction. */
    reverseKey: keyof SrcToOffMeshLookup;
    /** Room corresponding to `src` */
    srcGrKey: Geomorph.GmRoomKey;
    /** Room corresponding to `dst` */
    dstGrKey: Geomorph.GmRoomKey;
    /** Whether respective door's normal points towards `src` */
    aligned: boolean;
    /** Meta of dst room e.g. for small rooms */
    dstRoomMeta: Meta;
  };

  type OffMeshState = {
    /** The npc using this offMeshConnection. */
    npcKey: string;
    /** Original connection */
    orig: OffMeshLookupValue;
    /**
     * Current progress along the two segments.
     * - `0` is initial seg, from npc position to start of offMeshConnection
     * - `1` is 1st half of offMeshConnection
     * - `2` is 2nd half of offMeshConnection
     */
    seg: 0 | 1 | 2;
    /** Adjusted src */
    src: Geom.VectJson;
    /** Adjusted dst */
    dst: Geom.VectJson;
    /** Vector from "initial npc position" to "adjusted src" */
    init: Geom.VectJson;
    /** Vector from "adjusted src" to "adjusted dst" */
    main: Geom.VectJson;
  };

  type Obstacle = {
    id: number;
    o: import("@recast-navigation/core").Obstacle;
    mesh: THREE.Mesh;
  };

  type ObstacleRef = import("@recast-navigation/core").ObstacleRef;

  type DecodedObjectPick = Meta<{
    picked: ObjectPickedType;
    instanceId: number;
  }>;

  type ObjectPickedType = (
    | 'wall'
    | 'floor'
    | 'ceiling'
    | 'door'
    | 'quad'
    | 'obstacle'
    | 'cuboid'
    | 'npc'
    | 'lock-light'
  );

  type MetaActDef = (
    | { key: 'open' | 'close' | 'lock' | 'unlock'; gdKey: Geomorph.GmDoorKey; }
    // ...
  );

  /** Action triggered from ContextMenu */
  interface MetaAct<T = {}> {
    def: MetaActDef;
    /** Label of button */
    label: string;
    /** `icon--*` key */
    icon: Geomorph.DecorImgKey;
    /** The meta of ContextMenu (from prior click) when button was clicked */
    meta: Meta<T>;
  }

  interface DownData {
    longDown: boolean;
    screenPoint: Geom.Vect;
    position: import('three').Vector3;
    normal: import('three').Vector3;
    meta: Meta;
    /** Derived from `normal` */
    quaternion: import('three').Quaternion;
  }

  interface ContextMenuLink {
    key: string;
    label: string;
  }

  interface ContextMenuContextDef {
    position: THREE.Vector3;
    meta: Meta;
  }

  /**
   * Assume `parent.meta` has already been updated.
   */
  type ContextMenuMatcher = (parent: import('../world/ContextMenu').State) => {
    showLinks?: ContextMenuLink[];
    hideKeys?: string[];
  };

  interface LoggerLinkEvent {
    /** e.g. link `[rob]` yields `rob` */  
    linkText: string;
    /** Full possibly-wrapped line */  
    fullLine: string;
    /** 0-based */  
    startRow: number;
    /** 0-based */  
    endRow: number;
    /** 1-based (x,y) positions, originally from hover event */
    viewportRange: import("@xterm/xterm").IViewportRange;
  }

}
