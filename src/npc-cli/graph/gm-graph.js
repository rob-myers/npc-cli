import { Mat, Rect, Vect } from "../geom";
import { BaseGraph, createBaseAstar } from "./base-graph";
import { assertNonNull, removeDups } from "../service/generic";
import { geom, directionChars, isDirectionChar } from "../service/geom";
import { error, warn } from "../service/generic";
import { AStar } from "../pathfinding/AStar";

/**
 * The "Geomorph Graph":
 * - whose nodes are geomorphs or hull doors
 *   - 🔔 technically, there is a node for each disjoint navmesh of a geomorph
 * - where a geomorph is connected to a hull door iff the geomorph has that hull door
 * - where a hull door is connected to another hull door iff they have been identified
 * @extends {BaseGraph<Graph.GmGraphNode, Graph.GmGraphEdgeOpts>}
 */
export class GmGraphClass extends BaseGraph {

  /** @type {Geomorph.LayoutInstance[]}  */
  gms;

  /**
   * Each array is ordered by `node.rect.area` (ascending), so a
   * larger navmesh does not override a smaller one (e.g. 102)
   * @type {{ [gmId: number]: Graph.GmGraphNodeGm[] }}
   */
  gmNodeByGmId;
  /**
   * A gm node needn't see all hull doors in the geomorph e.g. 102
   * @type {{ [gmId: number]: Graph.GmGraphNodeDoor[] }}
   */
  doorNodeByGmId;

  /**
   * World coordinates of entrypoint to hull door nodes.
   * @type {Map<Graph.GmGraphNodeDoor, Geom.Vect>}
   */
  entry;

  /** World component API */
  w = /** @type {Pick<import('../world/World').State, 'door' | 'gmsData' | 'isReady'>}} */ ({
    isReady() { return false; },
  });

  /**
   * Cache for @see {getAdjacentRoomCtxt}
   * 🤔 could precompute?
   * @type {Record<`${number}-${number}`, Graph.GmAdjRoomCtxt | null>}
   */
  adjRoomCtxt = {};

  /**
   * Given world coordinates `(x, y)` then parent `gmId` is:
   * `gmIdGrid[`${Math.floor(x / 600)}-${Math.floor(y / 600)}`]`
   * @type {{ [key in `${number}-${number}`]?: number }}
   */
  gmIdGrid = {};

  /** @param {Geomorph.LayoutInstance[]} gms  */
  constructor(gms) {
    super();
    this.gms = gms;
    this.gmData = gms.reduce((agg, gm) => ({ ...agg, [gm.key]: gm }), {});
    this.entry = new Map;

    this.gmNodeByGmId = gms.reduce((agg, _, gmId) => ({ ...agg, [gmId]: [] }), {});
    this.doorNodeByGmId = gms.reduce((agg, _, gmId) => ({ ...agg, [gmId]: [] }), {});

    this.gms.forEach(({ gridRect: { x: gx, y: gy, right, bottom } }, gmId) => {
      for (let x = Math.floor(gx / gmIdGridDim); x < Math.floor(right / gmIdGridDim); x++)
        for (let y = Math.floor(gy / gmIdGridDim); y < Math.floor(bottom / gmIdGridDim); y++)
          this.gmIdGrid[`${x}-${y}`] = gmId;
    });
  }

