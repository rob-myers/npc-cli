declare namespace WW {
  
  //#region nav worker
  interface RequestNavMesh {
    type: "request-nav-mesh";
    mapKey: string;
  }

  interface NavMeshResponse {
    type: "nav-mesh-response";
    mapKey: string;
    exportedNavMesh: Uint8Array;
  }

  type MessageToNavWorker = RequestNavMesh;

  type MessageFromNavWorker = NavMeshResponse;

  //#endregion


  //#region physics worker
  interface SetupRapierWorld {
    type: 'setup-rapier-world';
    items: any[]; // 🚧 door circles
  }

  interface ClearRapierWorld {
    type: 'clear-rapier-world';
  }

  interface AddNpcs {
    type: 'add-npcs';
    npcKeys: string[];
  }
  interface RemoveNpcs {
    type: 'remove-npcs';
    npcKeys: string[];
  }

  interface SendNpcPositions {
    type: 'send-npc-positions';
    positions: { npcKey: string; position: Geom.VectJson }[];
  }

  interface WorldSetupResponse {
    type: 'world-is-setup';
  }

  interface NpcCollisionResponse {
    type: 'npc-collisions';
    /** Format `[bodyId1, bodyId2, x, y, z, x', y', z', ...]` (repeated 8s) */
    contactStart: Float32Array;
    /** Format `[bodyId1, bodyId2, bodyId1', bodyId2', ...]` (repeated 4s) */
    collisionStart: Uint16Array;
    /** Format `[bodyId1, bodyId2, bodyId1', bodyId2', ...]` (repeated 4s) */
    collisionEnd: Uint16Array;
  }

  type MessageToPhysicsWorker = (
    | SendNpcPositions
    | SetupRapierWorld
    | AddNpcs
    | RemoveNpcs
    | ClearRapierWorld
  );

  type MessageFromPhysicsWorker = (
    | WorldSetupResponse
    | NpcCollisionResponse
  );

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
