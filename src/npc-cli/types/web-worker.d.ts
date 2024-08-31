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
    | SendNpcPositions
    | SetupPhysicsWorld
    | AddNPCs
    | RemoveNPCs
  );

  type MsgFromPhysicsWorker = (
    | WorldSetupResponse
    | NpcCollisionResponse
  );

  interface SetupPhysicsWorld {
    type: 'setup-physics-world';
    mapKey: string;
    npcs: NpcDef[];
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
    | `npc ${string}` // npc {npcKey}
    | `nearby ${Geomorph.GmDoorKey}` // door neighbourhood
    | `inside ${Geomorph.GmDoorKey}` // door cuboid
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
    extends EventTarget,
      AbstractWorker {
    onmessage: ((this: Worker, ev: MessageEvent<Send>) => any) | null;
    onmessageerror: ((this: Worker, ev: MessageEvent<SendError>) => any) | null;
    postMessage(message: Receive, transfer: Transferable[]): void;
    postMessage(message: Receive, options?: StructuredSerializeOptions): void;
    addEventListener(event: "message", handler: (message: MessageEvent<Send>) => void);
    terminate(): void;
    // ...
  }
}
