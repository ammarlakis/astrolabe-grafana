/**
 * GraphNode - React Flow node component
 * Simplified version of ResourceBox for graph visualization
 */

import React from 'react';
import { Handle, Position } from 'reactflow';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import { K8sResource } from '../types';
import { getStatusColors, ResourceStatus } from '../utils/statusColors';
import { getResourceIcon } from '../utils/resourceIcons';
import { hasStatus } from '../utils/resourceTypes';

interface GraphNodeProps {
  data: {
    resource: K8sResource;
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  node: css`
    padding: ${theme.spacing(1.5)};
    border-radius: ${theme.shape.radius.default};
    border: 2px solid;
    background: ${theme.colors.background.primary};
    min-width: 200px;
    box-shadow: ${theme.shadows.z1};
    cursor: pointer;

    &:hover {
      box-shadow: ${theme.shadows.z3};
    }
  `,
  header: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(0.5)};
  `,
  kind: css`
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.secondary};
    font-weight: ${theme.typography.fontWeightMedium};
  `,
  name: css`
    font-size: ${theme.typography.body.fontSize};
    font-weight: ${theme.typography.fontWeightBold};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  statusBadge: css`
    position: absolute;
    top: ${theme.spacing(0.5)};
    right: ${theme.spacing(0.5)};
    padding: ${theme.spacing(0.25, 0.75)};
    border-radius: ${theme.shape.radius.default};
    font-size: ${theme.typography.bodySmall.fontSize};
    color: #fff;
    font-weight: ${theme.typography.fontWeightMedium};
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `,
  metadata: css`
    display: flex;
    gap: ${theme.spacing(1)};
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.secondary};
    margin-top: ${theme.spacing(0.5)};
  `,
  metadataItem: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(0.5)};
  `,
});

export const GraphNode: React.FC<GraphNodeProps> = ({ data }) => {
  const styles = useStyles2(getStyles);
  const theme = useStyles2((t) => t);
  const { resource } = data;

  const statusColors = getStatusColors(resource.status as ResourceStatus, theme);
  const iconName = getResourceIcon(resource.kind) as any;

  return (
    <>
      <Handle type="target" position={Position.Left} />
      <div
        className={styles.node}
        style={{
          borderColor: statusColors.border,
          backgroundColor: statusColors.background,
        }}
      >
        {hasStatus(resource.kind) && (
          <div className={styles.statusBadge} style={{ backgroundColor: statusColors.border }}>
            {resource.status}
          </div>
        )}

        <div className={styles.header}>
          <Icon name={iconName} size="lg" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.kind}>{resource.kind}</div>
            <div className={styles.name} title={resource.name}>
              {resource.name}
            </div>
          </div>
        </div>

        <div className={styles.metadata}>
          {resource.namespace && (
            <div className={styles.metadataItem}>
              <Icon name="folder" size="sm" />
              <span>{resource.namespace}</span>
            </div>
          )}
          {resource.age && (
            <div className={styles.metadataItem}>
              <Icon name="clock-nine" size="sm" />
              <span>{resource.age}</span>
            </div>
          )}
        </div>

        {resource.replicasDesired !== undefined && (
          <div className={styles.metadata}>
            <div className={styles.metadataItem}>
              <Icon name="copy" size="sm" />
              <span>
                {resource.replicasReady}/{resource.replicasDesired}
              </span>
            </div>
          </div>
        )}

        {resource.restartCount !== undefined && resource.restartCount > 0 && (
          <div className={styles.metadata}>
            <div className={styles.metadataItem}>
              <Icon name="sync" size="sm" />
              <span>{resource.restartCount} restarts</span>
            </div>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </>
  );
};
