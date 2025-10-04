/**
 * Core types for Astrolabe Kubernetes App Plugin
 */

import { Kind } from "../constants";

export type ViewScope = 'cluster' | 'namespace' | 'release';
export type ResourceStatus = 'Ready' | 'Pending' | 'Error' | 'Unknown';
export type EdgeType = 'owner' | 'selects' | 'backs' | 'ref' | 'scales' | 'routes' | 'binds' | 'mounts' | 'uses';

/**
 * Kubernetes resource representation
 * Extends HelmResource from panel plugin with additional fields for app context
 */
export interface K8sResource {
  // Core identifiers
  uid: string;
  gvk: {
    group: string;
    version: string;
    kind: Kind;
  };
  name: string;
  namespace?: string;
  kind: Kind;
  apiVersion: string;
  
  // Status and health
  status: ResourceStatus;
  reason?: string;
  message?: string;
  
  // Metadata
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  age?: string;
  creationTimestamp?: string;
  isClusterScoped?: boolean;
  
  // Helm/Release info
  chart?: string;
  release?: string;
  
  // Workload-specific fields
  image?: string;
  nodeName?: string;
  restartCount?: number;
  replicasDesired?: number;
  replicasCurrent?: number;
  replicasReady?: number;
  replicasAvailable?: number;
  
  // Relationships
  ownerReferences?: Array<{ uid: string; kind: Kind; name: string }>;
  
  // Storage
  volumeName?: string;
  claimRef?: { name: string; namespace: string };
  
  // Service/Networking
  targetPods?: string[];
  
  // Config references
  mountedPVCs?: string[];
  usedConfigMaps?: string[];
  usedSecrets?: string[];
  serviceAccountName?: string;
  
  // Optional metrics overlay
  metrics?: Record<string, number | string>;
}

/**
 * Graph edge representing relationship between resources
 */
export interface K8sEdge {
  from: string; // uid of source resource
  to: string;   // uid of target resource
  type: EdgeType;
}

/**
 * Complete graph snapshot from indexer
 */
export interface GraphSnapshot {
  scope: ViewScope;
  scopeRef?: {
    namespaces?: string[];
    release?: string;
  };
  rv: string; // resource version for tracking updates
  nodes: K8sResource[];
  edges: K8sEdge[];
  stats?: {
    nodes: number;
    edges: number;
    warnings: number;
    errors: number;
  };
}

/**
 * Release summary from indexer
 */
export interface ReleaseSummary {
  namespace: string;
  name: string;
  rv: string;
  updatedAt: string;
  status: ResourceStatus;
  counts: {
    nodes: number;
    edges: number;
    pods: number;
    errors: number;
  };
  labels?: Record<string, string>;
}

/**
 * Kind metadata from indexer
 */
export interface KindInfo {
  group: string;
  version: string;
  kind: string;
  scope: 'Namespaced' | 'Cluster';
}

/**
 * Delta operations for live updates
 */
export type Delta =
  | { op: 'upsert_node'; node: K8sResource }
  | { op: 'remove_node'; uid: string }
  | { op: 'upsert_edge'; edge: K8sEdge }
  | { op: 'remove_edge'; from: string; to: string }
  | { op: 'scope_changed'; rv: string };

/**
 * Stream message from SSE/WS
 */
export interface StreamMessage {
  rv: string;
  deltas: Delta[];
}

/**
 * App configuration
 */
export interface AppConfig {
  indexerBaseUrl: string;
  streamUrl?: string;
  authHeaders?: Record<string, string>;
}

/**
 * Filter state
 */
export interface FilterState {
  statusFilter: string;
  kindFilter: string;
  searchQuery: string;
  showProblemsOnly: boolean;
  showClusterScoped: boolean;
}

export interface ViewOptions {
  showEndpointSlices: boolean;
  showReplicaSets: boolean;
  showNamespaceLanes: boolean;
  bundleEdges: boolean;
}

export interface ResourceAttachments {
  replicaSets?: K8sResource[];
  pods?: K8sResource[];
  endpointSlices?: K8sResource[];
  configMaps?: K8sResource[];
  secrets?: K8sResource[];
  serviceAccounts?: K8sResource[];
  pvcs?: K8sResource[];
  pvs?: K8sResource[];
  storageClasses?: K8sResource[];
}

// Map of resource UID to set of expanded attachment types
export type ExpansionState = Map<string, Set<Kind>>;
