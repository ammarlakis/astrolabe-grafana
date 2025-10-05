/**
 * Graph layout using ELK (Eclipse Layout Kernel)
 * Provides hierarchical DAG layout for Kubernetes resources
 */

import ELK from 'elkjs/lib/elk.bundled.js';
import { Node, Edge } from '@xyflow/react';

const elk = new ELK();

const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.layered.spacing.nodeNodeBetweenLayers': '150',  // More space between layers
  'elk.spacing.nodeNode': '100',  // More space between nodes
  'elk.layered.spacing.edgeNodeBetweenLayers': '80',  // Space for edges
  'elk.spacing.edgeEdge': '20',  // Space between edges
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',  // Better node placement
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',  // Reduce edge crossings
  'elk.edgeRouting': 'ORTHOGONAL',  // Orthogonal routing reduces overlaps
};

export async function getLayoutedElements(nodes: Node[], edges: Edge[]): Promise<{ nodes: Node[]; edges: Edge[] }> {
  // If no nodes, return empty
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const graph = {
    id: 'root',
    layoutOptions: elkOptions,
    children: nodes.map((node) => ({
      id: node.id,
      width: 220,
      height: 120,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  try {
    const layoutedGraph = await elk.layout(graph);

    const layoutedNodes = nodes.map((node) => {
      const layoutedNode = layoutedGraph.children?.find((n) => n.id === node.id);
      return {
        ...node,
        position: {
          x: layoutedNode?.x ?? 0,
          y: layoutedNode?.y ?? 0,
        },
      };
    });

    return { nodes: layoutedNodes, edges };
  } catch (error) {
    console.error('Layout error:', error);
    // Fallback to simple grid layout
    const layoutedNodes = nodes.map((node, idx) => ({
      ...node,
      position: {
        x: (idx % 5) * 250,
        y: Math.floor(idx / 5) * 150,
      },
    }));
    return { nodes: layoutedNodes, edges };
  }
}
