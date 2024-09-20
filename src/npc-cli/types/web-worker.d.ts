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
    type: "request-nav-mesh";
    mapKey: string;
  }

  interface NavMeshResponse {
    type: "nav-mesh-response";
    mapKey: string;
    exportedNavMesh: Uint8Array;
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
    | AddCollider
    | RemoveNPCs
    | SendNpcPositions
    | SetupPhysicsWorld
  );

  type MsgFromPhysicsWorker = (
    | WorldSetupResponse
    | NpcCollisionResponse
  );

  //#region MsgToPhysicsWorker
  interface AddCollider {
    type: 'add-collider';
    colliderKey: string;
    geom: PhysicsBodyGeom;
    /** Colliders always on ground, so 2d suffices */
    position: Geom.VectJson;
  }

  /**
   * Currently array always has length 1.
   * 🚧 Support bulk spawn
   */
  interface AddNPCs {
    type: 'add-npcs';
    npcs: NpcDef[];
  }

  interface RemoveNPCs {
    type: 'remove-npcs';
    npcKeys: string[];
  }

  interface SendNpcPositions {
    type: 'send-npc-positions';
    // 🔔 Float32Array caused issues i.e. decode failed
    positions: Float64Array;
  }

  interface SetupPhysicsWorld {
    type: 'setup-physics-world';
    mapKey: string;
    npcs: NpcDef[];
  }
  //#endregion

  interface WorldSetupResponse {
    type: 'world-is-setup';
  }

  /** Each collision pair of bodyKeys should involve one npc, and one non-npc e.g. a door sensor */
  interface NpcCollisionResponse {
    type: 'npc-collisions';
    collisionStart: { npcKey: string; otherKey: PhysicsBodyKey }[];
    collisionEnd: { npcKey: string; otherKey: PhysicsBodyKey }[];
  }

  type PhysicsBodyKey = (
    | `circle ${string}` // custom cylindrical collider
    | `inside ${Geomorph.GmDoorKey}` // door cuboid
    | `npc ${string}` // npc {npcKey}
    | `nearby ${Geomorph.GmDoorKey}` // door neighbourhood
    | `rect ${string}` // custom cuboid collider (possibly angled)
  );

  type PhysicsBodyGeom = (
    | { type: 'cylinder'; halfHeight: number; radius: number }
    | { type: 'cuboid'; halfDim: [number, number, number]  }
  )

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
    terminate(): void;
    // ...
  }
}
