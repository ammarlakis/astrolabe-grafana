/**
 * GraphNode - React Flow node component
 * Simplified version of ResourceBox for graph visualization
 */

import React from 'react';
import { Handle, Position } from 'reactflow';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2, Tooltip } from '@grafana/ui';
import { K8sResource, ResourceAttachments } from '../types';
import { getStatusColors, ResourceStatus } from '../utils/statusColors';
import { getResourceIcon } from '../utils/resourceIcons';
import { hasStatus } from '../utils/resourceTypes';
import { AttachmentBadge } from './AttachmentBadge';
import { Kind } from '../constants';

interface GraphNodeProps {
  data: {
    resource: K8sResource;
    attachments?: ResourceAttachments;
    expandedAttachments?: Set<Kind>;
    onToggleAttachment?: (type: Kind) => void;
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  node: css`
    padding: ${theme.spacing(1.5)};
    border-radius: ${theme.shape.radius.default};
    border: 2px solid;
    background: ${theme.colors.background.primary};
    width: 220px;
    height: 100px;
    box-shadow: ${theme.shadows.z1};
    cursor: pointer;
    overflow: hidden;
    position: relative;

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
    max-width: 150px;
  `,
  namespace: css`
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.secondary};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 150px;
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
  badges: css`
    position: absolute;
    bottom: 4px;
    right: 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    max-width: 80px;
    justify-content: flex-end;
  `,
});

export const GraphNode: React.FC<GraphNodeProps> = ({ data }) => {
  const styles = useStyles2(getStyles);
  const theme = useStyles2((t) => t);
  const { resource, attachments, expandedAttachments, onToggleAttachment } = data;

  const statusColors = getStatusColors(resource.status as ResourceStatus, theme);
  const iconName = getResourceIcon(resource.kind as Kind) as any;
  
  const tooltipContent = (
    <div>
      <div><strong>{resource.kind}:</strong> {resource.name}</div>
      {resource.namespace && <div><strong>Namespace:</strong> {resource.namespace}</div>}
      {resource.status && <div><strong>Status:</strong> {resource.status}</div>}
    </div>
  );

  return (
    <>
      {/* Invisible handles for React Flow connections */}
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{ opacity: 0, pointerEvents: 'none' }}
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        style={{ opacity: 0, pointerEvents: 'none' }}
      />
      
      <Tooltip content={tooltipContent} placement="top">
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
            <div className={styles.name}>
              {resource.name}
            </div>
            {resource.namespace && (
              <div className={styles.namespace}>
                {resource.namespace}
              </div>
            )}
          </div>
        </div>

        <div className={styles.metadata}>
          {resource.replicasDesired !== undefined && (
            <div className={styles.metadataItem}>
              <Icon name="copy" size="sm" />
              <span>
                {resource.replicasReady}/{resource.replicasDesired}
              </span>
            </div>
          )}
          {resource.restartCount !== undefined && resource.restartCount > 0 && (
            <div className={styles.metadataItem}>
              <Icon name="sync" size="sm" />
              <span>{resource.restartCount}</span>
            </div>
          )}
        </div>
        
        {/* Attachment badges */}
        {attachments && onToggleAttachment && (
          <div className={styles.badges}>
            {attachments.replicaSets && attachments.replicaSets.length > 0 && (
              <AttachmentBadge
                kind={Kind.ReplicaSet}
                count={attachments.replicaSets.length}
                expanded={expandedAttachments?.has(Kind.ReplicaSet) || false}
                onClick={() => onToggleAttachment(Kind.ReplicaSet)}
              />
            )}
            {attachments.pods && attachments.pods.length > 0 && (
              <AttachmentBadge
                kind={Kind.Pod}
                count={attachments.pods.length}
                expanded={expandedAttachments?.has(Kind.Pod) || false}
                onClick={() => onToggleAttachment(Kind.Pod)}
              />
            )}
            {attachments.endpointSlices && attachments.endpointSlices.length > 0 && (
              <AttachmentBadge
                kind={Kind.EndpointSlice}
                count={attachments.endpointSlices.length}
                expanded={expandedAttachments?.has(Kind.EndpointSlice) || false}
                onClick={() => onToggleAttachment(Kind.EndpointSlice)}
              />
            )}
            {attachments.configMaps && attachments.configMaps.length > 0 && (
              <AttachmentBadge
                kind={Kind.ConfigMap}
                count={attachments.configMaps.length}
                expanded={expandedAttachments?.has(Kind.ConfigMap) || false}
                onClick={() => onToggleAttachment(Kind.ConfigMap)}
              />
            )}
            {attachments.secrets && attachments.secrets.length > 0 && (
              <AttachmentBadge
                kind={Kind.Secret}
                count={attachments.secrets.length}
                expanded={expandedAttachments?.has(Kind.Secret) || false}
                onClick={() => onToggleAttachment(Kind.Secret)}
              />
            )}
            {attachments.serviceAccounts && attachments.serviceAccounts.length > 0 && (
              <AttachmentBadge
                kind={Kind.ServiceAccount}
                expanded={expandedAttachments?.has(Kind.ServiceAccount) || false}
                onClick={() => onToggleAttachment(Kind.ServiceAccount)}
              />
            )}
            {attachments.pvcs && attachments.pvcs.length > 0 && (
              <AttachmentBadge
                kind={Kind.PersistentVolumeClaim}
                count={attachments.pvcs.length}
                expanded={expandedAttachments?.has(Kind.PersistentVolumeClaim) || false}
                onClick={() => onToggleAttachment(Kind.PersistentVolumeClaim)}
              />
            )}
            {attachments.pvs && attachments.pvs.length > 0 && (
              <AttachmentBadge
                kind={Kind.PersistentVolume}
                expanded={expandedAttachments?.has(Kind.PersistentVolume) || false}
                onClick={() => onToggleAttachment(Kind.PersistentVolume)}
              />
            )}
            {attachments.storageClasses && attachments.storageClasses.length > 0 && (
              <AttachmentBadge
                kind={Kind.StorageClass}
                expanded={expandedAttachments?.has(Kind.StorageClass) || false}
                onClick={() => onToggleAttachment(Kind.StorageClass)}
              />
            )}
          </div>
        )}
      </div>
    </Tooltip>
    </>
  );
};
