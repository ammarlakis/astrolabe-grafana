/**
 * Attachment computation and filtering utilities
 * Handles collapsible resources (ReplicaSet, Pod, ConfigMap, etc.)
 */

import { Kind } from '../constants';
import { K8sResource, K8sEdge, ResourceAttachments, ExpansionState } from '../types';

/**
 * Compute attachments for a given resource
 * Shows attachments based on canonical Kubernetes relationships:
 * - ConfigMap/Secret/SA are referenced at Pod level (collapsed to Controller for UX)
 * - PVC/PV are referenced at Pod level
 * - ReplicaSets are owned by Deployments
 * - Pods are owned by ReplicaSets/StatefulSets/DaemonSets/Jobs
 */
export function computeAttachments(
  resource: K8sResource,
  allResources: K8sResource[],
  edges: K8sEdge[]
): ResourceAttachments {
  const attachments: ResourceAttachments = {};
  const outgoingEdges = edges.filter(edge => edge.from === resource.uid);

  const appendAttachment = <K extends keyof ResourceAttachments>(key: K, target: K8sResource) => {
    const existing = (attachments[key] as K8sResource[] | undefined) ?? [];
    attachments[key] = [...existing, target] as ResourceAttachments[K];
  };

  if (resource.kind === Kind.Service) {
    for (const edge of outgoingEdges) {
      const target = allResources.find(r => r.uid === edge.to);
      if (target && target.kind.toLowerCase() === 'endpointslice') {
        appendAttachment('endpointSlices', target);
      }
    }
    return attachments;
  }

  if ([Kind.Deployment, Kind.StatefulSet, Kind.DaemonSet, Kind.CronJob].includes(resource.kind)) {
    for (const edge of outgoingEdges) {
      const target = allResources.find(r => r.uid === edge.to);
      if (!target) {
        continue;
      }

      if (target.kind === Kind.ReplicaSet) {
        appendAttachment('replicaSets', target);
      } else if (target.kind === Kind.Job || target.kind === Kind.Pod) {
        appendAttachment('pods', target);
      }
    }

    const childPods = findChildPods(resource, allResources, edges);
    const collapsedRefs = getCollapsedPodReferences(childPods, allResources, edges);

    if (collapsedRefs.configMaps.length > 0) {
      attachments.configMaps = collapsedRefs.configMaps;
    }
    if (collapsedRefs.secrets.length > 0) {
      attachments.secrets = collapsedRefs.secrets;
    }
    if (collapsedRefs.serviceAccounts.length > 0) {
      attachments.serviceAccounts = collapsedRefs.serviceAccounts;
    }
    if (collapsedRefs.pvcs.length > 0) {
      attachments.pvcs = collapsedRefs.pvcs;
    }

    return attachments;
  }

  if ([Kind.ReplicaSet, Kind.Job].includes(resource.kind)) {
    for (const edge of outgoingEdges) {
      const target = allResources.find(r => r.uid === edge.to);
      if (target && target.kind.toLowerCase() === 'pod') {
        appendAttachment('pods', target);
      }
    }
    return attachments;
  }

  if (resource.kind === Kind.Pod) {
    for (const edge of outgoingEdges) {
      const target = allResources.find(r => r.uid === edge.to);
      if (!target) {
        continue;
      }

      if (target.kind === Kind.ConfigMap) {
        appendAttachment('configMaps', target);
      } else if (target.kind === Kind.Secret) {
        appendAttachment('secrets', target);
      } else if (target.kind === Kind.ServiceAccount) {
        appendAttachment('serviceAccounts', target);
      } else if (target.kind === Kind.PersistentVolumeClaim) {
        appendAttachment('pvcs', target);
      }
    }
    return attachments;
  }

  if (resource.kind === Kind.PersistentVolumeClaim) {
    for (const edge of outgoingEdges) {
      const target = allResources.find(r => r.uid === edge.to);
      if (target && target.kind.toLowerCase() === 'persistentvolume') {
        appendAttachment('pvs', target);
      }
    }
    return attachments;
  }

  if (resource.kind === Kind.PersistentVolume) {
    for (const edge of outgoingEdges) {
      const target = allResources.find(r => r.uid === edge.to);
      if (target && target.kind.toLowerCase() === 'storageclass') {
        appendAttachment('storageClasses', target);
      }
    }
  }

  return attachments;
}
function findChildPods(
  controller: K8sResource,
  allResources: K8sResource[],
  edges: K8sEdge[]
): K8sResource[] {
  const pods: K8sResource[] = [];
  const controllerKind = controller.kind.toLowerCase();
  
  // Direct Pod ownership (StatefulSet, DaemonSet)
  if (['statefulset', 'daemonset'].includes(controllerKind)) {
    const directPods = edges
      .filter(e => e.from === controller.uid)
      .map(e => allResources.find(r => r.uid === e.to))
      .filter(r => r && r.kind.toLowerCase() === 'pod') as K8sResource[];
    pods.push(...directPods);
  }
  
  // Indirect through ReplicaSets (Deployment)
  if (controllerKind === 'deployment') {
    const replicaSets = edges
      .filter(e => e.from === controller.uid)
      .map(e => allResources.find(r => r.uid === e.to))
      .filter(r => r && r.kind.toLowerCase() === 'replicaset') as K8sResource[];
    
    replicaSets.forEach(rs => {
      const rsPods = edges
        .filter(e => e.from === rs.uid)
        .map(e => allResources.find(r => r.uid === e.to))
        .filter(r => r && r.kind.toLowerCase() === 'pod') as K8sResource[];
      pods.push(...rsPods);
    });
  }
  
  // ReplicaSet/Job direct ownership
  if (['replicaset', 'job'].includes(controllerKind)) {
    const directPods = edges
      .filter(e => e.from === controller.uid)
      .map(e => allResources.find(r => r.uid === e.to))
      .filter(r => r && r.kind.toLowerCase() === 'pod') as K8sResource[];
    pods.push(...directPods);
  }
  
  return pods;
}

