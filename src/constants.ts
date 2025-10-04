import pluginJson from './plugin.json';

export const PLUGIN_BASE_URL = `/a/${pluginJson.id}`;

export enum Kind {
  Deployment = 'Deployment',
  StatefulSet = 'StatefulSet',
  ReplicaSet = 'ReplicaSet',
  NetworkPolicy = 'NetworkPolicy',
  EndpointSlice = 'EndpointSlice',
  Endpoints = 'Endpoints',
  Role = 'Role',
  RoleBinding = 'RoleBinding',
  ClusterRole = 'ClusterRole',
  ClusterRoleBinding = 'ClusterRoleBinding',
  HorizontalPodAutoscaler = 'HorizontalPodAutoscaler',
  DaemonSet = 'DaemonSet',
  Job = 'Job',
  CronJob = 'CronJob',
  Pod = 'Pod',
  Service = 'Service',
  Ingress = 'Ingress',
  ConfigMap = 'ConfigMap',
  Secret = 'Secret',
  ServiceAccount = 'ServiceAccount',
  PersistentVolumeClaim = 'PersistentVolumeClaim',
  PersistentVolume = 'PersistentVolume',
  StorageClass = 'StorageClass',
}
