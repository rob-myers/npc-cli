import { BaseGraph, createBaseAstar } from "./base-graph";
import { helper } from "../service/helper";

/**
 * Node keys are `Geomorph.GmRoomKeygm`s e.g. `g0r2`.
 * @extends {BaseGraph<Graph.GmRoomGraphNode, Graph.GmRoomGraphEdgeOpts>}
 */
export class GmRoomGraphClass extends BaseGraph {

  /**
   * @param {Graph.GmGraph} gmGraph
   * @param {import("../service/create-gms-data").GmsData} gmsData
   * @returns {Graph.GmRoomGraph}
   */
  static fromGmGraph(gmGraph, gmsData) {
    const graph = new GmRoomGraphClass();
    /** Index into nodesArray */
    let index = 0;

    /** @type {Graph.GmRoomGraphNode[]} */
    const nodes = gmGraph.gms.flatMap((gm, gmId) =>
      gm.rooms.map((room, roomId) => ({
        id: helper.getGmRoomKey(gmId, roomId),
        gmId,
        roomId,

        ...createBaseAstar({
          // 🚧 center needn't be in non-convex room
          // neighbours populated further below
          centroid: gm.matrix.transformPoint(room.center),
        }),
        index: index++,
      }))
    );

    graph.registerNodes(nodes);
    const { lib } = gmGraph.w;

    // Edges: for fixed gmId
    // Edges: bridging two gmIds (via hull doors)
    gmGraph.gms.forEach((gm, gmId) => {
      gm.rooms.forEach((_, roomId) => {
        const { roomGraph } = gmsData[gm.key];

        const succ = roomGraph.getAdjacentDoors(roomId).reduce(
          (agg, { doorId }) => {
            if (gm.isHullDoor(doorId)) {
              const ctxt = gmGraph.getAdjacentRoomCtxt(gmId, doorId);
              if (ctxt !== null) {
                (agg[ctxt.adjGmRoomKey] ??= [[], []])[0].push(
                  // { gdKey: geomorphService.getGmDoorKey(gmId, doorId), gmId, doorId, other: { gmId: ctxt.adjGmId, doorId: ctxt.adjDoorId } }
                  // { gdKey: geomorphService.getGmDoorKey(gmId, doorId), gmId, doorId }
                  lib.getGmDoorId(gmId, doorId),
                );
              } // ctxt `null` for unconnected hull doors
            } else {
              const otherRoomId = /** @type {number} */ (gm.getOtherRoomId(doorId, roomId));
              (agg[helper.getGmRoomKey(gmId, otherRoomId)] ??= [[], []])[0].push(
                // { gdKey: geomorphService.getGmDoorKey(gmId, doorId), gmId, doorId },
                lib.getGmDoorId(gmId, doorId),
              );
            }
            return agg;
          },
          /** @type {{ [gmRoomId: string]: [Geomorph.GmDoorId[], Graph.GmWindowId[]] }} */ ({}),
        );

        roomGraph.getAdjacentWindows(roomId).forEach(({ windowId }) => {
          const otherRoomId = gm.windows[windowId].roomIds.find(x => x !== roomId);
          typeof otherRoomId === 'number' && (
            succ[helper.getGmRoomKey(gmId, otherRoomId)] ??= [[], []]
          )[1].push({ gmId, windowId });
        });

        const srcKey = helper.getGmRoomKey(gmId, roomId);
        for (const [gmRoomStr, [gmDoorIds, gmWindowIds]] of Object.entries(succ)) {
          const [gmId, roomId] = gmRoomStr.slice(1).split('r').map(Number);
          /**
           * Technically this graph is not symmetric: it is a directed graph but not an undirected graph.
           * In particular, if `src !== dst` are either side of a hull door (two identified doors),
           * then `src --edge1.doors--> dst`, `dst --edge2.doors--> src`,
           * but `edge1.doors !== edge2.doors` (they mention one of the identified doors each).
           *
           * However, modulo door-ordering and hull-door-identification, this graph is symmetric.
           */
          graph.connect({
            src: srcKey,
            dst: helper.getGmRoomKey(gmId, roomId),
            doors: gmDoorIds,
            windows: gmWindowIds,
          })
        }
      })
    });

    // Populate node.astar.neighbours
    graph.edgesArray.forEach(({ src, dst }) =>
      src.astar.neighbours.push(dst.index)
    );

    return graph;
  }

  /**
   * 
   * @param {Geomorph.GmRoomKey} grKey1 
   * @param {Geomorph.GmRoomKey} grKey2 
   */
  sameOrAdjRooms(grKey1, grKey2) {
    if (grKey1 === grKey2) {
      return true;
    }
    const src = /** @type {Graph.GmRoomGraphNode} */ (this.getNodeById(grKey1));
    const dst = /** @type {Graph.GmRoomGraphNode} */ (this.getNodeById(grKey2));
    return this.succ.get(src)?.get(dst) !== undefined;
  }
}
