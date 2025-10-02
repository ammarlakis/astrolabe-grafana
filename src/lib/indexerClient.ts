/**
 * Client for kubernetes-state-server API
 * Handles HTTP requests and SSE/WebSocket connections
 */

import { GraphSnapshot, ReleaseSummary, KindInfo, StreamMessage, ViewScope } from '../types';

export interface GraphParams {
  scope: ViewScope;
  namespaces?: string[];
  release?: string;
}

export class IndexerClient {
  private baseUrl: string;
  private streamUrl?: string;

  constructor(baseUrl: string, streamUrl?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.streamUrl = streamUrl || this.baseUrl;
  }

  /**
   * List all namespaces
   */
  async listNamespaces(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/namespaces`);
    if (!response.ok) {
      throw new Error(`Failed to fetch namespaces: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * List all resource kinds
   */
  async listKinds(): Promise<KindInfo[]> {
    const response = await fetch(`${this.baseUrl}/kinds`);
    if (!response.ok) {
      throw new Error(`Failed to fetch kinds: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * List Helm releases
   */
  async listReleases(ns?: string): Promise<ReleaseSummary[]> {
    const url = ns ? `${this.baseUrl}/releases?ns=${ns}` : `${this.baseUrl}/releases`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch releases: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get graph snapshot
   */
  async getGraph(params: GraphParams): Promise<GraphSnapshot> {
    const url = this.buildGraphUrl(params);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch graph: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Open SSE stream for live updates
   */
  openStream(params: GraphParams, since?: string): EventSource {
    const url = this.buildStreamUrl(params, since);
    return new EventSource(url);
  }

  /**
   * Build graph URL with query parameters
   */
  private buildGraphUrl(params: GraphParams): string {
    const query = new URLSearchParams();
    query.set('scope', params.scope);

    if (params.scope === 'namespace' && params.namespaces) {
      query.set('namespaces', params.namespaces.join(','));
    } else if (params.scope === 'release' && params.release) {
      query.set('release', params.release);
    }

    return `${this.baseUrl}/graph?${query.toString()}`;
  }

  /**
   * Build stream URL with query parameters
   */
  private buildStreamUrl(params: GraphParams, since?: string): string {
    const query = new URLSearchParams();
    query.set('scope', params.scope);

    if (params.scope === 'namespace' && params.namespaces) {
      query.set('namespaces', params.namespaces.join(','));
    } else if (params.scope === 'release' && params.release) {
      query.set('release', params.release);
    }

    if (since) {
      query.set('since', since);
    }

    return `${this.streamUrl}/stream?${query.toString()}`;
  }
}

/**
 * Create indexer client from app config
 */
export function createIndexerClient(baseUrl: string = 'http://localhost:8080'): IndexerClient {
  return new IndexerClient(baseUrl);
}
