declare namespace WW {
  
  //#region nav worker

  type NavWorker = WW.WorkerGeneric<WW.MsgToNavWorker, WW.MsgFromNavWorker>;

  type MsgToNavWorker = (
    | RequestNavMesh
  );

  type MsgFromNavWorker = (
    | NavMeshResponse
  );

  interface RequestNavMesh {
    type: "request-nav";
    mapKey: string;
    offMeshDefs: import('recast-navigation').OffMeshConnectionParams[];
  }

  interface NavMeshResponse {
    type: "nav-mesh-response";
    mapKey: string;
    exportedNavMesh: Uint8Array;
    offMeshLookup: NPC.SrcToOffMeshLookup;
  }
  
  interface BuildTileResponse {
    type: "build-tile-response";
    tileX: number;
    tileY: number;
    navMeshData: Uint8Array;
  }

  //#endregion

  interface NpcDef {
    npcKey: string;
    position: import('three').Vector3Like;
  }

  //#region physics worker

  type PhysicsWorker = WW.WorkerGeneric<WW.MsgToPhysicsWorker, WW.MsgFromPhysicsWorker>;

  type MsgToPhysicsWorker = (
    | AddNPCs
    | AddColliders
    | RemoveBodies
    | RemoveColliders
    | SendNpcPositions
    | SetupPhysicsWorld
    | { type: 'get-debug-data' }
  );

  type MsgFromPhysicsWorker = (
    | WorldSetupResponse
    | NpcCollisionResponse
    | PhysicsDebugDataResponse
  );

  //#region MsgToPhysicsWorker
  interface AddColliders {
    type: 'add-colliders';
    /** Colliders always on ground hence 2D position suffices */
    colliders: (Geom.VectJson & PhysicsBodyGeom & {
      /** For gm decor this is a `decorKey`. */
      colliderKey: string;
      /** Only applicable when `type` is `"rect"` */
      angle?: number;
      userData?: Record<string, any>;
    })[];
  }

  /**
   * Currently array always has length 1.
   * 🚧 Support bulk spawn
   */
  interface AddNPCs {
    type: 'add-npcs';
    npcs: NpcDef[];
  }

  interface RemoveBodies {
    type: 'remove-bodies';
    bodyKeys: WW.PhysicsBodyKey[];
  }

  interface RemoveColliders {
    type: 'remove-colliders';
    colliders: { type: 'circle' | 'rect'; colliderKey: string; }[];
  }

  interface SendNpcPositions {
    type: 'send-npc-positions';
    // 🔔 Float32Array caused issues i.e. decode failed
    positions: Float64Array;
  }

  interface SetupPhysicsWorld {
    type: 'setup-physics';
    mapKey: string;
    npcs: NpcDef[];
  }
  //#endregion

  interface WorldSetupResponse {
    type: 'physics-is-setup';
  }

  interface PhysicsDebugDataResponse {
    type: 'debug-data';
    items: PhysicDebugItem[];
    /** [ux, uy, vx, vy, ...] */
    lines: number[];
  }

  interface PhysicDebugItem {
    parsedKey: PhysicsParsedBodyKey;
    userData: WW.PhysicsUserData;
    position: import('three').Vector3Like;
    enabled: boolean;
  }
  

  /** Each collision pair of bodyKeys should involve one npc, and one non-npc e.g. a door sensor */
  interface NpcCollisionResponse {
    type: 'npc-collisions';
    collisionStart: { npcKey: string; otherKey: PhysicsBodyKey }[];
    collisionEnd: { npcKey: string; otherKey: PhysicsBodyKey }[];
  }

  type PhysicsBodyKey = (
    | `circle ${string}` // custom cylindrical collider
    | `npc ${string}` // npc {npcKey}
    | `nearby ${Geomorph.GmDoorKey}` // door neighbourhood
    | `rect ${string}` // custom cuboid collider (possibly angled)
  );

  type PhysicsParsedBodyKey = (
    | ['npc' | 'circle' | 'rect', string]
    | ['nearby', Geomorph.GmDoorKey]
  );

  type PhysicsBodyGeom = (
    | {
        /** Induces cylinder placed on floor with wall's height.  */
        type: 'circle';
        radius: number;
      }
    | {
        /** Induces cuboid placed on floor with wall's height.  */
        type: 'rect';
        /** x-ordinate */
        width: number;
        /** z-ordinate */
        height: number;
      }
  )

  /**
   * ℹ️ Height is always fixed.
   */
  type PhysicsUserData = BasePhysicsUserData & (
    | { type: 'npc'; radius: number; }
    | { type: 'cylinder'; radius: number; }
    | { type: 'cuboid'; width: number; depth: number; angle: number; }
  );

  interface BasePhysicsUserData {
    bodyKey: WW.PhysicsBodyKey;
    /** This is the numeric hash of `bodyKey` */
    bodyUid: number;
    /** Custom UserData */
    custom?: Record<string, any>;
  }

  //#endregion

  /**
   * https://github.com/microsoft/TypeScript/issues/48396
   */
  interface WorkerGeneric<Receive = any, Send = any, SendError = Send>
    extends Omit<EventTarget, 'addEventListener' | 'removeEventListener'>,
    Omit<AbstractWorker, 'addEventListener'> {
    onmessage: ((this: Worker, ev: MessageEvent<Send>) => any) | null;
    onmessageerror: ((this: Worker, ev: MessageEvent<SendError>) => any) | null;
    postMessage(message: Receive, transfer: Transferable[]): void;
    postMessage(message: Receive, options?: StructuredSerializeOptions): void;
    addEventListener(event: "message", handler: (message: MessageEvent<Send>) => void): void;
    removeEventListener(event: "message", handler: (message: MessageEvent<Send>) => void): void;
    terminate(): void;
    // ...
  }
}
