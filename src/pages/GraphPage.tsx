/**
 * Graph Page - Main topology visualization page
 */

import React, { useState, useEffect } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, LoadingPlaceholder } from '@grafana/ui';
import { PluginPage } from '@grafana/runtime';
import { GraphCanvas } from '../components/GraphCanvas';
import { FilterBar } from '../components/FilterBar';
import { createIndexerClient } from '../lib/indexerClient';
import { buildEdges } from '../lib/edgeResolver';
import { K8sResource, K8sEdge, FilterState, ViewScope } from '../types';
import { filterByStatus, filterByKind, searchResources } from '../utils/resourceGrouping';

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

export const GraphPage: React.FC = () => {
  const styles = useStyles2(getStyles);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resources, setResources] = useState<K8sResource[]>([]);
  const [edges, setEdges] = useState<K8sEdge[]>([]);
  const [viewScope, setViewScope] = useState<ViewScope>('cluster');
  const [filters, setFilters] = useState<FilterState>({
    statusFilter: 'all',
    kindFilter: 'all',
    searchQuery: '',
    showProblemsOnly: false,
    showClusterScoped: true,
  });

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const client = createIndexerClient('http://localhost:8080');
        const graph = await client.getGraph({ scope: viewScope });

        setResources(graph.nodes);
        const computedEdges = buildEdges(graph.nodes);
        setEdges(computedEdges);
      } catch (err) {
        console.error('Failed to load graph:', err);
        setError(err instanceof Error ? err.message : 'Failed to load graph data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [viewScope]);

  // Apply filters
  const filteredResources = React.useMemo(() => {
    let filtered = resources;

    // Status filter
    filtered = filterByStatus(filtered, filters.statusFilter);

    // Kind filter
    filtered = filterByKind(filtered, filters.kindFilter);

    // Search filter
    filtered = searchResources(filtered, filters.searchQuery);

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

  // Filter edges to only include those between visible nodes
  const filteredEdges = React.useMemo(() => {
    const visibleUids = new Set(filteredResources.map((r) => r.uid));
    return edges.filter((e) => visibleUids.has(e.from) && visibleUids.has(e.to));
  }, [edges, filteredResources]);

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
          <p>Make sure the kubernetes-state-server is running at http://localhost:8080</p>
        </div>
      </PluginPage>
    );
  }

  return (
    <PluginPage>
      <div className={styles.container}>
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          viewScope={viewScope}
          onViewScopeChange={setViewScope}
          kindOptions={kindOptions}
          statusOptions={statusOptions}
          resourceCount={filteredResources.length}
        />
        <div className={styles.content}>
          <div className={styles.graphContainer}>
            <GraphCanvas resources={filteredResources} edges={filteredEdges} />
          </div>
        </div>
      </div>
    </PluginPage>
  );
};
