'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  icon: LucideIcon;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({
  icon: IconComponent,
  size = 20,
  color,
  strokeWidth = 2,
  className,
  ...rest
}) => {
  return (
    <IconComponent
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={className}
      {...rest}
    />
  );
};

export default Icon;
