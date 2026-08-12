'use client';

import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      className = '',
      type = 'button',
      children,
      ...rest
    },
    ref
  ) => {
    const classes = ['btn', variantClass[variant], sizeClass[size], className]
      .filter(Boolean)
      .join(' ');

    return (
      <button {...rest} ref={ref} type={type} className={classes}>
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
