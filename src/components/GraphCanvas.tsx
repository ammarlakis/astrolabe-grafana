/**
 * GraphCanvas - React Flow graph visualization
 * Replaces custom SVG from ResourceTree.tsx with react-flow
 */

import React, { useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { K8sResource, K8sEdge, ResourceAttachments, ExpansionState, Kind } from '../types';
import { GraphNode } from './GraphNode';
import { getLaneLayoutedElements } from '../lib/laneLayout';
import { SmartBezierEdge } from '@tisoap/react-flow-smart-edge';

interface GraphCanvasProps {
  resources: K8sResource[];
  edges: K8sEdge[];
  attachmentsMap: Map<string, ResourceAttachments>;
  expansionState: ExpansionState;
  onToggleAttachment: (resourceUid: string, type: Kind) => void;
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    width: 100%;
    height: 100%;
    background: ${theme.colors.background.primary};
  `,
});

const edgeTypes = {
  smartBezier: SmartBezierEdge,   // smooth, curved, obstacle-avoiding
};

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  resources,
  edges: k8sEdges,
  attachmentsMap,
  expansionState,
  onToggleAttachment,
}) => {
  const styles = useStyles2(getStyles);
  const nodeTypes = useMemo(() => ({ resource: GraphNode }), []);

  // Convert K8s resources to React Flow nodes
  const initialNodes: Node[] = useMemo(() => {
    return resources.map((resource) => {
      const attachments = attachmentsMap.get(resource.uid);
      return {
        id: resource.uid,
        type: 'resource',
        position: { x: 0, y: 0 }, // Will be set by layout
        data: {
          resource,
          attachments,
          expandedAttachments: expansionState.get(resource.uid),
          onToggleAttachment: (type: Kind) => {
            onToggleAttachment(resource.uid, type);
          },
        },
      };
    });
  }, [resources, attachmentsMap, expansionState, onToggleAttachment]);

  // Convert K8s edges to React Flow edges
  const initialEdges: Edge[] = useMemo(() => {
    // Validate edge UIDs match node UIDs
    const nodeIds = new Set(resources.map(r => r.uid));
    const validEdges = k8sEdges.filter(edge => {
      const valid = nodeIds.has(edge.from) && nodeIds.has(edge.to);
      if (!valid) {
        console.warn('Invalid edge - UIDs not found:', edge);
      }
      return valid;
    });

    return validEdges.map((edge, idx) => {
      // Network traffic edges should be animated (ingress → service → endpoints → pods)
      const isNetworkTraffic = edge.type === 'selects' || edge.type === 'backs';
      // Ownership edges should be solid, not animated
      const isOwnership = edge.type === 'owner';

      const edgeColor = isOwnership ? '#4a90e2' : isNetworkTraffic ? '#52c41a' : '#888';

      return {
        id: `${edge.from}-${edge.to}-${idx}`,
        source: edge.from,
        target: edge.to,
        animated: isNetworkTraffic,
        label: edge.type,
        style: {
          stroke: edgeColor,
          strokeWidth: isOwnership ? 2 : 1.5,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
        },
        // Smart edge options
        data: {
          options: {
            drawEdge: true,
            nodePadding: 10,
          },
        },
      };
    });
  }, [k8sEdges, resources]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Apply layout asynchronously
  React.useEffect(() => {
    const applyLayout = async () => {
      if (initialNodes.length === 0) {
        setNodes([]);
        setEdges([]);
        return;
      }

      const { nodes: layoutedNodes, edges: layoutedEdges } = await getLaneLayoutedElements(
        initialNodes,
        initialEdges
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    };

    applyLayout();
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Count valid edges
  const nodeIds = new Set(resources.map(r => r.uid));
  const validEdgeCount = k8sEdges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to)).length;

  return (
    <div className={styles.container}>
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '8px', borderRadius: '4px', fontSize: '12px' }}>
        Nodes: {nodes.length} | Edges: {edges.length} | Input: {k8sEdges.length} | Valid: {validEdgeCount}
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{
          hideAttribution: true,
        }}
        nodesFocusable={true}
        elementsSelectable={true}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smartBezier',
        }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};