  /**
   * 🚧 verify
   * Assume `transform` is non-singular and [±1, ±1, ±1, ±1, x, y]
   * @param {Geomorph.Connector} hullDoor
   * @param {number} hullDoorId
   * @param {[number, number, number, number, number, number]} transform
   * @param {Geomorph.GeomorphKey} gmKey
   * @returns {null | Geom.Direction}
   */
  static computeHullDoorDirection(hullDoor, hullDoorId, transform, gmKey) {
    const { hullDir } = hullDoor.meta;
    if (isDirectionChar(hullDir)) {
      const direction = /** @type {Geom.Direction} */ (directionChars.indexOf(hullDir));
      const ime1 = { x: transform[0], y: transform[1] };
      const ime2 = { x: transform[2], y: transform[3] };
      
      if (ime1.x === 1) {// (1, 0)
        if (ime2.y === 1) // (1, 0, 0, 1)
          return direction;
        if (ime2.y === -1) // (1, 0, 0, -1)
          return geom.getFlippedDirection(direction, 'x');
      } else if (ime1.y === 1) {// (0, 1)
        if (ime2.x === 1) // (0, 1, 1, 0)
          return geom.getFlippedDirection(geom.getDeltaDirection(direction, 2), 'y'); 
        if (ime2.x === -1) // (0, 1, -1, 0)
          return geom.getDeltaDirection(direction, 1);
      } else if (ime1.x === -1) {// (-1, 0)
        if (ime2.y === 1) // (-1, 0, 0, 1)
          return geom.getFlippedDirection(direction, 'y');
        if (ime2.y === -1) // (-1, 0, 0, -1)
          return geom.getDeltaDirection(direction, 2);
      } else if (ime1.y === -1) {// (0, -1)
        if (ime2.x === 1) // (0, -1, 1, 0)
          return geom.getDeltaDirection(direction, 3);
        if (ime2.x === -1) // (0, -1, -1, 0)
          return geom.getFlippedDirection(geom.getDeltaDirection(direction, 3), 'y');
      }
      error(`${gmKey}: hull door ${hullDoorId}: ${hullDir}: failed to parse transform "${transform}"`);
    } else if (!hullDoor.meta.sealed) {
      error(`${gmKey}: unsealed hull door ${hullDoorId}: meta.hullDir "${hullDir}" must be in {n,e,s,w}`);
    }
    return null;
  }

  /**
   * 🚧 split this into two different functions?
   * A geomorph can have multiple 'gm' nodes: one per disjoint navmesh.
   * @param {Geom.VectJson} point
   * @returns {[gmId: number | null, gmNodeId: number | null]} respective 'gm' node is `nodesArray[gmNodeId]`
   */
  findGeomorphIdContaining(point) {
    const gmId = this.gmIdGrid[`${Math.floor(point.x / gmIdGridDim)}-${Math.floor(point.y / gmIdGridDim)}`];
    if (typeof gmId === 'number') {
      const gmNodeId = this.gmNodeByGmId[gmId].find(node => node.rect.contains(point))?.index;
      return [gmId, gmNodeId ?? null];
    } else {
      return [null, null];
    }
  }

  /**
   * Find geomorph edge path using astar.
   * @param {Geom.VectJson} src
   * @param {Geom.VectJson} dst 
   */
  findPath(src, dst) {
    const [srcGmId, srcGmNodeId] = this.findGeomorphIdContaining(src);
    const [dstGmId, dstGmNodeId] = this.findGeomorphIdContaining(dst);
    if (srcGmNodeId === null || dstGmNodeId === null) {
      return null;
    }

    // compute shortest path through gmGraph
    const srcNode = this.nodesArray[srcGmNodeId];
    const dstNode = this.nodesArray[dstGmNodeId];
    const gmPath = AStar.search(this, srcNode, dstNode, (nodes) => {
      nodes[srcNode.index].astar.centroid.copy(src);
      nodes[dstNode.index].astar.centroid.copy(dst);
      // closed hull doors have large cost
      const { byGmId } = this.w.door;
      this.gms.forEach((_, gmId) =>
        this.doorNodeByGmId[gmId].forEach(node => node.astar.cost = byGmId[gmId][node.doorId].open === true ? 1 : 10000)
      );
    });

    // convert gmPath to gmEdges
    // gmPath has form: (gm -> door -> door)+ -> gm
    /** @type {Graph.GmGraphNodeDoor} */ let pre;
    /** @type {Graph.GmGraphNodeDoor} */ let post;
    const gmEdges = /** @type {Graph.NavGmTransition[]} */ ([]);
    for (let i = 1; i < gmPath.length; i += 3) {
      pre = /** @type {Graph.GmGraphNodeDoor} */ (gmPath[i]);
      post = /** @type {Graph.GmGraphNodeDoor} */ (gmPath[i + 1]);
      gmEdges.push({
        srcGmId: pre.gmId,
        srcRoomId: /** @type {number} */ (this.gms[pre.gmId].doors[pre.doorId].roomIds.find(x => x !== null)),
        srcDoorId: pre.doorId,
        srcHullDoorId: pre.hullDoorId,
        srcDoorEntry: this.getDoorEntry(pre),

        dstGmId: post.gmId,
        dstRoomId: /** @type {number} */ (this.gms[post.gmId].doors[post.doorId].roomIds.find(x => x !== null)),
        dstDoorId: post.doorId,
        dstHullDoorId: post.hullDoorId,
        dstDoorEntry: this.getDoorEntry(post),
      });
    }

    return gmEdges;
  }

