'use client';

import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...rest }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className="field">
        {label && <label htmlFor={inputId} className="field-label">{label}</label>}
        <input {...rest} ref={ref} id={inputId} className={className} />
        {error && <span className="field-error">{error}</span>}
        {!error && hint && <span className="field-hint">{hint}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', id, ...rest }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className="field">
        {label && <label htmlFor={inputId} className="field-label">{label}</label>}
        <textarea {...rest} ref={ref} id={inputId} className={className} />
        {error && <span className="field-error">{error}</span>}
        {!error && hint && <span className="field-hint">{hint}</span>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, className = '', id, children, ...rest }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className="field">
        {label && <label htmlFor={inputId} className="field-label">{label}</label>}
        <select {...rest} ref={ref} id={inputId} className={className}>
          {children}
        </select>
        {error && <span className="field-error">{error}</span>}
        {!error && hint && <span className="field-hint">{hint}</span>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Input;
