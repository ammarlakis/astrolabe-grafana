/**
 * GraphCanvas - React Flow graph visualization
 * Replaces custom SVG from ResourceTree.tsx with react-flow
 */

import React, { useMemo, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionLineType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { K8sResource, K8sEdge } from '../types';
import { GraphNode } from './GraphNode';
import { getLayoutedElements } from '../lib/layout';

interface GraphCanvasProps {
  resources: K8sResource[];
  edges: K8sEdge[];
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    width: 100%;
    height: 100%;
    background: ${theme.colors.background.primary};
  `,
});

const nodeTypes = {
  resource: GraphNode,
};

export const GraphCanvas: React.FC<GraphCanvasProps> = ({ resources, edges: k8sEdges }) => {
  const styles = useStyles2(getStyles);

  // Convert K8s resources to React Flow nodes
  const initialNodes: Node[] = useMemo(() => {
    return resources.map((resource) => ({
      id: resource.uid,
      type: 'resource',
      position: { x: 0, y: 0 }, // Will be set by layout
      data: { resource },
    }));
  }, [resources]);

  // Convert K8s edges to React Flow edges
  const initialEdges: Edge[] = useMemo(() => {
    return k8sEdges.map((edge, idx) => ({
      id: `${edge.from}-${edge.to}-${idx}`,
      source: edge.from,
      target: edge.to,
      type: 'smoothstep',
      animated: edge.type === 'owner',
      label: edge.type,
      style: { stroke: '#888' },
    }));
  }, [k8sEdges]);

  // Apply layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    return getLayoutedElements(initialNodes, initialEdges);
  }, [initialNodes, initialEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Update nodes and edges when resources change
  React.useEffect(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  return (
    <div className={styles.container}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};