  /**
   * @param {Geom.VectJson} point
   * @param {boolean} [includeDoors]
   * Technically rooms do not include doors,
   * but sometimes either adjacent room will do.
   * @returns {null | Geomorph.GmRoomId}
   */
  findRoomContaining(point, includeDoors = false) {
    const [gmId] = this.findGeomorphIdContaining(point);
    if (typeof gmId === 'number') {
      const gm = this.gms[gmId];
      const localPoint = gm.inverseMatrix.transformPoint(Vect.from(point));

      // test pixel in w.gmsData[gm.key].hitCtxt
      // 🚧 support `includeDoors`
      const ct = this.w.gmsData[gm.key].hitCtxt;
      const { data: rgba } = ct.getImageData(localPoint.x, localPoint.y, 1, 1, { colorSpace: 'srgb' });
      if (rgba[0] === 0) {// (0, roomId, 255, 1)
        return { gmId, roomId: rgba[1]};
      }
    }
    return null;
  }

  /**
   * @param {Graph.GmGraphNode} node 
   */
  getAdjacentDoor(node) {
    return this.getSuccs(node).find(
      /** @returns {x is Graph.GmGraphNodeDoor} */ x => x.type === 'door'
    ) ?? null;
  }

  /**
   * @param {number} gmId 
   * @param {number} roomId 
   * @param {number} doorId 
   * @param {boolean} [isHullDoor]
   * @returns {Geomorph.GmRoomId | null}
   */
  getAdjacentGmRoom(gmId, roomId, doorId, isHullDoor = this.gms[gmId].isHullDoor(doorId)) {
    if (isHullDoor) {
      const ctxt = this.getAdjacentRoomCtxt(gmId, doorId);
      return ctxt === null ? null : { gmId: ctxt.adjGmId, roomId: ctxt.adjRoomId };
    } else {
      return { gmId, roomId };
    }
  }

  /**
   * 🚧 simplify?
   * Cached because static and e.g. called many times on toggle hull door.
   * @param {number} gmId 
   * @param {number} hullDoorId 
   * @returns {Graph.GmAdjRoomCtxt | null}
   */
  getAdjacentRoomCtxt(gmId, hullDoorId) {
    const cacheKey = /** @type {const} */ (`${gmId}-${hullDoorId}`);
    if (this.adjRoomCtxt[cacheKey]) {
      return this.adjRoomCtxt[cacheKey];
    }

    const gm = this.gms[gmId];
    const doorNodeId = getGmDoorNodeId(gm.key, gm.transform, hullDoorId);
    const doorNode = this.getNodeById(doorNodeId);
    if (!doorNode) {
      console.error(`${GmGraphClass.name}: failed to find hull door node: ${doorNodeId}`);
      return this.adjRoomCtxt[cacheKey] = null;
    }
    const otherDoorNode = /** @type {undefined | Graph.GmGraphNodeDoor} */ (this.getSuccs(doorNode).find(x => x.type === 'door'));
    if (!otherDoorNode) {
      // console.info(`${gmGraphClass.name}: hull door ${doorNodeId} on boundary`);
      return this.adjRoomCtxt[cacheKey] = null;
    }
    // `door` is a hull door and connected to another
    // console.log({otherDoorNode});
    const { gmId: adjGmId, hullDoorId: dstHullDoorId, doorId: adjDoorId } = otherDoorNode;
    const { roomIds } = this.gms[adjGmId].hullDoors[dstHullDoorId];
    const adjRoomId = /** @type {number} */ (roomIds.find(x => typeof x === 'number'));
    
    return this.adjRoomCtxt[cacheKey] = { adjGmId, adjRoomId, adjHullId: dstHullDoorId, adjDoorId };
  }

  /**
   * Get door nodes connecting `gms[gmId]` on side `sideDir`.
   * @param {number} gmId 
   * @param {Geom.Direction} sideDir 
   */
  getConnectedDoorsBySide(gmId, sideDir) {
    return this.doorNodeByGmId[gmId].filter(x => !x.sealed && x.direction === sideDir);
  }

