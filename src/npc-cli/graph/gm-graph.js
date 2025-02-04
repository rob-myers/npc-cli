import { Mat, Rect, Vect } from "../geom";
import { BaseGraph, createBaseAstar } from "./base-graph";
import { sguToWorldScale } from "../service/const";
import { assertNonNull, removeDups } from "../service/generic";
import { geom, directionChars, isDirectionChar } from "../service/geom";
import { error, warn } from "../service/generic";
import { helper } from "../service/helper";
import { AStar } from "../pathfinding/AStar";

/**
 * The _Geomorph Graph_,
 * - where each hull door yields a node
 * - where each navigation mesh in a geomorph yields a node (often one-per-geomorph)
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
  w = /** @type {import('../world/World').State}} */ ({});

  /**
   * Cache for @see {getAdjacentRoomCtxt}
   * 🤔 could precompute?
   * @type {Map<`${number}-${number}`, Graph.GmAdjRoomCtxt | null>}
   */
  adjRoomCtxt = new Map();

  /**
   * Given world coordinates `(x, y)` then parent `gmId` is:
   * `gmIdGrid[`${Math.floor(x / 600)}-${Math.floor(y / 600)}`]`
   * @type {Map<`${number}-${number}`, number>}
   */
  gmIdGrid = new Map();

  /** @param {Geomorph.LayoutInstance[]} gms  */
  constructor(gms) {
    super();
    this.gms = gms.slice();
    this.entry = new Map();

    this.gmNodeByGmId = gms.reduce((agg, _, gmId) => ({ ...agg, [gmId]: [] }), {});
    this.doorNodeByGmId = gms.reduce((agg, _, gmId) => ({ ...agg, [gmId]: [] }), {});

    this.gms.forEach(({ gridRect: { x: gx, y: gy, right, bottom } }, gmId) => {
      for (let x = Math.floor(gx / gmIdGridDim); x < Math.floor(right / gmIdGridDim); x++)
        for (let y = Math.floor(gy / gmIdGridDim); y < Math.floor(bottom / gmIdGridDim); y++)
          this.gmIdGrid.set(`${x}-${y}`, gmId);
    });
  }

  /**
   * Assume `transform` is non-singular and [±1, ±1, ±1, ±1, x, y]
   * @param {Geomorph.Connector} hullDoor
   * @param {number} hullDoorId
   * @param {[number, number, number, number, number, number]} transform
   * @param {Geomorph.GeomorphKey} gmKey
   * @returns {null | Geom.DirectionString}
   */
  static computeHullDoorDirection(hullDoor, hullDoorId, transform, gmKey) {
    const { edge: hullDir } = /** @type {Geomorph.HullDoorMeta} */ (hullDoor.meta);
    if (isDirectionChar(hullDir)) {
      const direction = /** @type {Geom.Direction} */ (directionChars.indexOf(hullDir));
      const ime1 = { x: transform[0], y: transform[1] };
      const ime2 = { x: transform[2], y: transform[3] };
      
      if (ime1.x === 1) {// (1, 0)
        if (ime2.y === 1) // (1, 0, 0, 1)
          return hullDir;
        if (ime2.y === -1) // (1, 0, 0, -1)
          return directionChars[geom.getFlippedDirection(direction, 'x')];
      } else if (ime1.y === 1) {// (0, 1)
        if (ime2.x === 1) // (0, 1, 1, 0)
          return directionChars[geom.getFlippedDirection(geom.getDeltaDirection(direction, 2), 'y')]; 
        if (ime2.x === -1) // (0, 1, -1, 0)
          return directionChars[geom.getDeltaDirection(direction, 1)];
      } else if (ime1.x === -1) {// (-1, 0)
        if (ime2.y === 1) // (-1, 0, 0, 1)
          return directionChars[geom.getFlippedDirection(direction, 'y')];
        if (ime2.y === -1) // (-1, 0, 0, -1)
          return directionChars[geom.getDeltaDirection(direction, 2)];
      } else if (ime1.y === -1) {// (0, -1)
        if (ime2.x === 1) // (0, -1, 1, 0)
          return directionChars[geom.getDeltaDirection(direction, 3)];
        if (ime2.x === -1) // (0, -1, -1, 0)
          return directionChars[geom.getFlippedDirection(geom.getDeltaDirection(direction, 3), 'y')];
      }
      error(`${gmKey}: hull door ${hullDoorId}: ${hullDir}: failed to parse transform "${transform}"`);
    } else if (!hullDoor.meta.sealed) {
      error(`${gmKey}: unsealed hull door ${hullDoorId}: meta.hullDir "${hullDir}" must be in {n,e,s,w}`);
    }
    return null;
  }

  dispose() {
    super.dispose();
    this.gms.length = 0;
    this.entry.clear();
    this.w = /** @type {*} */ ({});
    this.adjRoomCtxt.clear();
    this.gmIdGrid.clear();
  }

  /**
   * @param {Geom.VectJson} point
   * @returns {number | null} gmId
   */
  findGmIdContaining(point) {
    return this.gmIdGrid.get(`${Math.floor(point.x / gmIdGridDim)}-${Math.floor(point.y / gmIdGridDim)}`) ?? null;
  }
  
  /**
   * @param {Geom.VectJson} point
   * @param {number} [gmId]
   * @returns {number | null} gmNodeId
   */
  findGmNodeIdContaining(point, gmId = this.findGmIdContaining(point) ?? undefined) {
    if (typeof gmId === 'number') {
      const gmNodeId = this.gmNodeByGmId[gmId].find(node => node.rect.contains(point))?.index;
      return gmNodeId ?? null;
    } else {
      return null;
    }
  }

  /**
   * Find geomorph edge path using astar.
   * @param {Geom.VectJson} src
   * @param {Geom.VectJson} dst 
   */
  findPath(src, dst) {
    const srcGmNodeId = this.findGmNodeIdContaining(src);
    const dstGmNodeId = this.findGmNodeIdContaining(dst);
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
        srcDoorEntry: /** @type {Geom.Vect} */ (this.entry.get(pre)),

        dstGmId: post.gmId,
        dstRoomId: /** @type {number} */ (this.gms[post.gmId].doors[post.doorId].roomIds.find(x => x !== null)),
        dstDoorId: post.doorId,
        dstHullDoorId: post.hullDoorId,
        dstDoorEntry: /** @type {Geom.Vect} */ (this.entry.get(post)),
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
    const gmId = this.findGmIdContaining(point);
    if (typeof gmId === 'number') {
      const gm = this.gms[gmId];
      const localPoint = gm.inverseMatrix.transformPoint(Vect.from(point));
      const roomId = this.w.gmsData.findRoomIdContaining(gm, localPoint, includeDoors);
      return roomId === null ? null : { gmId, roomId, grKey: helper.getGmRoomKey(gmId, roomId) };
    } else {
      return null;
    }
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
   * Cached because static and e.g. called many times on toggle hull door.
   * @param {number} gmId 
   * @param {number} hullDoorId 
   * @returns {Graph.GmAdjRoomCtxt | null}
   */
  getAdjacentRoomCtxt(gmId, hullDoorId) {
    const cacheKey = /** @type {const} */ (`${gmId}-${hullDoorId}`);
    let cached = this.adjRoomCtxt.get(cacheKey);
    if (cached != null) {
      return cached;
    }

    const gm = this.gms[gmId];
    const doorNodeId = getGmDoorNodeId(gm.num, gm.transform, hullDoorId);
    const doorNode = this.getNodeById(doorNodeId);
    if (!doorNode) {
      console.error(`${GmGraphClass.name}: failed to find hull door node: ${doorNodeId}`);
      return this.adjRoomCtxt.set(cacheKey, null), null;
    }
    const otherDoorNode = /** @type {undefined | Graph.GmGraphNodeDoor} */ (this.getSuccs(doorNode).find(x => x.type === 'door'));
    if (!otherDoorNode) {
      // console.info(`${gmGraphClass.name}: hull door ${doorNodeId} on boundary`);
      return this.adjRoomCtxt.set(cacheKey, null), null;
    }
    // `door` is a hull door and connected to another
    // console.log({otherDoorNode});
    const { gmId: adjGmId, hullDoorId: dstHullDoorId, doorId: adjDoorId } = otherDoorNode;
    const { roomIds } = this.gms[adjGmId].hullDoors[dstHullDoorId];
    const adjRoomId = /** @type {number} */ (roomIds.find(x => typeof x === 'number'));
    const adjGmRoomKey = helper.getGmRoomKey(adjGmId, adjRoomId);

    cached = { adjGmId, adjRoomId, adjHullId: dstHullDoorId, adjDoorId, adjGmRoomKey }
    return this.adjRoomCtxt.set(cacheKey, cached), cached;
  }

  /**
   * Get door nodes connecting `gms[gmId]` on side `sideDir`.
   * @param {number} gmId 
   * @param {Geom.DirectionString} sideDir 
   */
  getConnectedDoorsBySide(gmId, sideDir) {
    return this.doorNodeByGmId[gmId].filter(x => !x.sealed && x.direction === sideDir);
  }

  /**
   * Get GmRoomId on other side of door,
   * assuming `roomId` in `door.door.roomIds`.
   * 🤔 could cache
   * @param {Geomorph.DoorState} door 
   * @param {number} roomId 
   * @returns {Geomorph.GmRoomId | null}
   */
  getOtherGmRoomId(door, roomId) {
    if (door.hull === false) {
      const otherRoomId = door.door.roomIds.find(x => x !== roomId) ?? null;
      return otherRoomId === null ? null : this.w.lib.getGmRoomId(door.gmId, otherRoomId);
    } else {
      const adj = this.getAdjacentRoomCtxt(door.gmId, door.doorId);
      return adj === null ? null : this.w.lib.getGmRoomId(adj.adjGmId, adj.adjRoomId);
    }
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

  /**
   * Get door node by `hullDoorId`.
   * @param {number} gmId 
   * @param {number} hullDoorId 
   */
  getDoorNodeById(gmId, hullDoorId) {
    const gm = this.gms[gmId];
    const nodeId = getGmDoorNodeId(gm.num, gm.transform, hullDoorId);
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
   * Is `point` on other side of door to `roomId`?
   * We assume `roomId` is in `door.door.roomIds`.
   * 🤔 could cache
   * @param {Geomorph.DoorState} door 
   * @param {number} roomId 
   * @param {Geom.VectJson} point
   * @returns {boolean}
   */
  isOnOtherSide(door, roomId, point) {
    const dp = (
        (point.x - door.src.x) * door.normal.x
      + (point.y - door.src.y) * door.normal.y
    );
    if (door.hull === false) {// normal points towards roomIds[0]
      const index = door.door.roomIds.indexOf(roomId); // 0 or 1
      return dp * (index === 0 ? 1 : -1) < 0;
    } else {// hull door normals always point outwards
      return dp > 0;
    }
  }

  /**
   * @param {Geomorph.LayoutInstance[]} gms 
   * @param {object} [options]
   * @param {boolean} [options.permitErrors]
   */
  static fromGms(gms, { permitErrors } = { permitErrors: false }) {
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
        // 🚧 pre-compute navPolyWithDoors rects and hullDoor intersections
        gm.navRects.map(/** @returns {Graph.GmGraphNodeGm} */ (navRect, navRectId) => ({
          type: 'gm',
          gmKey: gm.key,
          gmId,
          id: getGmNodeId(gm.num, gm.transform, navRectId),
          transform: gm.transform,

          navRectId,
          rect: navRect.clone().applyMatrix(gm.matrix),

          ...createBaseAstar({
            // neighbours populated further below
            centroid: gm.matrix.transformPoint(gm.pngRect.center),
          }),
          index: index++,
        }))
      ),

      ...gms.flatMap(({ key: gmKey, num: gmNum, hullDoors, matrix, transform, pngRect, doors }, gmId) =>
        hullDoors.map(/** @returns {Graph.GmGraphNodeDoor} */ (hullDoor, hullDoorId) => {
          const alongNormal = hullDoor.center.clone().addScaled(hullDoor.normal, 20);
          const gmInFront = pngRect.contains(alongNormal);
          const direction = this.computeHullDoorDirection(hullDoor, hullDoorId, transform, gmKey);
          return {
            type: 'door',
            gmKey,
            gmId,
            id: getGmDoorNodeId(gmNum, transform, hullDoorId),
            doorId: doors.indexOf(hullDoor),
            hullDoorId,
            transform,
            gmInFront,
            direction, // 🚧 verify values
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
    const localEdges = gms.flatMap(({ key: gmKey, num: gmNum, hullDoors, transform }) => {
      return hullDoors.map(({ navRectId }, hullDoorId) => ({
        src: getGmNodeId(gmNum, transform, navRectId),
        dst: getGmDoorNodeId(gmNum, transform, hullDoorId),
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
        const srcDoorNodeId = getGmDoorNodeId(srcGm.num, srcGm.transform, hullDoorId);
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
          const dstDoorNodeId = getGmDoorNodeId(dstGm.num, dstGm.transform, dstHullDoorId);
          // NOTE door nodes with global edges are not sealed
          /** @type {Graph.GmGraphNodeDoor} */ (graph.getNodeById(srcDoorNodeId)).sealed = false;
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
 * @param {Geomorph.GeomorphNumber} gmNumber 
 * @param {[number, number, number, number, number, number]} transform 
 * @param {number} navRectId
 */
function getGmNodeId(gmNumber, transform, navRectId) {
  return `gm-${gmNumber}-[${transform}]--${navRectId}`;
}

/**
 * @param {Geomorph.GeomorphNumber} gmNumber 
 * @param {[number, number, number, number, number, number]} transform 
 * @param {number} hullDoorId 
 */
function getGmDoorNodeId(gmNumber, transform, hullDoorId) {
  return `door-${gmNumber}-[${transform}]--${hullDoorId}`;
}

const gmIdGridDim = 600 * sguToWorldScale;
