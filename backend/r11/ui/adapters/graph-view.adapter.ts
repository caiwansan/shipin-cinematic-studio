/**
 * r11/ui/adapters/graph-view.adapter.ts
 *
 * Graph View Adapter — 结构视图渲染数据投影
 *
 * 职责：把 StructureViewState 转为渲染器可消费的 layout 数据。
 * 不做布局引擎决策，只提供节点位置 + 边路径的投影数据。
 *
 * Layout strategy: 层级布局（top-down DAG），root 在上，leaf 在下。
 */

import type { StructureViewState, StructureNodeVM, StructureEdgeVM } from "../view-models/structure.vm";

export interface LayoutNode {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  incomingCount: number;
  outgoingCount: number;
  domainId?: string;
  rawSnippet?: string;
}

export interface LayoutEdge {
  from: string;
  to: string;
  type: string;
  /** control points for bezier curve */
  path: Array<{ x: number; y: number }>;
}

export interface GraphRenderData {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

export class GraphViewAdapter {
  private readonly NODE_WIDTH = 140;
  private readonly NODE_HEIGHT = 50;
  private readonly LAYER_GAP_Y = 80;
  private readonly NODE_GAP_X = 40;

  /**
   * Compute topological layers for a DAG.
   * Returns map: nodeId → layer number (0 = root).
   */
  private computeLayers(nodes: StructureNodeVM[], edges: StructureEdgeVM[]): Map<string, number> {
    const layers = new Map<string, number>();
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    for (const n of nodes) {
      layers.set(n.id, 0);
      inDegree.set(n.id, 0);
      adjList.set(n.id, []);
    }

    for (const e of edges) {
      adjList.get(e.from)?.push(e.to);
      inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
    }

    // Kahn's (deterministic)
    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    while (queue.length > 0) {
      queue.sort();
      const id = queue.shift()!;
      const currentLayer = layers.get(id) || 0;

      for (const neighbor of adjList.get(id) || []) {
        const newLayer = Math.max(layers.get(neighbor) || 0, currentLayer + 1);
        layers.set(neighbor, newLayer);

        const deg = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, deg);
        if (deg === 0) queue.push(neighbor);
      }
    }

    return layers;
  }

  /**
   * Project StructureViewState to render-ready layout data.
   */
  project(state: StructureViewState): GraphRenderData {
    const layers = this.computeLayers(state.nodes, state.edges);

    // Group nodes by layer
    const layerGroups = new Map<number, StructureNodeVM[]>();
    for (const node of state.nodes) {
      const layer = layers.get(node.id) || 0;
      const group = layerGroups.get(layer) || [];
      group.push(node);
      layerGroups.set(layer, group);
    }

    const maxLayer = Math.max(...Array.from(layerGroups.keys()), 0);
    const maxNodesInLayer = Math.max(
      ...Array.from(layerGroups.values()).map((g) => g.length),
      1
    );

    const width = maxNodesInLayer * (this.NODE_WIDTH + this.NODE_GAP_X) + this.NODE_GAP_X;
    const height = (maxLayer + 1) * (this.NODE_HEIGHT + this.LAYER_GAP_Y) + this.LAYER_GAP_Y;

    // Position nodes
    const nodePositions = new Map<string, { x: number; y: number }>();

    for (const [layer, group] of layerGroups) {
      // Sort group for deterministic ordering
      group.sort((a, b) => a.id.localeCompare(b.id));

      const totalWidth = group.length * this.NODE_WIDTH + (group.length - 1) * this.NODE_GAP_X;
      const startX = (width - totalWidth) / 2;

      group.forEach((node, i) => {
        nodePositions.set(node.id, {
          x: startX + i * (this.NODE_WIDTH + this.NODE_GAP_X),
          y: this.LAYER_GAP_Y + layer * (this.NODE_HEIGHT + this.LAYER_GAP_Y),
        });
      });
    }

    // Build layout nodes
    const layoutNodes: LayoutNode[] = state.nodes.map((n) => {
      const pos = nodePositions.get(n.id) || { x: 0, y: 0 };
      return {
        id: n.id,
        type: n.type,
        x: pos.x,
        y: pos.y,
        width: this.NODE_WIDTH,
        height: this.NODE_HEIGHT,
        incomingCount: n.incomingEdges,
        outgoingCount: n.outgoingEdges,
        domainId: n.domainId,
        rawSnippet: n.rawSnippet,
      };
    });

    // Build layout edges with bezier paths
    const layoutEdges: LayoutEdge[] = state.edges.map((e) => {
      const fromPos = nodePositions.get(e.from) || { x: 0, y: 0 };
      const toPos = nodePositions.get(e.to) || { x: 0, y: 0 };

      const fromX = fromPos.x + this.NODE_WIDTH / 2;
      const fromY = fromPos.y + this.NODE_HEIGHT;
      const toX = toPos.x + this.NODE_WIDTH / 2;
      const toY = toPos.y;

      // Simple bezier control point
      const midY = (fromY + toY) / 2;

      return {
        from: e.from,
        to: e.to,
        type: e.type,
        path: [
          { x: fromX, y: fromY },
          { x: fromX, y: midY },
          { x: toX, y: midY },
          { x: toX, y: toY },
        ],
      };
    });

    return {
      nodes: layoutNodes,
      edges: layoutEdges,
      width,
      height,
    };
  }
}