  /**
   * Compute every global room id connected to some door,
   * assuming that identified hull doors are respected.
   * @param {number[][]} gmDoorIds `gmDoorIds[gmId]` contains door ids
   * @returns {Geomorph.GmRoomId[]}
   */
  getGmRoomsIdsFromDoorIds(gmDoorIds) {
    const gmRoomIds = /** @type {Geomorph.GmRoomId[]} */ ([]);
    gmDoorIds.forEach((doorIds, gmId) => {
      const gm = this.gms[gmId];
      const seen = /** @type {Record<number, true>} */ ({});
      doorIds.map(doorId => gm.doors[doorId]).forEach(door => {
        door.roomIds.forEach(roomId =>
          // For hull doors, assume adj{GmId,DoorId} occurs elsewhere
          (roomId !== null) && !seen[roomId] && gmRoomIds.push({ gmId, roomId }) && (seen[roomId] = true)
        )
      });
    });
    return gmRoomIds;
  }

  /**
   * Given ids of rooms in gmGraph, provide "adjacency data".
   * - We do include rooms adjacent via a door or non-frosted window.
   * - We handle dup roomIds e.g. via double doors.
   * - We don't ensure input roomIds are output.
   *   However they're included if they're adjacent to another such input roomId.
   * @param {Geomorph.GmRoomId[]} roomIds
   * @param {boolean} [doorsMustBeOpen]
   * @returns {Graph.GmRoomsAdjData}
   */
  getRoomIdsAdjData(roomIds, doorsMustBeOpen = false) {
    const output = /** @type {Graph.GmRoomsAdjData} */ ({});

    for (const { gmId, roomId } of roomIds) {
      const gm = this.gms[gmId];
      const { roomGraph } = this.w.gmsData[gm.key];

      const openDoorIds = this.w.door.getOpenIds(gmId);
      // Non-hull doors or windows induce an adjacent room
      !output[gmId] && (output[gmId] = { gmId, roomIds: [], windowIds: [], closedDoorIds: [] });
      output[gmId].roomIds.push(...roomGraph.getAdjRoomIds(roomId, doorsMustBeOpen ? openDoorIds : undefined));
      output[gmId].windowIds.push(...roomGraph.getAdjacentWindows(roomId).flatMap(x => gm.windows[x.windowId].meta.frosted ? [] : x.windowId));
      output[gmId].closedDoorIds.push(...roomGraph.getAdjacentDoors(roomId).flatMap(x => openDoorIds.includes(x.doorId) ? [] : x.doorId));
      // Connected hull doors induce room in another geomorph
      // 🚧 check if hull doors are open?
      // 🚧 currently ignore hull windows 
      const hullDoorIds = roomGraph.getAdjacentHullDoorIds(gm, roomId);
      hullDoorIds
        .filter(({ hullDoorId }) => !this.isHullDoorSealed(gmId, hullDoorId))
        .forEach(({ hullDoorId }) => {
          const ctxt = assertNonNull(this.getAdjacentRoomCtxt(gmId, hullDoorId));
          !output[ctxt.adjGmId] && (output[ctxt.adjGmId] = { gmId: ctxt.adjGmId, roomIds: [], windowIds: [], closedDoorIds: [] });
          output[ctxt.adjGmId].roomIds.push(ctxt.adjRoomId);
        });
    }

    Object.values(output).forEach(x => x.roomIds = removeDups(x.roomIds));
    return output;
  }

  /** @param {Graph.GmGraphNodeDoor} doorNode */
  getDoorEntry(doorNode) {
    return /** @type {Geom.Vect} */ (this.entry.get(doorNode));
  }

  /**
   * @param {string} nodeId 
   */
  getDoorNode(nodeId) {
    return /** @type {Graph.GmGraphNodeDoor} */ (this.getNodeById(nodeId));
  }

  /**
   * Get door node by `hullDoorId`.
   * @param {number} gmId 
   * @param {number} hullDoorId 
   */
  getDoorNodeById(gmId, hullDoorId) {
    const gm = this.gms[gmId];
    const nodeId = getGmDoorNodeId(gm.key, gm.transform, hullDoorId);
    return /** @type {Graph.GmGraphNodeDoor} */ (this.getNodeById(nodeId));
  }

