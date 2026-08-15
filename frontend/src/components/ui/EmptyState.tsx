'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from './Button';
import { Icon } from './Icon';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: IconComponent,
  title,
  description,
  action,
}) => {
  return (
    <div className="empty-state">
      <Icon icon={IconComponent} size={48} strokeWidth={1.5} className="empty-state-icon" />
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-description">{description}</p>}
      {action && (
        <Button
          variant="primary"
          size="md"
          onClick={action.onClick}
          className="empty-state-action"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
