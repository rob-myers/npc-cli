import { keys } from "../service/generic";
import { BaseGraph } from "./base-graph";

/**
 * - Node id is respective `SymbolKey`.
 * @extends {BaseGraph<Graph.SymbolGraphNode, Graph.SymbolGraphEdgeOpts>}
 */
export class SymbolGraphClass extends BaseGraph {

  /** @param {Graph.SymbolGraphJson | Geomorph.AssetsJson['symbols']} input  */  
  static from(input) {
    if ('nodes' in input) {
      return (new SymbolGraphClass()).plainFrom(input);
    } else {
      const symbols = input;
      const graph = new SymbolGraphClass();
      keys(symbols).forEach(symbolKey => graph.registerNode({ id: symbolKey }));
      Object.values(symbols).forEach(({ key: symbolKey, symbols: subSymbols }) => {
        subSymbols.forEach(({ symbolKey: subSymbolKey, transform, meta }) => {
          graph.registerEdge({ src: symbolKey, dst: subSymbolKey, transform, meta });
        });
      });
      return graph;
    }
  }

  /**
   * @returns {Graph.SymbolGraphJson}
   */
  json() {
    return {
      size: "20,20",
      rankdir: "LR",
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