  /** @param {Geom.VectJson[]} points */
  inSameRoom(...points) {
    /** @type {null | Geomorph.GmRoomId} */ let gmRoomId;
    return points.every((point, i) => {
      const next = this.findRoomContaining(point);
      if (!next) return false;
      if (i > 0 && (
        /** @type {Geomorph.GmRoomId} */ (gmRoomId).gmId !== next.gmId ||
        /** @type {Geomorph.GmRoomId} */ (gmRoomId).roomId !== next.roomId
      )) {
        return false;
      }
      return gmRoomId = next;
    });
  }

  /**
   * A hull door can be sealed either by definition,
   * or by virtue of its position (leaf node in gmGraph)
   * @param {number} gmId 
   * @param {number} hullDoorId 
   */
  isHullDoorSealed(gmId, hullDoorId) {
    const doorNode = this.getDoorNodeById(gmId, hullDoorId);
    if (doorNode === null) {
      console.warn(`hull door node not found: ${JSON.stringify({ gmId, hullDoorId })}`);
      return true;
    }
    return doorNode.sealed;
  }

  /**
   * @param {Geomorph.LayoutInstance[]} gms 
   * @param {boolean} [permitErrors] used to keep GeomorphEdit stable
   */
  static fromGms(gms, permitErrors = false) {
    const graph = new GmGraphClass(gms);
    /** Index into nodesArray */
    let index = 0;

    /** @type {Graph.GmGraphNode[]} */
    const nodes = [
      /**
       * nodes are NOT aligned to `gms` because a geomorph
       * may contain multiple disjoint navmeshes e.g. 102
       */
      ...gms.flatMap((gm, gmId) =>
        /**
         * 🚧 pre-compute navPolyWithDoors rects and hullDoor intersections
         */
        gm.navRects.map(/** @returns {Graph.GmGraphNodeGm} */ (navRect, navRectId) => ({
          type: 'gm',
          gmKey: gm.key,
          gmId,
          id: getGmNodeId(gm.key, gm.transform, navRectId),
          transform: gm.transform,

          navRectId,
          rect: navRect.applyMatrix(gm.matrix),

          ...createBaseAstar({
            // could change this when starting/ending at a specific geomorph
            centroid: gm.matrix.transformPoint(gm.pngRect.center),
            // neighbours populated further below
          }),
          index: index++,
        }))
      ),

      ...gms.flatMap(({ key: gmKey, hullDoors, matrix, transform, pngRect, doors }, gmId) =>
        hullDoors.map(/** @returns {Graph.GmGraphNodeDoor} */ (hullDoor, hullDoorId) => {
          const alongNormal = hullDoor.center.clone().addScaled(hullDoor.normal, 20);
          const gmInFront = pngRect.contains(alongNormal);
          const direction = this.computeHullDoorDirection(hullDoor, hullDoorId, transform, gmKey);
          return {
            type: 'door',
            gmKey,
            gmId,
            id: getGmDoorNodeId(gmKey, transform, hullDoorId),
            doorId: doors.indexOf(hullDoor),
            hullDoorId,
            transform,
            gmInFront,
            direction,
            sealed: true, // Overwritten below

            ...createBaseAstar({
              centroid: matrix.transformPoint(hullDoor.center.clone()),
              // neighbours populated further below
            }),
            index: index++,
          };
        })
      ),
    ];

    graph.registerNodes(nodes);
    // Compute `graph.entry`
    nodes.forEach(node => {
      if (node.type === 'door') {
        const { matrix, doors } = gms[node.gmId];
        // console.log('->', node);
        const nonNullIndex = doors[node.doorId].roomIds.findIndex(x => x !== null);
        const entry = /** @type {Geom.Vect} */ (doors[node.doorId].entries[nonNullIndex]);
        if (entry) {
          graph.entry.set(node, matrix.transformPoint(entry.clone()));
        } else if (permitErrors) {
          error(`door ${node.doorId} lacks entry`);
        } else {
          throw Error(`${node.gmKey}: door ${node.doorId} lacks entry`);
        }
      }
    });

    graph.nodesArray.forEach(node => // Store for quick lookup
      node.type === 'gm'
        ? graph.gmNodeByGmId[node.gmId].push(node)
        : graph.doorNodeByGmId[node.gmId].push(node)
    );

    // Smaller rects first, otherwise larger overrides (e.g. 102)
    Object.values(graph.gmNodeByGmId).forEach(nodes => nodes.sort(
      (a, b) => a.rect.area < b.rect.area ? -1 : 1
    ));

    // The gm node (gmId, navGroupId) is connected to its door nodes (hull doors it has)
    /** @type {Graph.GmGraphEdgeOpts[]} */
    const localEdges = gms.flatMap(({ key: gmKey, hullDoors, transform }) => {
      return hullDoors.map(({ navRectId }, hullDoorId) => ({
        src: getGmNodeId(gmKey, transform, navRectId),
        dst: getGmDoorNodeId(gmKey, transform, hullDoorId),
      }));
    });
    
    // Each door node is connected to the door node it is identified with (if any)
    const globalEdges = gms.flatMap((srcGm, gmId) => {
      /**
       * Detect geomorphs whose gridRects border current one
       * ℹ️ wasting computation because relation is symmetric
       */
      const adjItems = gms.filter((dstGm, dstGmId) => dstGmId !== gmId && dstGm.gridRect.intersects(srcGm.gridRect));
      // console.info('geomorph to geomorph:', srcGm, '-->', adjItems);
      /**
       * For each hull door, detect any intersection with aligned geomorph hull doors.
       * - We use `door.poly.rect` instead of `door.rect` because we apply a transform to it.
       * - Anecdotally, every hull door will be an axis-aligned rect (unlike non-hull doors).
       */
      const [srcRect, dstRect] = [new Rect, new Rect];
      const [srcMatrix, dstMatrix] = [new Mat, new Mat];

      return srcGm.hullDoors.flatMap((srcDoor, hullDoorId) => {
        const srcDoorNodeId = getGmDoorNodeId(srcGm.key, srcGm.transform, hullDoorId);
        srcMatrix.setMatrixValue(srcGm.transform);
        srcRect.copy(srcDoor.poly.rect.applyMatrix(srcMatrix));

        const gmDoorPairs = adjItems.flatMap(gm => gm.hullDoors.map(door => /** @type {const} */ ([gm, door])));
        const matching = gmDoorPairs.find(([{ transform }, { poly }]) =>
          srcRect.intersects(dstRect.copy(poly.rect.applyMatrix(dstMatrix.setMatrixValue(transform))))
        );
        if (matching !== undefined) {// Two hull doors intersect
          const [dstGm, dstDoor] = matching;
          const dstHullDoorId = dstGm.hullDoors.indexOf(dstDoor);
          // console.info('hull door to hull door:', srcItem, hullDoorId, '==>', dstItem, dstHullDoorId)
          const dstDoorNodeId = getGmDoorNodeId(dstGm.key, dstGm.transform, dstHullDoorId);
          // NOTE door nodes with global edges are not sealed
          graph.getDoorNode(srcDoorNodeId).sealed = false;
          return { src: srcDoorNodeId, dst: dstDoorNodeId };
        } else {
          return [];
        }
      });
    });

    [...localEdges, ...globalEdges].forEach(({ src, dst }) => {
      if (src && dst) {
        graph.connect({ src, dst });
        graph.connect({ src: dst, dst: src });
      }
    });

    // Populate node.astar.neighbours
    graph.edgesArray.forEach(({ src, dst }) =>
      src.astar.neighbours.push(dst.index)
    );

    return graph;
  }

  /**
   * Works because we'll use a dummy instance where `this.gms` empty.
   */
  get ready() {
    return this.gms.length > 0;
  }
}

/**
 * @param {Geomorph.GeomorphKey} gmKey 
 * @param {[number, number, number, number, number, number]} transform 
 * @param {number} navRectId
 */
function getGmNodeId(gmKey, transform, navRectId) {
  return `gm-${gmKey}-[${transform}]--${navRectId}`;
}

/**
 * @param {Geomorph.GeomorphKey} gmKey 
 * @param {[number, number, number, number, number, number]} transform 
 * @param {number} hullDoorId 
 */
function getGmDoorNodeId(gmKey, transform, hullDoorId) {
  return `door-${gmKey}-[${transform}]-${hullDoorId}`;
}

const gmIdGridDim = 600;
