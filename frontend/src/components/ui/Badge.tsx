'use client';

import React from 'react';

export type BadgeTone = 'primary' | 'success' | 'warning' | 'error' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneClass: Record<BadgeTone, string> = {
  primary: 'badge-primary',
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
  neutral: 'badge-neutral',
};

export const Badge: React.FC<BadgeProps> = ({
  tone = 'neutral',
  className = '',
  children,
  ...rest
}) => {
  const classes = ['badge', toneClass[tone], className].filter(Boolean).join(' ');

  return (
    <span {...rest} className={classes}>
      {children}
    </span>
  );
};

export default Badge;
