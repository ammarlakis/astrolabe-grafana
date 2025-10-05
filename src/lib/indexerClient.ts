/**
 * Client for Astrolabe API
 * Proxies requests through Grafana's backend
 */

import { getBackendSrv } from '@grafana/runtime';
import { firstValueFrom } from 'rxjs';
import { GraphSnapshot, KindInfo, ViewScope, EdgeType } from '../types';
import { PLUGIN_ID } from '../constants';

export interface GraphParams {
  scope: ViewScope;
  namespaces?: string[];
  release?: string;
}

export class IndexerClient {
  private static instance: IndexerClient | null = null;

  static getInstance(): IndexerClient {
    if (!IndexerClient.instance) {
      IndexerClient.instance = new IndexerClient();
    }
    return IndexerClient.instance;
  }

  /**
   * Make a request through Grafana's backend proxy
   */
  private async fetchViaBackend(path: string, params?: Record<string, string>): Promise<any> {
    const backendSrv = getBackendSrv();
    const response = await firstValueFrom(backendSrv.fetch({
      url: `/api/plugins/${PLUGIN_ID}/resources${path}`,
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
   * Note: This endpoint doesn't exist in Astrolabe yet
   */
  async listKinds(): Promise<KindInfo[]> {
    // TODO: Add this endpoint to Astrolabe
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
   * Maps our scope-based params to Astrolabe's API
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
   * Convert Astrolabe response to our GraphSnapshot format
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
   * Map edge types from Astrolabe to our format
   */
  private mapEdgeType(serverType: string): EdgeType {
    const mapping: Record<string, EdgeType> = {
      // Server's actual edge types
      'owns': EdgeType.Owner,
      'uses-configmap': EdgeType.Uses,
      'uses-secret': EdgeType.Uses,
      'uses-sa': EdgeType.Uses,
      'mounts': EdgeType.Mounts,
      'endpoints': EdgeType.Selects,
      'selects': EdgeType.Selects,
      'backs': EdgeType.Backs,
      'routes-to': EdgeType.Backs,
      'routes': EdgeType.Backs,
      // Legacy mappings (in case server changes)
      'ownership': EdgeType.Owner,
      'service-selector': EdgeType.Selects,
      'ingress-backend': EdgeType.Backs,
      'pod-volume': EdgeType.Mounts,
      'configmap-ref': EdgeType.Uses,
      'secret-ref': EdgeType.Uses,
      'service-account': EdgeType.Uses,
    };
    return mapping[serverType] || EdgeType.Ref;
  }

}
