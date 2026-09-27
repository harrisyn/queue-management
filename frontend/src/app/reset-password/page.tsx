'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { api } from '@/api/client';
import { Button, Input } from '@/components/ui';
import { AuthShell, AuthAlert, apiErrorMessage } from '@/components/auth/AuthShell';

function ResetPasswordForm() {
  const token = useSearchParams()?.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not reset your password. Please request a new link.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title="Reset link missing" footer={<Link href="/forgot-password">Request a new link</Link>}>
        <AuthAlert tone="error">This page needs the link from your reset email. Open the link again, or request a new one.</AuthAlert>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      footer={done ? undefined : <Link href="/forgot-password">Request a new link</Link>}
    >
      {error && <AuthAlert tone="error">{error}</AuthAlert>}
      {done ? (
        <>
          <AuthAlert tone="success">Your password has been updated.</AuthAlert>
          <Link href="/login" className="btn btn-primary btn-lg" style={{ width: '100%' }}>Sign in</Link>
        </>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <Input label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" hint="At least 8 characters" autoFocus required />
          <Input label="Confirm new password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting && <Loader2 className="qf-spin" size={18} />}
            <span>{submitting ? 'Saving…' : 'Update password'}</span>
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
