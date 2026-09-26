'use client';

import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { APP_NAME } from '@/lib/appConfig';

interface AuthShellProps {
  title: string;
  subtitle?: React.ReactNode;
  brandName?: string;
  logoUrl?: string | null;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** Single-column card on the dark public background, shared by the invite,
 * forgot-password and reset-password pages. */
export function AuthShell({ title, subtitle, brandName, logoUrl, footer, children }: AuthShellProps) {
  return (
    <main className="auth-shell">
      <div className="auth-shell-inner">
        <div className="auth-brand">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" />
          ) : (
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <rect width="48" height="48" rx="12" fill="#14b8a6" />
              <path d="M14 24C14 18.477 18.477 14 24 14V14C29.523 14 34 18.477 34 24V34H14V24Z" fill="white" fillOpacity="0.9" />
              <circle cx="24" cy="22" r="4" fill="#0d9488" />
            </svg>
          )}
          <span>{brandName || APP_NAME}</span>
        </div>
        <div className="auth-card">
          <h1>{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          {children}
        </div>
        {footer && <div className="auth-footer">{footer}</div>}
      </div>
    </main>
  );
}

export function AuthAlert({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  const IconComponent = tone === 'error' ? AlertCircle : CheckCircle2;
  return (
    <div className={`auth-alert auth-alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <IconComponent size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

/** Pulls the API's error message out of an axios error. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return e?.response?.data?.error || fallback;
}
