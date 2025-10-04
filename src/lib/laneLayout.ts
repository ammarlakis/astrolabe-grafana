/**
 * Lane-based layout for Kubernetes resources
 * Implements a deterministic L→R flow: Ingress → Service → Workload → Pods
 * with attachments (ConfigMap, Secret, PVC, etc.) as side-bands
 */

import { Node, Edge } from 'reactflow';
import { K8sResource } from '../types';

// Lane definitions (left to right)
const LANES = {
  INGRESS: 1,        // Ingress, Gateway, VirtualService
  SERVICE: 2,        // Service (all types)
  CONTROLLER: 3,     // Deployment, StatefulSet, DaemonSet, CronJob
  EPHEMERAL: 4,      // ReplicaSet, Job
  POD: 5,            // Pods
  ATTACHMENT: 6,     // ConfigMap, Secret, PVC, etc. (side-band)
  ORPHAN: 0,         // Disconnected resources
} as const;

// Node dimensions
const NODE_WIDTH = 220;
const NODE_HEIGHT = 100;
const LANE_WIDTH = 300;
const VERTICAL_SPACING = 150;
const ATTACHMENT_OFFSET = 280; // Offset for side-band attachments

/**
 * Determine which lane a resource belongs to
 */
function getLane(resource: K8sResource): number {
  const kind = resource.kind.toLowerCase();
  
  // Lane 1: Entry / L7
  if (kind === 'ingress' || kind === 'gateway' || kind === 'virtualservice') {
    return LANES.INGRESS;
  }
  
  // Lane 2: Service / L4
  if (kind === 'service') {
    return LANES.SERVICE;
  }
  
  // Lane 3: Workload Controllers
  if (['deployment', 'statefulset', 'daemonset', 'cronjob'].includes(kind)) {
    return LANES.CONTROLLER;
  }
  
  // Lane 4: Ephemeral Workload
  if (kind === 'replicaset' || kind === 'job') {
    return LANES.EPHEMERAL;
  }
  
  // Lane 5: Pods
  if (kind === 'pod') {
    return LANES.POD;
  }
  
  // Lane 6: Attachments (side-band)
  if (['configmap', 'secret', 'serviceaccount', 'persistentvolumeclaim', 
       'persistentvolume', 'storageclass', 'horizontalpodautoscaler', 
       'poddisruptionbudget', 'networkpolicy', 'endpointslice',
       'role', 'rolebinding', 'clusterrole', 'clusterrolebinding'].includes(kind)) {
    return LANES.ATTACHMENT;
  }
  
  // Default: orphan
  return LANES.ORPHAN;
}

/**
 * Find the anchor node for an attachment
 * (the Pod or Controller it's attached to)
 */
function findAnchor(attachmentId: string, edges: Edge[], nodes: Node[]): Node | null {
  // Find edges where attachment is the target (e.g., Pod → ConfigMap)
  // The edge direction is: source (Pod/Controller) → target (Attachment)
  const incomingEdges = edges.filter(e => e.target === attachmentId);
  
  for (const edge of incomingEdges) {
    const sourceNode = nodes.find(n => n.id === edge.source);
    if (sourceNode && sourceNode.position) {
      const resource = sourceNode.data.resource as K8sResource;
      const lane = getLane(resource);
      // Anchor should be in main flow (Pod or Controller)
      if (lane === LANES.POD || lane === LANES.CONTROLLER || lane === LANES.EPHEMERAL) {
        return sourceNode;
      }
    }
  }
  
  return null;
}

/**
 * Group nodes by lane and sort within each lane
 */
function groupByLane(nodes: Node[], edges: Edge[]): Map<number, Node[]> {
  const laneGroups = new Map<number, Node[]>();
  
  for (const node of nodes) {
    const resource = node.data.resource as K8sResource;
    const lane = getLane(resource);
    
    // Don't move main flow resources to orphan lane even if unconnected
    // Only move attachments (ConfigMap, Secret, etc.) if they're orphaned
    // Main flow: Ingress, Service, Deployment, ReplicaSet, Pod, Job, etc.
    
    if (!laneGroups.has(lane)) {
      laneGroups.set(lane, []);
    }
    laneGroups.get(lane)!.push(node);
  }
  
  // Sort within each lane by namespace, then name
  Array.from(laneGroups.entries()).forEach(([lane, laneNodes]) => {
    laneNodes.sort((a, b) => {
      const resA = a.data.resource as K8sResource;
      const resB = b.data.resource as K8sResource;
      
      // Sort by namespace first
      const nsCompare = (resA.namespace || '').localeCompare(resB.namespace || '');
      if (nsCompare !== 0) {
        return nsCompare;
      }

      // Then by name
      return resA.name.localeCompare(resB.name);
    });
  });
  
  return laneGroups;
}

