declare namespace Graph {
  type BaseGraph<T> = import("./base-graph").BaseGraph<T>;

  interface BaseNode {
    /** Identifies the node. */
    id: string;
  }
  interface BaseEdgeOpts {
    src: string;
    dst: string;
  }

  type Edge<Node extends BaseNode = BaseNode, EdgeOpts extends BaseEdgeOpts = BaseEdgeOpts> = Omit<
    EdgeOpts,
    "id" | "src" | "dst"
  > & {
    /** `${src_id}->${dst_id}` */
    id: string;
    src: Node;
    dst: Node;
  };

  interface IGraph<Node extends BaseNode, EdgeOpts extends BaseEdgeOpts> {
    connect(opts: EdgeOpts): { isNew: boolean; edge: Edge<Node, EdgeOpts> | null };
    disconnect(src: Node, dst: Node): boolean;
    removeNode(node: Node): boolean;
    removeNodeById(id: string): boolean;
    disconnectById(edgeid: string): boolean;
    disconnectByIds(srcid: string, dstid: string): boolean;
    reset(): void;
    hasNode(node: Node): boolean;
    isConnected(src: Node, dst: Node): boolean;
    getNodeById(nodeid: string): Node | null;

    plainJson(): GraphJson<Node, EdgeOpts>;
    plainFrom(json: GraphJson<Node, EdgeOpts>): this;
  }

  interface GraphJson<Node extends BaseNode, EdgeOpts extends BaseEdgeOpts> {
    nodes: Node[];
    edges: EdgeOpts[];
  }

  type BaseGraphJson = GraphJson<BaseNode, BaseEdgeOpts>;

  //#region RoomGraph

  interface RoomGraphNodeRoom {
    type: "room";
    /** `room-${roomId} */
    id: string;
    /** Index of `Geomorph.Layout['rooms']` */
    roomId: number;
  }
  interface RoomGraphNodeDoor {
    type: "door";
    /** `door-${doorIndex} */
    id: string;
    /** Index of `Geomorph.Layout['doors']` */
    doorId: number;
  }

  interface RoomGraphNodeWindow {
    type: "window";
    /** `window-${doorIndex} */
    id: string;
    /** Index of `Geomorph.Layout['windows']` */
    windowId: number;
  }

  type RoomGraphNode = RoomGraphNodeRoom | RoomGraphNodeDoor | RoomGraphNodeWindow;

  type RoomGraphNodeConnector = RoomGraphNodeDoor | RoomGraphNodeWindow;

  type RoomGraphEdgeOpts = BaseEdgeOpts;

  type RoomGraphJson = GraphJson<RoomGraphNode, RoomGraphEdgeOpts>;

  // 🚧
  type RoomGraph = import("./room-graph").roomGraphClass;

  //#endregion

  //#region GmGraph

  interface BaseGmGraphNode extends AStarNode {
    /** Index into nodesArray for easy computation of astar.neighbours */
    index: number;
  }

  /** A transformed geomorph */
  interface GmGraphNodeGm extends BaseGmGraphNode {
    type: "gm";
    /** Key of parent geomorph */
    gmKey: Geomorph.GeomorphKey;
    gmId: number;
    /** `gm-${gmKey}-[${transform}]` */
    id: string;
    /** Transform of parent geomorph */
    transform: [number, number, number, number, number, number];

    /** Points to `gm.navPoly[navGroupId]` */
    navGroupId: number;
    /** `gm.navPoly[navGroupId].rect` in world coords */
    rect: Geom.Rect;
  }

  /** A hull door of some transformed geomorph */
  interface GmGraphNodeDoor extends BaseGmGraphNode {
    type: "door";
    /** `door-${gmKey}-[${transform}]-${hullDoorIndex}` */
    id: string;
    /** Key of parent geomorph */
    gmKey: Geomorph.GeomorphKey;
    /** Index of parent geomorph instance in its respective array */
    gmId: number;
    /** Transform of parent geomorph */
    transform: [number, number, number, number, number, number];
    /** Index of `Geomorph.GeomorphData['doors']` */
    doorId: number;
    /** Index of `Geomorph.GeomorphData['hullDoors']` */
    hullDoorId: number;
    /**
     * Is this door's parent geomorph in front of it?
     * That is, is the door's normal facing it's parent?
     */
    gmInFront: boolean;
    /** Direction it faces in world coords */
    direction: null | Geom.Direction;
    /**
     * Does this node connect to another door i.e.
     * establish a connection between two geomorphs?
     */
    sealed: boolean;
  }

  type GmGraphNode = GmGraphNodeGm | GmGraphNodeDoor;

  type GmGraphEdgeOpts = BaseEdgeOpts;

  // 🚧
  type GmGraph = import("./gm-graph").gmGraphClass;

  /** Given a hull door, the respective ids in adjacent geomorph */
  interface GmAdjRoomCtxt {
    adjGmId: number;
    adjRoomId: number;
    adjHullId: number;
    adjDoorId: number;
  }

