/**
 * Utility functions to determine resource capabilities and display logic
 */

/**
 * Resource kinds that have replica counts
 */
const REPLICA_KINDS = new Set([
  'Deployment',
  'StatefulSet',
  'ReplicaSet',
  'DaemonSet',
]);

/**
 * Resource kinds that can have restart counts (containers)
 */
const RESTART_KINDS = new Set([
  'Pod',
]);

/**
 * Resource kinds that typically don't have a "Ready" status
 * Note: Some of these are now in NO_STATUS_KINDS (completely no status)
 */
const NO_READY_STATUS_KINDS = new Set([
  'ConfigMap',
  'Secret',
  'PersistentVolumeClaim',
  'PersistentVolume',
  'StorageClass',
  'ServiceAccount',
  'Role',
  'RoleBinding',
  'ClusterRole',
  'ClusterRoleBinding',
  'Ingress',
  'NetworkPolicy',
]);

/**
 * Resource kinds that don't have meaningful status at all
 */
const NO_STATUS_KINDS = new Set([
  'ConfigMap',
  'Secret',
  'ServiceAccount',
  'Role',
  'RoleBinding',
  'ClusterRole',
  'ClusterRoleBinding',
  'NetworkPolicy',
  'Ingress',
  'Endpoints',
  'EndpointSlice',
]);

/**
 * Resource kinds that are typically "jobs" (one-time or scheduled)
 */
const JOB_KINDS = new Set([
  'Job',
  'CronJob',
]);

/**
 * Check if a resource kind supports replica counts
 */
export function hasReplicas(kind: string): boolean {
  return REPLICA_KINDS.has(kind);
}

/**
 * Check if a resource kind can have restart counts
 */
export function hasRestarts(kind: string): boolean {
  return RESTART_KINDS.has(kind);
}

/**
 * Check if a resource kind typically has a "Ready" status
 */
export function hasReadyStatus(kind: string): boolean {
  return !NO_READY_STATUS_KINDS.has(kind) && !JOB_KINDS.has(kind);
}

/**
 * Check if a resource kind has a meaningful status to display
 */
export function hasStatus(kind: string): boolean {
  return !NO_STATUS_KINDS.has(kind);
}

/**
 * Check if a resource is a job-type resource
 */
export function isJobType(kind: string): boolean {
  return JOB_KINDS.has(kind);
}

/**
 * Get appropriate status label for a resource kind
 */
export function getStatusLabel(kind: string, status: string): string {
  if (JOB_KINDS.has(kind)) {
    // Jobs have different status values
    return status; // Complete, Failed, Running, etc.
  }
  
  if (NO_READY_STATUS_KINDS.has(kind)) {
    // Config resources are typically just "Available" or "Bound"
    return status;
  }
  
  return status; // Ready, Error, Pending, Unknown
}

/**
 * Get a description of what the resource does
 */
export function getResourceDescription(kind: string): string {
  const descriptions: Record<string, string> = {
    // Workloads
    Pod: 'Running container(s)',
    Deployment: 'Manages ReplicaSets and Pods',
    StatefulSet: 'Manages stateful Pods',
    DaemonSet: 'Runs on every node',
    ReplicaSet: 'Maintains Pod replicas',
    Job: 'Runs to completion',
    CronJob: 'Scheduled job',
    
    // Services & Networking
    Service: 'Network endpoint',
    Ingress: 'HTTP(S) routing',
    NetworkPolicy: 'Network rules',
    
    // Config & Storage
    ConfigMap: 'Configuration data',
    Secret: 'Sensitive data',
    PersistentVolumeClaim: 'Storage request',
    PersistentVolume: 'Storage volume',
    StorageClass: 'Storage provisioner',
    
    // RBAC
    Role: 'Namespace permissions',
    RoleBinding: 'Role assignment',
    ClusterRole: 'Cluster permissions',
    ClusterRoleBinding: 'ClusterRole assignment',
    ServiceAccount: 'Pod identity',
    
    // Autoscaling
    HorizontalPodAutoscaler: 'Auto-scales Pods',
  };
  
  return descriptions[kind] || 'Kubernetes resource';
}

/**
 * Determine if a resource should show detailed metrics
 */
export function shouldShowMetrics(kind: string): boolean {
  return REPLICA_KINDS.has(kind) || RESTART_KINDS.has(kind);
}

/**
 * Get expected status values for a resource kind
 */
export function getExpectedStatuses(kind: string): string[] {
  if (JOB_KINDS.has(kind)) {
    return ['Complete', 'Failed', 'Running', 'Pending'];
  }
  
  if (kind === 'PersistentVolumeClaim') {
    return ['Bound', 'Pending', 'Lost'];
  }
  
  if (kind === 'PersistentVolume') {
    return ['Available', 'Bound', 'Released', 'Failed'];
  }
  
  if (NO_READY_STATUS_KINDS.has(kind)) {
    return ['Available', 'Active'];
  }
  
  return ['Ready', 'Error', 'Pending', 'Unknown'];
}