/**
 * Layout nodes in lanes with attachments as side-bands
 */
export async function getLaneLayoutedElements(
  nodes: Node[],
  edges: Edge[]
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  if (nodes.length === 0) {
    return { nodes: [], edges: [] };
  }
  
  const laneGroups = groupByLane(nodes, edges);
  const layoutedNodes: Node[] = [];
  
  // Track Y positions for each lane
  const laneYPositions = new Map<number, number>();
  
  // Start Y position (leave space at top for orphans)
  const startY = 50;
  
  // Layout main flow lanes (1-5)
  for (let lane = LANES.ORPHAN; lane <= LANES.POD; lane++) {
    const laneNodes = laneGroups.get(lane) || [];
    let y = lane === LANES.ORPHAN ? 0 : startY;
    
    for (const node of laneNodes) {
      layoutedNodes.push({
        ...node,
        position: {
          x: lane * LANE_WIDTH,
          y: y,
        },
      });
      
      y += NODE_HEIGHT + VERTICAL_SPACING;
    }
    
    laneYPositions.set(lane, y);
  }
  
  // Layout attachments (side-band) next to their anchors
  const attachmentNodes = laneGroups.get(LANES.ATTACHMENT) || [];
  const attachmentYOffsets = new Map<string, number>(); // Track Y offset per anchor
  
  // Helper to check if a position overlaps with existing nodes
  const hasOverlap = (x: number, y: number): boolean => {
    return layoutedNodes.some(node => {
      const dx = Math.abs(node.position.x - x);
      const dy = Math.abs(node.position.y - y);
      // Check if nodes are close enough to overlap
      return dx < NODE_WIDTH + 50 && dy < NODE_HEIGHT + 50;
    });
  };
  
  for (const attachmentNode of attachmentNodes) {
    const anchor = findAnchor(attachmentNode.id, edges, layoutedNodes);
    
    if (anchor) {
      // Place attachment to the right of its anchor
      const anchorResource = anchor.data.resource as K8sResource;
      const anchorLane = getLane(anchorResource);
      
      // Get current Y offset for this anchor (for stacking multiple attachments)
      const currentOffset = attachmentYOffsets.get(anchor.id) || 0;
      
      let attachmentX = anchorLane * LANE_WIDTH + ATTACHMENT_OFFSET;
      let attachmentY = anchor.position.y + currentOffset;
      
      // If this position overlaps with nodes in the next lane, shift down
      while (hasOverlap(attachmentX, attachmentY)) {
        attachmentY += NODE_HEIGHT + 30;
      }
      
      layoutedNodes.push({
        ...attachmentNode,
        position: {
          x: attachmentX,
          y: attachmentY,
        },
      });
      
      // Update offset for next attachment on same anchor
      const nextOffset = attachmentY - anchor.position.y + NODE_HEIGHT + 30;
      attachmentYOffsets.set(anchor.id, nextOffset);
    } else {
      // No anchor found - place in orphan area at bottom
      const orphanY = laneYPositions.get(LANES.ORPHAN) || 0;
      layoutedNodes.push({
        ...attachmentNode,
        position: {
          x: LANES.ATTACHMENT * LANE_WIDTH,
          y: orphanY,
        },
      });
      laneYPositions.set(LANES.ORPHAN, orphanY + NODE_HEIGHT + VERTICAL_SPACING);
    }
  }
  
  return { nodes: layoutedNodes, edges };
}

/**
 * Get lane name for display
 */
export function getLaneName(lane: number): string {
  switch (lane) {
    case LANES.INGRESS: return 'Ingress / L7';
    case LANES.SERVICE: return 'Service / L4';
    case LANES.CONTROLLER: return 'Controllers';
    case LANES.EPHEMERAL: return 'Ephemeral';
    case LANES.POD: return 'Pods';
    case LANES.ATTACHMENT: return 'Attachments';
    case LANES.ORPHAN: return 'Orphans';
    default: return 'Unknown';
  }
}

/**
 * Check if a resource should be hidden by default
 */
export function shouldHideByDefault(resource: K8sResource): boolean {
  const kind = resource.kind.toLowerCase();
  
  // Hide EndpointSlice by default (derivable from Service)
  if (kind === 'endpointslice') {
    return true;
  }
  
  // Optionally hide ReplicaSet (can be collapsed under Deployment)
  // This would be controlled by a user preference
  // if (kind === 'replicaset') {
  //   return true;
  // }
  
  return false;
}
