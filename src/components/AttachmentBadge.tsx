/**
 * AttachmentBadge - Shows collapsible attachment count
 * Displays at bottom-right of parent node
 */

import React from 'react';
import { css, cx } from '@emotion/css';
import { Icon, useStyles2, Tooltip } from '@grafana/ui';
import { getResourceIcon } from 'utils/resourceIcons';
import { Kind } from '../constants';

interface AttachmentBadgeProps {
  kind: Kind;
  count?: number;
  expanded: boolean;
  onClick: () => void;
}

const getStyles = () => ({
  badge: css`
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 3px 6px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 3px;
    cursor: pointer;
    opacity: 0.7;
    transition: all 0.15s ease;
    font-size: 10px;
    font-weight: 600;
    
    &:hover {
      opacity: 1;
      transform: scale(1.05);
      background: rgba(255, 255, 255, 0.12);
    }
  `,
  expanded: css`
    background: rgba(52, 211, 153, 0.2);
    border: 1px solid rgba(52, 211, 153, 0.5);
    opacity: 1;
    
    &:hover {
      background: rgba(52, 211, 153, 0.25);
    }
  `,
  icon: css`
    font-size: 10px;
  `,
  count: css`
    font-size: 10px;
    font-weight: 700;
  `,
});

export const AttachmentBadge: React.FC<AttachmentBadgeProps> = ({ kind, count, expanded, onClick }) => {
  const styles = useStyles2(getStyles);
  const icon = getResourceIcon(kind);
  
  const tooltipContent = expanded 
    ? `Hide ${kind} (click to collapse)`
    : `Show ${kind} (click to expand)`;
  
  return (
    <Tooltip content={tooltipContent} placement="top">
      <div
        className={cx(styles.badge, { [styles.expanded]: expanded })}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <Icon name={icon as any} className={styles.icon} />
        {count !== undefined && count > 1 && (
          <span className={styles.count}>{count}</span>
        )}
      </div>
    </Tooltip>
  );
};
