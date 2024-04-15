import { BaseGraph } from "./base-graph";

/**
 * @extends {BaseGraph<Graph.SymbolGraphNode, Graph.SymbolGraphEdgeOpts>}
 */
export class SymbolGraphClass extends BaseGraph {

  /** @param {Graph.SymbolGraphJson} json  */  
  static from(json) {
    return (new SymbolGraphClass).plainFrom(json);
  }

  /**
   * @returns {Graph.SymbolGraphJson}
   */
  json() {
    return {
      nodes: this.nodesArray.slice(),
      edges: this.edgesArray.map(({ src, dst, transform, meta }) => ({
        src: src.id,
        dst: dst.id,
        transform,
        meta,
      })),
    };
  }
  
}
