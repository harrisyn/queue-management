'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, LogOut, Repeat } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import DeskPanel, { useDeskShortcuts } from '@/components/desk/DeskPanel';
import DeskPicker from '@/components/desk/DeskPicker';
import { useDesk } from '@/components/desk/useDesk';
import { extractSubdomain } from '@/lib/subdomain';

/**
 * The desk on its own: for the pop-out window in browsers without
 * Picture-in-Picture, for embedding in other apps (see /embed/desk.js), and
 * for installing as a small app from the browser menu.
 */

function WidgetSignIn() {
  const { login } = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const slug = extractSubdomain(window.location.host);
      await login(email, password, slug && slug !== 'admin' ? { slug } : undefined);
    } catch {
      setError('That email and password don’t match an account here.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="widget-signin" onSubmit={submit}>
      <h1>Sign in to your desk</h1>
      <label className="settings-field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
      <label className="settings-field"><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
      {error && <p className="desk-msg desk-msg-bad" role="alert">{error}</p>}
      <button type="submit" className="desk-call" disabled={busy}>{busy ? <Loader2 size={18} className="qf-spin" /> : null}<span>Sign in</span></button>
    </form>
  );
}

function WidgetDesk() {
  const desk = useDesk();
  const { logout, isStaff } = useAuthContext();
  useDeskShortcuts(desk, null);

  useEffect(() => {
    document.title = desk.waiting.length ? `(${desk.waiting.length}) Desk` : 'Desk';
    // Embedded: let the host page's button show the count.
    if (window.parent !== window) window.parent.postMessage({ type: 'qms-desk', waiting: desk.waiting.length }, '*');
  }, [desk.waiting.length]);

  if (!isStaff) {
    return <div className="widget-msg"><p>This account can’t call from a desk. Ask an admin for staff access.</p><button type="button" className="link-button" onClick={logout}>Sign out</button></div>;
  }
  if (!desk.ready) return <div className="widget-msg"><Loader2 className="qf-spin" /></div>;
  if (!desk.desk) return <DeskPicker desk={desk} compact />;

  return (
    <>
      <header className="widget-head">
        <div>
          <strong>{desk.desk.label}</strong>
          <span>{desk.desk.serviceName}</span>
        </div>
        <button type="button" onClick={desk.leave} title="Switch desk" aria-label="Switch desk"><Repeat size={16} /></button>
        <button type="button" onClick={async () => { await desk.leave(); logout(); }} title="Leave desk and sign out" aria-label="Leave desk and sign out"><LogOut size={16} /></button>
      </header>
      <DeskPanel desk={desk} compact />
    </>
  );
}

export default function WidgetDeskPage() {
  const { isAuthenticated, loading } = useAuthContext();
  return (
    <main className="widget">
      {loading ? <div className="widget-msg"><Loader2 className="qf-spin" /></div> : isAuthenticated ? <WidgetDesk /> : <WidgetSignIn />}
    </main>
  );
}