/**
 * Get collapsed references from Pods (ConfigMap, Secret, SA)
 * Returns unique references shared across all pods
 */
function getCollapsedPodReferences(
  pods: K8sResource[],
  allResources: K8sResource[],
  edges: K8sEdge[]
): { configMaps: K8sResource[]; secrets: K8sResource[]; serviceAccounts: K8sResource[]; pvcs: K8sResource[] } {
  const configMapSet = new Set<string>();
  const secretSet = new Set<string>();
  const serviceAccountSet = new Set<string>();
  const pvcSet = new Set<string>();

  pods.forEach(pod => {
    const podEdges = edges.filter(e => e.from === pod.uid);
    podEdges.forEach(edge => {
      const target = allResources.find(r => r.uid === edge.to);
      if (!target) {
        return;
      }

      switch (target.kind) {
        case Kind.ConfigMap:
          configMapSet.add(target.uid);
          break;
        case Kind.Secret:
          secretSet.add(target.uid);
          break;
        case Kind.ServiceAccount:
          serviceAccountSet.add(target.uid);
          break;
        case Kind.PersistentVolumeClaim:
          pvcSet.add(target.uid);
          break;
      }
    });
  });
  
  return {
    configMaps: Array.from(configMapSet).map(uid => allResources.find(r => r.uid === uid)!).filter(Boolean),
    secrets: Array.from(secretSet).map(uid => allResources.find(r => r.uid === uid)!).filter(Boolean),
    serviceAccounts: Array.from(serviceAccountSet).map(uid => allResources.find(r => r.uid === uid)!).filter(Boolean),
    pvcs: Array.from(pvcSet).map(uid => allResources.find(r => r.uid === uid)!).filter(Boolean),
  };
}

/**
 * Check if a resource should be hidden by default
 */
export function isCollapsibleResource(resource: K8sResource): boolean {
  return [
    Kind.ReplicaSet,
    Kind.Job,
    Kind.Pod,
    Kind.EndpointSlice,
    Kind.ConfigMap,
    Kind.Secret,
    Kind.ServiceAccount,
    Kind.PersistentVolumeClaim,
    Kind.PersistentVolume,
    Kind.StorageClass,
  ].includes(resource.kind);
}

/**
 * Find the owner of a resource (for determining if it should be shown)
 */
export function findOwner(resource: K8sResource, allResources: K8sResource[], edges: K8sEdge[]): K8sResource | null {
  // Find incoming edges (resources that reference this one)
  const incomingEdges = edges.filter(e => e.to === resource.uid);
  
  if (incomingEdges.length === 0) {
    return null;
  }
  
  // Find the highest-priority owner
  const owners = incomingEdges
    .map(e => allResources.find(r => r.uid === e.from))
    .filter(Boolean) as K8sResource[];
  
  return findHighestOwner(owners);
}

/**
 * Find all owners of a resource (not just the highest priority)
 */
