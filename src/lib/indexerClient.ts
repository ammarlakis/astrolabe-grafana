/**
 * Client for kubernetes-state-server API
 * Proxies requests through Grafana's backend
 */

import { getBackendSrv } from '@grafana/runtime';
import { firstValueFrom } from 'rxjs';
import { GraphSnapshot, KindInfo, ViewScope, EdgeType } from '../types';

export interface GraphParams {
  scope: ViewScope;
  namespaces?: string[];
  release?: string;
}

export class IndexerClient {
  private pluginId = 'ammarlakis-astrolabe-app';

  constructor(pluginId?: string) {
    if (pluginId) {
      this.pluginId = pluginId;
    }
  }

  /**
   * Make a request through Grafana's backend proxy
   */
  private async fetchViaBackend(path: string, params?: Record<string, string>): Promise<any> {
    const backendSrv = getBackendSrv();
    const response = await firstValueFrom(backendSrv.fetch({
      url: `/api/plugins/${this.pluginId}/resources${path}`,
      method: 'GET',
      params: params,
    }));
    return response?.data;
  }

  /**
   * List all namespaces
   */
  async listNamespaces(): Promise<string[]> {
    return this.fetchViaBackend('/namespaces');
  }

  /**
   * List all resource kinds
   * Note: This endpoint doesn't exist in kubernetes-state-server yet
   */
  async listKinds(): Promise<KindInfo[]> {
    // TODO: Add this endpoint to kubernetes-state-server
    // For now, return empty array
    return [];
  }

  /**
   * List Helm releases
   */
  async listReleases(ns?: string): Promise<string[]> {
    const params = ns ? { namespace: ns } : undefined;
    return this.fetchViaBackend('/releases', params);
  }

  /**
   * Get graph snapshot
   */
  async getGraph(params: GraphParams): Promise<GraphSnapshot> {
    const queryParams = this.buildGraphParams(params);
    const data = await this.fetchViaBackend('/graph', queryParams);
    return this.convertToGraphSnapshot(data, params);
  }

  /**
   * Open SSE stream for live updates
   * Note: SSE through backend proxy is complex, not implemented yet
   */
  openStream(params: GraphParams, since?: string): EventSource {
    throw new Error('SSE streaming not yet implemented through backend proxy');
  }

  /**
   * Build graph query parameters
   * Maps our scope-based params to kubernetes-state-server's API
   */
  private buildGraphParams(params: GraphParams): Record<string, string> | undefined {
    const queryParams: Record<string, string> = {};

    if (params.scope === 'namespace' && params.namespaces && params.namespaces.length > 0) {
      // For namespace scope, use the first namespace (server doesn't support multiple)
      queryParams.namespace = params.namespaces[0];
    } else if (params.scope === 'release' && params.release) {
      queryParams.release = params.release;
    }
    // For cluster scope, no parameters needed (returns all)

    return Object.keys(queryParams).length > 0 ? queryParams : undefined;
  }

  /**
   * Convert kubernetes-state-server response to our GraphSnapshot format
   */
  private convertToGraphSnapshot(data: any, params: GraphParams): GraphSnapshot {
    const nodes = data.nodes.map((node: any) => ({
      uid: node.uid,
      gvk: {
        group: '',  // Not provided by server
        version: '',
        kind: node.kind,
      },
      name: node.name,
      namespace: node.namespace,
      kind: node.kind,
      apiVersion: '',  // Not provided
      status: node.status as any,
      message: node.message,
      labels: {},  // Not provided
      chart: node.chart,
      release: node.release,
      age: node.metadata?.age,
      creationTimestamp: node.metadata?.creationTimestamp,
      image: node.metadata?.image,
      nodeName: node.metadata?.nodeName,
      restartCount: node.metadata?.restartCount,
      replicasDesired: node.metadata?.replicas?.desired,
      replicasCurrent: node.metadata?.replicas?.current,
      replicasReady: node.metadata?.replicas?.ready,
      replicasAvailable: node.metadata?.replicas?.available,
      volumeName: node.metadata?.volumeName,
      claimRef: node.metadata?.claimRef,
      targetPods: node.metadata?.targetPods,
      mountedPVCs: node.metadata?.mountedPVCs,
      usedConfigMaps: node.metadata?.usedConfigMaps,
      usedSecrets: node.metadata?.usedSecrets,
      serviceAccountName: node.metadata?.serviceAccountName,
      isClusterScoped: !node.namespace,
    }));

    const edges = data.edges.map((edge: any) => ({
      from: edge.from,
      to: edge.to,
      type: this.mapEdgeType(edge.type),
    }));

    return {
      scope: params.scope,
      scopeRef: {
        namespaces: params.namespaces,
        release: params.release,
      },
      rv: Date.now().toString(),  // Server doesn't provide rv yet
      nodes,
      edges,
      stats: {
        nodes: nodes.length,
        edges: edges.length,
        warnings: 0,
        errors: nodes.filter((n: any) => n.status === 'Error').length,
      },
    };
  }

  /**
   * Map edge types from kubernetes-state-server to our format
   */
  private mapEdgeType(serverType: string): EdgeType {
    const mapping: Record<string, EdgeType> = {
      // Server's actual edge types
      'owns': 'owner',
      'uses-configmap': 'uses',
      'uses-secret': 'uses',
      'uses-sa': 'uses',
      'mounts': 'mounts',
      'endpoints': 'selects',
      'selects': 'selects',
      'backs': 'backs',
      'routes-to': 'backs',
      'routes': 'backs',
      // Legacy mappings (in case server changes)
      'ownership': 'owner',
      'service-selector': 'selects',
      'ingress-backend': 'backs',
      'pod-volume': 'mounts',
      'configmap-ref': 'uses',
      'secret-ref': 'uses',
      'service-account': 'uses',
    };
    return mapping[serverType] || 'ref';
  }

}

/**
 * Create indexer client
 * No longer needs baseUrl since we proxy through Grafana backend
 */
export function createIndexerClient(): IndexerClient {
  return new IndexerClient();
}
