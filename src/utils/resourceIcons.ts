/**
 * Maps Kubernetes resource kinds to icon names
 * Using Grafana's icon system
 */
export function getResourceIcon(kind: string): string {
  const iconMap: Record<string, string> = {
    // Workloads
    Pod: 'cube',                          // Single container unit
    Deployment: 'rocket',                 // Deploys and manages apps
    StatefulSet: 'database',              // Stateful apps (databases)
    DaemonSet: 'layer-group',             // Runs on all nodes
    ReplicaSet: 'copy',                   // Replica management
    Job: 'process',                       // One-time task
    CronJob: 'clock-nine',                // Scheduled task
    
    // Services & Networking
    Service: 'exchange-alt',              // Network service/load balancer
    Ingress: 'arrow-from-right',          // Incoming traffic routing
    NetworkPolicy: 'shield',              // Network security rules
    Endpoints: 'sitemap',                 // Service endpoints
    EndpointSlice: 'sitemap',             // Service endpoint slices
    
    // Config & Storage
    ConfigMap: 'file-alt',                // Configuration files
    Secret: 'key-skeleton-alt',           // Sensitive data
    PersistentVolumeClaim: 'hdd',         // Storage request
    PersistentVolume: 'database',         // Physical storage
    StorageClass: 'folder-open',          // Storage provisioner
    
    // RBAC
    Role: 'shield-exclamation',           // Namespace permissions
    RoleBinding: 'link',                  // Role assignment
    ClusterRole: 'shield',                // Cluster permissions
    ClusterRoleBinding: 'link',           // ClusterRole assignment
    ServiceAccount: 'user',               // Pod identity
    
    // Autoscaling
    HorizontalPodAutoscaler: 'arrows-h',  // Horizontal scaling
  };

  return iconMap[kind] || 'question-circle';
}

/**
 * Gets a color for a resource kind (for visual grouping)
 */
export function getResourceKindColor(kind: string): string {
  const colorMap: Record<string, string> = {
    // Workloads - Blue shades
    Pod: '#5794F2',
    Deployment: '#8AB8FF',
    StatefulSet: '#3274D9',
    DaemonSet: '#1F60C4',
    ReplicaSet: '#96D98D',
    
    // Services - Green shades
    Service: '#73BF69',
    Ingress: '#56A64B',
    
    // Config - Yellow/Orange shades
    ConfigMap: '#FADE2A',
    Secret: '#FF9830',
    
    // Storage - Purple shades
    PersistentVolumeClaim: '#B877D9',
    PersistentVolume: '#8F3BB8',
    StorageClass: '#CA95E5',
  };

  return colorMap[kind] || '#6E6E6E';
}