function findAllOwners(resource: K8sResource, allResources: K8sResource[], edges: K8sEdge[]): K8sResource[] {
  // Find incoming edges (resources that reference this one)
  const incomingEdges = edges.filter(e => e.to === resource.uid);
  
  if (incomingEdges.length === 0) {
    return [];
  }
  
  // Return all owners
  const owners = incomingEdges
    .map(e => allResources.find(r => r.uid === e.from))
    .filter(Boolean) as K8sResource[];
  
  return owners;
}

/**
 * Find the highest-priority owner from a list of resources
 * Priority: Deployment > StatefulSet > DaemonSet > Service > ReplicaSet > Pod
 */
function findHighestOwner(resources: K8sResource[]): K8sResource | null {
  const priority = [
    Kind.Deployment,
    Kind.StatefulSet,
    Kind.DaemonSet,
    Kind.CronJob,
    Kind.Service,
    Kind.Job,
    Kind.ReplicaSet,
    Kind.Pod,
  ];
  
  for (const kind of priority) {
    const found = resources.find(r => r.kind === kind);
    if (found) {
      return found;
    }
  }
  
  return resources[0] || null;
}

/**
 * Filter resources based on expansion state
 */
export function filterVisibleResources(
  resources: K8sResource[],
  allResources: K8sResource[],
  edges: K8sEdge[],
  expansionState: ExpansionState
): K8sResource[] {
  return resources.filter(resource => {
    // Always show main flow resources
    if (!isCollapsibleResource(resource)) {
      return true;
    }
    
    // Check if this resource is expanded by ANY of its owners
    const owners = findAllOwners(resource, allResources, edges);
    if (owners.length === 0) {
      // No owner, show it (orphan)
      return true;
    }
        
    // Check if any owner has this resource type expanded
    for (const owner of owners) {
      const expandedTypes = expansionState.get(owner.uid);
      if (expandedTypes && expandedTypes.has(resource.kind)) {
        return true;
      }
    }
    
    return false;
  });
}

/**
 * Simplify edges to connect to highest owner
 * Removes redundant edges (e.g., Deployment→CM, RS→CM, Pod→CM becomes just Deployment→CM)
 */
export function simplifyEdges(
  edges: K8sEdge[],
  resources: K8sResource[],
  expansionState: ExpansionState
): K8sEdge[] {
  const simplified: K8sEdge[] = [];
  const edgesByTarget = new Map<string, K8sEdge[]>();
  
  // Group edges by target
  edges.forEach(edge => {
    if (!edgesByTarget.has(edge.to)) {
      edgesByTarget.set(edge.to, []);
    }
    edgesByTarget.get(edge.to)!.push(edge);
  });
  
  // For each target, keep only the highest-level source
  edgesByTarget.forEach((targetEdges, targetUid) => {
    const target = resources.find(r => r.uid === targetUid);
    if (!target) {
        return;
    }
   
    // If target is ConfigMap/Secret/SA, find highest owner
    if ([Kind.ConfigMap, Kind.Secret, Kind.ServiceAccount].includes(target.kind)) {
      const sources = targetEdges
        .map(e => resources.find(r => r.uid === e.from))
        .filter(Boolean) as K8sResource[];
      
      const highestSource = findHighestOwner(sources);
      
      if (highestSource) {
        const edge = targetEdges.find(e => e.from === highestSource.uid);
        if (edge) {
          simplified.push(edge);
        }
      }
    } else if (target.kind === Kind.PersistentVolumeClaim) {
      // PVCs: keep ALL edges from Pods (multiple pods can mount same PVC)
      // Since targetEdges are already filtered to visible edges,
      // if there are Pod edges here, the Pods are visible - use them!
      const podEdges = targetEdges.filter(e => {
        const source = resources.find(r => r.uid === e.from);
        return source && source.kind === Kind.Pod;
      });
      
      if (podEdges.length > 0) {
        // Use all pod edges (pods are visible since edges are in targetEdges)
        simplified.push(...podEdges);
      } else {
        // No pod edges, keep all edges (likely controller→PVC or other)
        simplified.push(...targetEdges);
      }
    } else {
      // Keep all edges for other resources
      simplified.push(...targetEdges);
    }
  });
  
  return simplified;
}

/**
 * Compute all attachments for all resources
 */
export function computeAllAttachments(
  resources: K8sResource[],
  edges: K8sEdge[]
): Map<string, ResourceAttachments> {
  const attachmentsMap = new Map<string, ResourceAttachments>();
  
  resources.forEach(resource => {
    const attachments = computeAttachments(resource, resources, edges);
    if (Object.keys(attachments).length > 0) {
      attachmentsMap.set(resource.uid, attachments);
    }
  });
  
  return attachmentsMap;
}
