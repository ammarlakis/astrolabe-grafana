/**
 * Graph Page - Main topology visualization page
 */

import React, { useState, useEffect } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { PluginPage, locationService } from '@grafana/runtime';
import { useStyles2, LoadingPlaceholder } from '@grafana/ui';
import { GraphCanvas } from '../components/GraphCanvas';
import { FilterBar } from '../components/FilterBar';
import { IndexerClient } from '../lib/indexerClient';
import { K8sResource, K8sEdge, FilterState, ViewScope, ExpansionState, Kind } from '../types';
import { computeAllAttachments, filterVisibleResources, simplifyEdges } from '../lib/attachments';

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
  `,
  content: css`
    display: flex;
    flex: 1;
    overflow: hidden;
  `,
  graphContainer: css`
    flex: 1;
    position: relative;
  `,
});

export default function Explorer() {
  // Get query params from URL
  const queryParams = locationService.getSearch();
  const params = {
    scope: queryParams.get('scope') || undefined,
    namespace: queryParams.get('namespace') || undefined,
    release: queryParams.get('release') || undefined,
    status: queryParams.get('status') || undefined,
    kind: queryParams.get('kind') || undefined,
    search: queryParams.get('search') || undefined,
    showProblemsOnly: queryParams.get('showProblemsOnly') || undefined,
    showClusterScoped: queryParams.get('showClusterScoped') || undefined,
  };
  const styles = useStyles2(getStyles);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resources, setResources] = useState<K8sResource[]>([]);
  const [edges, setEdges] = useState<K8sEdge[]>([]);
  const [viewScope, setViewScope] = useState<ViewScope>((params.scope as ViewScope) || ViewScope.Cluster);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [releases, setReleases] = useState<string[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>(params.namespace || '');
  const [selectedRelease, setSelectedRelease] = useState<string>(params.release || '');
  const [filters, setFilters] = useState<FilterState>({
    statusFilter: params.status || 'all',
    kindFilter: params.kind || 'all',
    searchQuery: params.search || '',
    showProblemsOnly: params.showProblemsOnly === 'true',
    showClusterScoped: params.showClusterScoped === 'true',
  });
  const [expansionState, setExpansionState] = useState<ExpansionState>(new Map());

  // Update URL when state changes
  useEffect(() => {
    const newParams = new URLSearchParams();
    
    if (viewScope) {
      newParams.set('scope', viewScope);
    }
    if (selectedNamespace) {
      newParams.set('namespace', selectedNamespace);
    }
    if (selectedRelease) {
      newParams.set('release', selectedRelease);
    }
    if (filters.statusFilter && filters.statusFilter !== 'all') {
      newParams.set('status', filters.statusFilter);
    }
    if (filters.kindFilter && filters.kindFilter !== 'all') {
      newParams.set('kind', filters.kindFilter);
    }
    if (filters.searchQuery) {
      newParams.set('search', filters.searchQuery);
    }
    if (filters.showProblemsOnly) {
      newParams.set('showProblemsOnly', 'true');
    }
    if (!filters.showClusterScoped) {
      newParams.set('showClusterScoped', 'false');
    }
    
    // Update URL without reloading
    const newSearch = newParams.toString();
    const currentSearch = locationService.getSearch().toString();
    if (newSearch !== currentSearch) {
      locationService.replace({ search: newSearch });
    }
  }, [viewScope, selectedNamespace, selectedRelease, filters]);

  // Load namespaces and releases on mount
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const client = IndexerClient.getInstance();
        const [ns, rel] = await Promise.all([
          client.listNamespaces(),
          client.listReleases(),
        ]);
        setNamespaces(ns);
        setReleases(rel);
      } catch (err) {
        console.error('Failed to load options:', err);
      }
    };
    loadOptions();
  }, []);

  // Load graph data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const client = IndexerClient.getInstance();
        const graph = await client.getGraph({
          scope: viewScope,
          namespaces: selectedNamespace ? [selectedNamespace] : undefined,
          release: selectedRelease || undefined,
        });

        setResources(graph.nodes);
        setEdges(graph.edges); // Use edges from server
      } catch (err) {
        console.error('Failed to load graph:', err);
        setError(err instanceof Error ? err.message : 'Failed to load graph data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [viewScope, selectedNamespace, selectedRelease]);

  // Apply filters
  const filteredResources = React.useMemo(() => {
    let filtered = resources;

    // Status filter
    if (filters.statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === filters.statusFilter);
    }

    // Kind filter
    if (filters.kindFilter !== 'all') {
      filtered = filtered.filter(r => r.kind === filters.kindFilter);
    }

    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.name.toLowerCase().includes(query) ||
        r.kind.toLowerCase().includes(query) ||
        r.namespace?.toLowerCase().includes(query)
      );
    }

    // Problems only filter
    if (filters.showProblemsOnly) {
      filtered = filtered.filter(
        (r) =>
          r.status === 'Error' ||
          r.status === 'Pending' ||
          (r.restartCount !== undefined && r.restartCount > 0) ||
          (r.replicasDesired !== undefined &&
            r.replicasReady !== undefined &&
            r.replicasReady < r.replicasDesired)
      );
    }

    // Cluster-scoped filter
    if (!filters.showClusterScoped && viewScope !== 'cluster') {
      filtered = filtered.filter((r) => !r.isClusterScoped);
    }

    return filtered;
  }, [resources, filters, viewScope]);

  // Compute attachments for all resources
  const attachmentsMap = React.useMemo(() => {
    return computeAllAttachments(resources, edges);
  }, [resources, edges]);

  // Filter visible resources based on expansion state
  // This determines which resources to actually render
  const visibleResources = React.useMemo(() => {
    return filterVisibleResources(filteredResources, resources, edges, expansionState);
  }, [filteredResources, resources, edges, expansionState]);

  // Filter edges to only include those between visible nodes
  const visibleEdges = React.useMemo(() => {
    const visibleUids = new Set<string>(visibleResources.map((resource) => resource.uid));
    return edges.filter((e) => visibleUids.has(e.from) && visibleUids.has(e.to));
  }, [edges, visibleResources]);

  // Simplify edges (connect to highest owner)
  const simplifiedEdges = React.useMemo(() => {
    return simplifyEdges(visibleEdges, resources, expansionState);
  }, [visibleEdges, resources, expansionState]);

  // Toggle attachment handler
  const handleToggleAttachment = React.useCallback((resourceUid: string, type: Kind) => {
    setExpansionState(prev => {
      const newState = new Map(prev);
      const current = newState.get(resourceUid) || new Set();
      const updated = new Set(current);
      
      if (updated.has(type)) {
        updated.delete(type);
      } else {
        updated.add(type);
      }
      
      if (updated.size === 0) {
        newState.delete(resourceUid);
      } else {
        newState.set(resourceUid, updated);
      }
      
      return newState;
    });
  }, []);

  // Get unique kinds and statuses for filter dropdowns
  const kindOptions = React.useMemo(() => {
    const kinds = new Set(resources.map((r) => r.kind));
    return [{ label: 'All Kinds', value: 'all' }, ...Array.from(kinds).sort().map((k) => ({ label: k, value: k }))];
  }, [resources]);

  const statusOptions = React.useMemo(() => {
    const statuses = new Set(resources.map((r) => r.status));
    return [
      { label: 'All Statuses', value: 'all' },
      ...Array.from(statuses).sort().map((s) => ({ label: s, value: s })),
    ];
  }, [resources]);

  const namespaceOptions = React.useMemo(() => {
    return [
      { label: 'All Namespaces', value: '' },
      ...namespaces.map((ns) => ({ label: ns, value: ns }))
    ];
  }, [namespaces]);

  const releaseOptions = React.useMemo(() => {
    return releases.map((rel) => ({ label: rel, value: rel }));
  }, [releases]);

  if (loading) {
    return (
      <PluginPage>
        <LoadingPlaceholder text="Loading Kubernetes resources..." />
      </PluginPage>
    );
  }

  if (error) {
    return (
      <PluginPage>
        <div>
          <h2>Error loading graph</h2>
          <p>{error}</p>
          <p>Make sure the Astrolabe server is accessible from Grafana&apos;s backend.</p>
          <p>The backend proxies requests to http://astrolabe:8080 by default.</p>
        </div>
      </PluginPage>
    );
  }

  return (
    <PluginPage layout={PageLayoutType.Canvas}>
      <div className={styles.container}>
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          viewScope={viewScope}
          onViewScopeChange={setViewScope}
          kindOptions={kindOptions}
          statusOptions={statusOptions}
          namespaceOptions={namespaceOptions}
          releaseOptions={releaseOptions}
          selectedNamespace={selectedNamespace}
          selectedRelease={selectedRelease}
          onNamespaceChange={setSelectedNamespace}
          onReleaseChange={setSelectedRelease}
          resourceCount={filteredResources.length}
        />
        <div className={styles.content}>
          <div className={styles.graphContainer}>
            <GraphCanvas 
              resources={visibleResources} 
              edges={simplifiedEdges}
              attachmentsMap={attachmentsMap}
              expansionState={expansionState}
              onToggleAttachment={handleToggleAttachment}
            />
          </div>
        </div>
      </div>
    </PluginPage>
  );
};
