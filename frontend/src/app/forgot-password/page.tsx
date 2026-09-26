'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { api } from '@/api/client';
import { Button, Input } from '@/components/ui';
import { AuthShell, AuthAlert, apiErrorMessage } from '@/components/auth/AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle={sent ? undefined : "Enter the email you sign in with and we'll send you a link to choose a new password."}
      footer={<Link href="/login">Back to sign in</Link>}
    >
      {error && <AuthAlert tone="error">{error}</AuthAlert>}
      {sent ? (
        <AuthAlert tone="success">
          If an account exists for <strong>{email}</strong>, a reset link is on its way. It expires in 1 hour.
        </AuthAlert>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <Input label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus required />
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting && <Loader2 className="qf-spin" size={18} />}
            <span>{submitting ? 'Sending…' : 'Send reset link'}</span>
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
