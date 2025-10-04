/**
 * Edge resolver - builds relationship edges between Kubernetes resources
 * Adapted from ResourceTree.tsx relationship logic
 */

import { K8sResource, K8sEdge, EdgeType, Kind } from '../types';

/**
 * Build all edges for a set of resources
 */
export function buildEdges(resources: K8sResource[]): K8sEdge[] {
  const edges: K8sEdge[] = [];
  const nodeMap = new Map<string, K8sResource>();

  // Index all resources by uid
  resources.forEach((resource) => {
    nodeMap.set(resource.uid, resource);
  });

  resources.forEach((resource) => {
    // Owner references (Deployment→ReplicaSet→Pod, etc.)
    if (resource.ownerReferences) {
      resource.ownerReferences.forEach((owner) => {
        // Find owner by kind and name in same namespace
        const ownerResource = Array.from(nodeMap.values()).find(
          (r) => r.kind === owner.kind && r.name === owner.name && r.namespace === resource.namespace
        );
        if (ownerResource) {
          edges.push({
            from: ownerResource.uid,
            to: resource.uid,
            type: EdgeType.Owner,
          });
        }
      });
    }

    // Service → Endpoints (same name)
    if (resource.kind === 'Service') {
      resources.forEach((r) => {
        if (
          (r.kind === 'Endpoints' || r.kind === 'EndpointSlice') &&
          r.name === resource.name &&
          r.namespace === resource.namespace
        ) {
          edges.push({
            from: resource.uid,
            to: r.uid,
            type: EdgeType.Selects,
          });
        }
      });
    }

    // Endpoints/EndpointSlice → Pods (via targetPods)
    if ((resource.kind === 'Endpoints' || resource.kind === 'EndpointSlice') && resource.targetPods) {
      resource.targetPods.forEach((podName) => {
        const pod = Array.from(nodeMap.values()).find(
          (r) => r.kind === 'Pod' && r.name === podName && r.namespace === resource.namespace
        );
        if (pod) {
          edges.push({
            from: resource.uid,
            to: pod.uid,
            type: EdgeType.Selects,
          });
        }
      });
    }

    // Ingress → Service (by namespace matching)
    if (resource.kind === 'Ingress') {
      resources.forEach((r) => {
        if (r.kind === 'Service' && r.namespace === resource.namespace) {
          edges.push({
            from: resource.uid,
            to: r.uid,
            type: EdgeType.Backs,
          });
        }
      });
    }

    // PersistentVolumeClaim → PersistentVolume (via volumeName)
    if (resource.kind === 'PersistentVolumeClaim' && resource.volumeName) {
      const pv = Array.from(nodeMap.values()).find(
        (r) => r.kind === 'PersistentVolume' && r.name === resource.volumeName
      );
      if (pv) {
        edges.push({
          from: resource.uid,
          to: pv.uid,
          type: EdgeType.Ref,
        });
      }
    }

    // PersistentVolume → PersistentVolumeClaim (via claimRef)
    if (resource.kind === 'PersistentVolume' && resource.claimRef) {
      const pvc = Array.from(nodeMap.values()).find(
        (r) =>
          r.kind === 'PersistentVolumeClaim' &&
          r.name === resource.claimRef!.name &&
          r.namespace === resource.claimRef!.namespace
      );
      if (pvc) {
        edges.push({
          from: pvc.uid,
          to: resource.uid,
          type: EdgeType.Ref,
        });
      }
    }

    // Pod → PVC (via mountedPVCs)
    if (resource.kind === 'Pod' && resource.mountedPVCs) {
      resource.mountedPVCs.forEach((pvcName) => {
        const pvc = Array.from(nodeMap.values()).find(
          (r) => r.kind === 'PersistentVolumeClaim' && r.name === pvcName && r.namespace === resource.namespace
        );
        if (pvc) {
          edges.push({
            from: resource.uid,
            to: pvc.uid,
            type: EdgeType.Mounts,
          });
        }
      });
    }

    // Workload → ConfigMap/Secret/ServiceAccount (only for Deployments, StatefulSets, DaemonSets)
    if (['Deployment', 'StatefulSet', 'DaemonSet'].includes(resource.kind)) {
      // ConfigMaps
      if (resource.usedConfigMaps) {
        resource.usedConfigMaps.forEach((cmName) => {
          const cm = Array.from(nodeMap.values()).find(
            (r) => r.kind === 'ConfigMap' && r.name === cmName && r.namespace === resource.namespace
          );
          if (cm) {
            edges.push({
              from: resource.uid,
              to: cm.uid,
              type: EdgeType.Uses,
            });
          }
        });
      }

      // Secrets
      if (resource.usedSecrets) {
        resource.usedSecrets.forEach((secretName) => {
          const secret = Array.from(nodeMap.values()).find(
            (r) => r.kind === 'Secret' && r.name === secretName && r.namespace === resource.namespace
          );
          if (secret) {
            edges.push({
              from: resource.uid,
              to: secret.uid,
              type: EdgeType.Uses,
            });
          }
        });
      }

      // ServiceAccount
      if (resource.serviceAccountName) {
        const sa = Array.from(nodeMap.values()).find(
          (r) =>
            r.kind === Kind.ServiceAccount &&
            r.name === resource.serviceAccountName &&
            r.namespace === resource.namespace
        );
        if (sa) {
          edges.push({
            from: resource.uid,
            to: sa.uid,
            type: EdgeType.Uses,
          });
        }
      }
    }

    // HorizontalPodAutoscaler → Workload
    if (resource.kind === 'HorizontalPodAutoscaler') {
      // HPA typically has a scaleTargetRef, but we'll need to add that to the resource type
      // For now, match by namespace
      resources.forEach((r) => {
        if (
          [Kind.Deployment, Kind.StatefulSet, Kind.ReplicaSet].includes(r.kind) &&
          r.namespace === resource.namespace
        ) {
          edges.push({
            from: resource.uid,
            to: r.uid,
            type: EdgeType.Scales,
          });
        }
      });
    }
  });

  return edges;
}

/**
 * Get child resources for a given parent (by owner references)
 */
export function getChildResources(parent: K8sResource, allResources: K8sResource[]): K8sResource[] {
  return allResources.filter((resource) =>
    resource.ownerReferences?.some((owner) => owner.kind === parent.kind && owner.name === parent.name)
  );
}

/**
 * Get root resources (those without owners in the current set)
 */
export function getRootResources(resources: K8sResource[]): K8sResource[] {
  const resourceMap = new Map<string, K8sResource>();
  resources.forEach((r) => resourceMap.set(r.uid, r));

  return resources.filter((resource) => {
    if (!resource.ownerReferences || resource.ownerReferences.length === 0) {
      return true;
    }
    // Check if any owner exists in the current set
    const hasOwnerInSet = resource.ownerReferences.some((owner) => {
      return Array.from(resourceMap.values()).some(
        (r) => r.kind === owner.kind && r.name === owner.name && r.namespace === resource.namespace
      );
    });
    return !hasOwnerInSet;
  });
}
