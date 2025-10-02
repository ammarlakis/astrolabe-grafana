/**
 * Graph layout using ELK (Eclipse Layout Kernel)
 * Provides hierarchical DAG layout for Kubernetes resources
 */

import ELK from 'elkjs/lib/elk.bundled.js';
import { Node, Edge } from 'reactflow';

const elk = new ELK();

const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.layered.spacing.nodeNodeBetweenLayers': '100',
  'elk.spacing.nodeNode': '80',
  'elk.direction': 'RIGHT',
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

/**
 * Synchronous version that returns the input (for immediate rendering)
 * Actual layout will be applied asynchronously
 */
export function getLayoutedElementsSync(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  // Simple grid layout as fallback
  const layoutedNodes = nodes.map((node, idx) => ({
    ...node,
    position: {
      x: (idx % 5) * 250,
      y: Math.floor(idx / 5) * 150,
    },
  }));
  return { nodes: layoutedNodes, edges };
}
