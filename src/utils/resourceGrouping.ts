/**
 * Resource grouping and hierarchy utilities
 */

export interface HelmResource {
  name: string;
  namespace: string;
  kind: string;
  apiVersion: string;
  status: string;
  message: string;
  chart: string;
  release: string;
  age: string;
  creationTimestamp: string;
  image?: string;
  nodeName?: string;
  restartCount?: number;
  replicasDesired?: number;
  replicasCurrent?: number;
  replicasReady?: number;
  replicasAvailable?: number;
  ownerReferences?: Array<{ kind: string; name: string }>;
  volumeName?: string;
  claimRef?: { name: string; namespace: string };
  targetPods?: string[];
  mountedPVCs?: string[];
  usedConfigMaps?: string[];
  usedSecrets?: string[];
  serviceAccountName?: string;
}

export interface ResourceGroup {
  release: string;
  chart: string;
  resources: HelmResource[];
  kindGroups: Map<string, HelmResource[]>;
}

/**
 * Groups resources by release and kind
 */
export function groupResourcesByRelease(resources: HelmResource[]): ResourceGroup[] {
  const releaseMap = new Map<string, ResourceGroup>();

  for (const resource of resources) {
    const releaseKey = resource.release || 'unknown';
    
    if (!releaseMap.has(releaseKey)) {
      releaseMap.set(releaseKey, {
        release: resource.release,
        chart: resource.chart,
        resources: [],
        kindGroups: new Map(),
      });
    }

    const group = releaseMap.get(releaseKey)!;
    group.resources.push(resource);

    // Group by kind within release
    if (!group.kindGroups.has(resource.kind)) {
      group.kindGroups.set(resource.kind, []);
    }
    group.kindGroups.get(resource.kind)!.push(resource);
  }

  return Array.from(releaseMap.values());
}

/**
 * Builds a hierarchical tree of resources based on owner references
 */
export function buildResourceHierarchy(resources: HelmResource[]): HelmResource[] {
  const resourceMap = new Map<string, HelmResource>();
  const roots: HelmResource[] = [];

  // Index all resources
  for (const resource of resources) {
    const key = `${resource.kind}/${resource.name}`;
    resourceMap.set(key, resource);
  }

  // Identify root resources (those without owners or whose owners aren't in the list)
  for (const resource of resources) {
    const hasOwnerInList = resource.ownerReferences?.some((owner) => {
      const ownerKey = `${owner.kind}/${owner.name}`;
      return resourceMap.has(ownerKey);
    });

    if (!hasOwnerInList) {
      roots.push(resource);
    }
  }

  return roots;
}

/**
 * Gets child resources for a given parent
 */
export function getChildResources(parent: HelmResource, allResources: HelmResource[]): HelmResource[] {
  return allResources.filter((resource) =>
    resource.ownerReferences?.some(
      (owner) => owner.kind === parent.kind && owner.name === parent.name
    )
  );
}

/**
 * Filters resources by status
 */
export function filterByStatus(resources: HelmResource[], status: string): HelmResource[] {
  if (!status || status === 'all') {
    return resources;
  }
  return resources.filter((r) => r.status === status);
}

/**
 * Filters resources by kind
 */
export function filterByKind(resources: HelmResource[], kind: string): HelmResource[] {
  if (!kind || kind === 'all') {
    return resources;
  }
  return resources.filter((r) => r.kind === kind);
}

/**
 * Searches resources by name
 */
export function searchResources(resources: HelmResource[], query: string): HelmResource[] {
  if (!query) {
    return resources;
  }
  const lowerQuery = query.toLowerCase();
  return resources.filter(
    (r) =>
      r.name.toLowerCase().includes(lowerQuery) ||
      r.kind.toLowerCase().includes(lowerQuery) ||
      r.namespace.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Gets unique kinds from resources
 */
export function getUniqueKinds(resources: HelmResource[]): string[] {
  const kinds = new Set<string>();
  resources.forEach((r) => kinds.add(r.kind));
  return Array.from(kinds).sort();
}

/**
 * Gets unique statuses from resources
 */
export function getUniqueStatuses(resources: HelmResource[]): string[] {
  const statuses = new Set<string>();
  resources.forEach((r) => statuses.add(r.status));
  return Array.from(statuses).sort();
}
