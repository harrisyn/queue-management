'use client';

import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import AuthLayout from './AuthLayout';

interface AuthShellProps {
  title: string;
  subtitle?: React.ReactNode;
  brandName?: string;
  logoUrl?: string | null;
  panelTitle?: React.ReactNode;
  panelText?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** Account pages (invite, forgot/reset password) on the shared auth layout. */
export function AuthShell({ title, subtitle, brandName, logoUrl, panelTitle, panelText, footer, children }: AuthShellProps) {
  return (
    <AuthLayout orgName={brandName} logoUrl={logoUrl} panelTitle={panelTitle} panelText={panelText} footer={footer}>
      <h1>{title}</h1>
      {subtitle ? <p className="authx-sub">{subtitle}</p> : <div style={{ height: '1.5rem' }} />}
      {children}
    </AuthLayout>
  );
}

export function AuthAlert({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  const IconComponent = tone === 'error' ? AlertCircle : CheckCircle2;
  return (
    <div className={`authx-alert authx-alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
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
