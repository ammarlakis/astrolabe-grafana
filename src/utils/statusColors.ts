/**
 * Status color utilities for resource visualization
 * Uses Grafana's semantic color palette
 */

import { GrafanaTheme2 } from '@grafana/data';

export type ResourceStatus = 'Ready' | 'Error' | 'Pending' | 'Unknown';

export interface StatusColors {
  background: string;
  border: string;
  text: string;
}

/**
 * Gets colors for a given resource status using Grafana theme
 */
export function getStatusColors(status: ResourceStatus, theme?: GrafanaTheme2): StatusColors {
  if (!theme) {
    // Fallback colors if theme not available
    switch (status) {
      case 'Ready':
        return { background: 'rgba(115, 191, 105, 0.1)', border: '#73BF69', text: '#73BF69' };
      case 'Error':
        return { background: 'rgba(242, 73, 92, 0.1)', border: '#F2495C', text: '#F2495C' };
      case 'Pending':
        return { background: 'rgba(255, 152, 48, 0.1)', border: '#FF9830', text: '#FF9830' };
      default:
        return { background: 'rgba(204, 204, 220, 0.1)', border: '#CCCCDC', text: '#8E8E8E' };
    }
  }
  
  switch (status) {
    case 'Ready':
      return {
        background: theme.colors.success.transparent,
        border: theme.colors.success.border,
        text: theme.colors.success.text,
      };
    case 'Error':
      return {
        background: theme.colors.error.transparent,
        border: theme.colors.error.border,
        text: theme.colors.error.text,
      };
    case 'Pending':
      return {
        background: theme.colors.warning.transparent,
        border: theme.colors.warning.border,
        text: theme.colors.warning.text,
      };
    case 'Unknown':
    default:
      return {
        background: theme.colors.secondary.transparent,
        border: theme.colors.border.medium,
        text: theme.colors.text.secondary,
      };
  }
}

/**
 * Gets a simple status color (for icons, badges, etc.)
 */
export function getStatusColor(status: ResourceStatus): string {
  switch (status) {
    case 'Ready':
      return '#4CAF50';
    case 'Error':
      return '#F44336';
    case 'Pending':
      return '#FF9800';
    case 'Unknown':
    default:
      return '#9E9E9E';
  }
}

/**
 * Gets a status icon name
 */
export function getStatusIcon(status: ResourceStatus): string {
  switch (status) {
    case 'Ready':
      return 'check-circle';
    case 'Error':
      return 'exclamation-circle';
    case 'Pending':
      return 'clock-nine';
    case 'Unknown':
    default:
      return 'question-circle';
  }
}
