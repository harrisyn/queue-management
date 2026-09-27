'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { Icon } from './Icon';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className = '', disabled, id, ...rest }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <label
        htmlFor={inputId}
        className={['checkbox-row', disabled ? 'checkbox-disabled' : '', className].filter(Boolean).join(' ')}
      >
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <input {...rest} ref={ref} id={inputId} type="checkbox" disabled={disabled} className="checkbox-input" />
          <span className="checkbox-box">
            <Icon icon={Check} size={13} strokeWidth={3} />
          </span>
        </span>
        {label && <span className="checkbox-label">{label}</span>}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;