  interface BaseNavGmTransition {
    srcGmId: number;
    srcRoomId: number;
    srcDoorId: number;
    dstGmId: number;
    dstRoomId: number;
    dstDoorId: number;
  }

  interface NavGmTransition extends BaseNavGmTransition {
    srcHullDoorId: number;
    /**
     * Entrypoint of the hull door from geomorph `srcGmId`,
     * in world coordinates.
     */
    srcDoorEntry: Geom.Vect;

    dstHullDoorId: number;
    /**
     * Entrypoint of the hull door from geomorph `dstGmId`,
     * in world coordinates.
     */
    dstDoorEntry: Geom.Vect;
  }

  /** Indexed by `gmId` */
  type GmRoomsAdjData = {
    [gmId: number]: {
      gmId: number;
      roomIds: number[];
      windowIds: number[];
      closedDoorIds: number[];
    };
  };

  //#endregion

  //#region GmRoomGraph

  interface GmRoomGraphNode {
    /** `g{gmId}-r{roomId}` */
    id: string;
    gmId: number;
    roomId: number;
  }

  interface GmWindowId {
    gmId: number;
    windowId: number;
    // ℹ️ currently don't support hull windows
  }

  interface GmRoomGraphEdgeOpts extends BaseEdgeOpts {
    doors: Geomorph.GmDoorId[];
    windows: GmWindowId[];
  }

  // 🚧
  type GmRoomGraph = import("./gm-room-graph").gmRoomGraphClass;

  //#endregion

  //#region FloorGraph

  /**
   * Based on `Nav.GraphNode`
   */
  interface FloorGraphNodeBase {
    type: "tri";
    /** `tri-${index} */
    id: string;
    /**
     * Index of this node in its parent array,
     * originally `Nav.GraphNode[]`.
     */
    index: number;
    /**
     * `portals[succId]` are the two vertex ids shared with their `succId`th successor.
     * The original representation has an edge-ordering, available as `Array.from(succ.get(thisNode))`.
     * They are ordered w.r.t their index in `vertexIds` (lower to higher).
     */
    portals: number[][];
    vertexIds: number[];
  }

  interface FloorGraphNodeJson extends FloorGraphNodeBase {
    centroid: Geom.VectJson;
  }

  interface FloorGraphNode extends FloorGraphNodeBase, AStarNode {}

  interface AStarNode {
    astar: {
      centroid: Geom.Vect;
      // A* related
      f?: number;
      g?: number;
      h?: number;
      cost: number;
      visited: boolean;
      closed: boolean;
      parent: null | AStarNode;
      neighbours: number[];
    };
  }

  type FloorGraphEdgeOpts = BaseEdgeOpts;

  /** We use Nav.Zone instead. */
  type FloorGraphJson = never;

  // 🚧
  type FloorGraph = import("./floor-graph").floorGraphClass;

  interface NavNodeMeta {
    doorId: number;
    roomId: number;
    nearDoorId?: number;
  }

  // 🚧 remove
  type NavPartition = ({ nodes: Graph.FloorGraphNode[] } & (
    | { key: "door"; doorId: number }
    | { key: "room"; roomId: number }
  ))[];

  interface PfData {
    graph: Graph.FloorGraph;
  }

  /**
   * A path through a `FloorGraph`.
   */
  interface FloorGraphNavPath {
    path: Geom.Vect[];
    /** Aligned to edges of `path` i.e. the nav node ids along each edge. */
    partition: number[][];
    navMetas: FloorGraphNavMeta[];
    /** `[startDoorId, endDoorId]` respectively */
    doorIds: [null | { id: number; hull: boolean }, null | { id: number; hull: boolean }];
    /** Only for vertices where roomId changes, starting from `0` */
    roomIds: { [vertexId: number]: number };
  }

  /**
   * Metadata concerning some point along a path through a `FloorGraph`.
   */
  type FloorGraphNavMeta = {
    /** Pointer into `path` */
    index: number;
  } & ( // | { key: 'decor-collide'; decor: NPC.DecorRef; type: 'enter' | 'exit' | 'start-inside' } // | { key: 'at-door'; currentRoomId: number; doorId: number; hullDoorId: number; otherRoomId: null | number; }
    | { key: "enter-room"; enteredRoomId: number; doorId: number; otherRoomId: null | number }
    | {
        key: "exit-room";
        exitedRoomId: number;
        doorId: number;
        hullDoorId: number;
        otherRoomId: null | number;
      }
    // | { key: 'npcs-collide'; otherNpcKey: string; }
    | { key: "vertex" }
  );

  type NavMetaKey = FloorGraphNavMeta["key"];

  type FloorGraphNavMetaVertex = Extract<Graph.FloorGraphNavMeta, { key: "vertex" }>;

  //#endregion
}
