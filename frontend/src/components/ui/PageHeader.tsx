'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Icon } from './Icon';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, icon, actions }) => {
  return (
    <div className="page-header">
      <div className="page-header-left">
        {icon && (
          <div className="page-header-icon">
            <Icon icon={icon} size={24} />
          </div>
        )}
        <div>
          <h1 className="page-header-title">{title}</h1>
          {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
};

export default PageHeader;
