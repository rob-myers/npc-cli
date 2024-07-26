import { BaseGraph } from "./base-graph";
import { geomorphService } from "../service/geomorph";

/**
 * @extends {BaseGraph<Graph.GmRoomGraphNode, Graph.GmRoomGraphEdgeOpts>}
 */
export class GmRoomGraphClass extends BaseGraph {

  /**
   * `gmNodeOffset[gmId]` is index of 1st node originally from `gmId`
   * @type {number[]}
   */
  gmNodeOffset = [];

  /**
   * @param {number} gmId 
   * @param {number} roomId 
   */
  getNode(gmId, roomId) {
    return this.nodesArray[this.gmNodeOffset[gmId] + roomId];
  }

  /**
   * @param {Graph.GmGraph} gmGraph
   * @param {import("../service/create-gms-data").GmsData} gmsData
   * @returns {Graph.GmRoomGraph}
   */
  static fromGmGraph(gmGraph, gmsData) {
    const graph = new GmRoomGraphClass();

    /** @type {Graph.GmRoomGraphNode[]} */
    const nodes = gmGraph.gms.flatMap((gm, gmId) =>
      gm.rooms.map((_, roomId) => ({
        id: geomorphService.getGmRoomKey(gmId, roomId),
        gmId,
        roomId,
      }))
    );

    // For fast node lookup
    graph.gmNodeOffset = gmGraph.gms.reduce((agg, gm, gmId) => {
      agg[gmId + 1] = agg[gmId] + gm.rooms.length;
      return agg;
    }, /** @type {typeof graph.gmNodeOffset} */ ([0]));

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
              (agg[geomorphService.getGmRoomKey(gmId, otherRoomId)] ??= [[], []])[0].push(
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
            succ[geomorphService.getGmRoomKey(gmId, otherRoomId)] ??= [[], []]
          )[1].push({ gmId, windowId });
        });

        const srcKey = geomorphService.getGmRoomKey(gmId, roomId);
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
            dst: geomorphService.getGmRoomKey(gmId, roomId),
            doors: gmDoorIds,
            windows: gmWindowIds,
          })
        }
      })
    });

    return graph;
  }
}
