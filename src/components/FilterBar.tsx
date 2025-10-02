/**
 * FilterBar - Resource filtering controls
 * Extracted from SimplePanel.tsx
 */

import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { useStyles2, Select, Input, Stack, Icon, Checkbox, RadioButtonGroup } from '@grafana/ui';
import { FilterState, ViewScope } from '../types';

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  viewScope: ViewScope;
  onViewScopeChange: (scope: ViewScope) => void;
  kindOptions: Array<SelectableValue<string>>;
  statusOptions: Array<SelectableValue<string>>;
  resourceCount: number;
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    padding: ${theme.spacing(2)};
    background: ${theme.colors.background.secondary};
    border-bottom: 1px solid ${theme.colors.border.weak};
  `,
  resourceCount: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.fontWeightMedium};
    white-space: nowrap;
    margin-left: auto;
  `,
});

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFiltersChange,
  viewScope,
  onViewScopeChange,
  kindOptions,
  statusOptions,
  resourceCount,
}) => {
  const styles = useStyles2(getStyles);

  const scopeOptions = [
    { label: 'Cluster', value: 'cluster' },
    { label: 'Namespace', value: 'namespace' },
    { label: 'Release', value: 'release' },
  ];

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className={styles.container}>
      <Stack gap={2} direction="row" alignItems="center" wrap>
        <RadioButtonGroup
          options={scopeOptions}
          value={viewScope}
          onChange={(value) => onViewScopeChange(value as ViewScope)}
        />

        <Select
          options={statusOptions}
          value={filters.statusFilter}
          onChange={(v) => handleFilterChange('statusFilter', v.value || 'all')}
          width={20}
          placeholder="Status"
        />

        <Select
          options={kindOptions}
          value={filters.kindFilter}
          onChange={(v) => handleFilterChange('kindFilter', v.value || 'all')}
          width={20}
          placeholder="Kind"
        />

        <Input
          value={filters.searchQuery}
          onChange={(e) => handleFilterChange('searchQuery', e.currentTarget.value)}
          placeholder="Search..."
          prefix={<Icon name="search" />}
          width={25}
        />

        <Checkbox
          label="Problems only"
          value={filters.showProblemsOnly}
          onChange={(e) => handleFilterChange('showProblemsOnly', e.currentTarget.checked)}
        />

        {viewScope !== 'cluster' && (
          <Checkbox
            label="Show cluster-scoped"
            value={filters.showClusterScoped}
            onChange={(e) => handleFilterChange('showClusterScoped', e.currentTarget.checked)}
          />
        )}

        <div className={styles.resourceCount}>
          {resourceCount} resource{resourceCount !== 1 ? 's' : ''}
        </div>
      </Stack>
    </div>
  );
};
