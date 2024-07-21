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

  type MsgToNavWorker = RequestNavMesh;

  type MsgFromNavWorker = NavMeshResponse;

  //#endregion


  //#region physics worker
  interface SetupRapierWorld {
    type: 'setup-rapier-world';
    mapKey: string;
  }

  interface AddNpcs {
    type: 'add-npcs';
    npcs: { npcKey: string; position: import('three').Vector3Like }[];
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

  /** Each collision pair of bodyKeys should involve one npc, and one non-npc e.g. a door sensor */
  interface NpcCollisionResponse {
    type: 'npc-collisions';
    collisionStart: { npcKey: string; otherKey: string }[];
    collisionEnd: { npcKey: string; otherKey: string }[];
  }

  type MsgToPhysicsWorker = (
    | SendNpcPositions
    | SetupRapierWorld
    | AddNpcs
    | RemoveNpcs
  );

  type MsgFromPhysicsWorker = (
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
