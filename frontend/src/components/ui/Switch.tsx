'use client';

import React from 'react';

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: React.ReactNode;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, className = '', disabled, id, ...rest }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <label
        htmlFor={inputId}
        className={['switch-row', disabled ? 'switch-disabled' : '', className].filter(Boolean).join(' ')}
      >
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <input {...rest} ref={ref} id={inputId} type="checkbox" disabled={disabled} className="switch-input" />
          <span className="switch-track">
            <span className="switch-thumb" />
          </span>
        </span>
        {label && <span className="switch-label">{label}</span>}
      </label>
    );
  }
);

Switch.displayName = 'Switch';

export default Switch;
