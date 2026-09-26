'use client';

import React, { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import api from '@/api/client';
import { PageHeader, Button, Switch } from '@/components/ui';
import { toast, errorMessage } from '@/lib/toast';

/** Which service sends "you're nearly up" texts and appointment reminders. */

interface ProviderRow {
  provider: 'twilio' | 'africastalking';
  configured: boolean;
  isActive: boolean;
  accountId: string | null;
  senderId: string | null;
  secretMasked: string | null;
  updatedAt: string | null;
}

const INFO = {
  twilio: {
    name: 'Twilio',
    note: 'Works worldwide. Use a Twilio phone number as the sender.',
    account: 'Account SID',
    secret: 'Auth token',
    sender: 'From number',
    senderHint: 'e.g. +15005550006',
  },
  africastalking: {
    name: "Africa's Talking",
    note: 'Good coverage and pricing across Africa. Use "sandbox" as the username to test.',
    account: 'Username',
    secret: 'API key',
    sender: 'Sender ID (optional)',
    senderHint: 'An approved short code or sender name',
  },
} as const;

function ProviderCard({ row, onSaved }: { row: ProviderRow; onSaved: (r: ProviderRow) => void }) {
  const info = INFO[row.provider];
  const [accountId, setAccountId] = useState(row.accountId || '');
  const [secret, setSecret] = useState('');
  const [senderId, setSenderId] = useState(row.senderId || '');
  const [isActive, setIsActive] = useState(row.isActive);
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);

  const save = async () => {
    setBusy('save');
    try {
      const saved = await api.saveSmsProvider(row.provider, { accountId, secret: secret || undefined, senderId, isActive });
      onSaved(saved);
      setSecret('');
      toast.success(`${info.name} saved.`);
    } catch (err) {
      toast.error(errorMessage(err, 'Couldn’t save.'));
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy('test');
    try {
      await api.testSmsProvider(row.provider, testTo);
      toast.success(`Test message sent to ${testTo}.`);
    } catch (err) {
      toast.error(errorMessage(err, 'The test message didn’t send.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="settings-panel sms-card" data-active={row.isActive}>
      <div className="today-panel-head">
        <h2>{info.name}</h2>
        {row.isActive && <span className="sms-live">Sending</span>}
      </div>
      <p className="settings-lede">{info.note}</p>
      <div className="settings-grid">
        <label className="settings-field"><span>{info.account}</span><input value={accountId} onChange={(e) => setAccountId(e.target.value)} autoComplete="off" /></label>
        <label className="settings-field">
          <span>{info.secret}</span>
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={row.secretMasked || ''} autoComplete="new-password" />
          {row.configured && <small>Leave blank to keep the saved one.</small>}
        </label>
        <label className="settings-field"><span>{info.sender}</span><input value={senderId} onChange={(e) => setSenderId(e.target.value)} placeholder={info.senderHint} /></label>
      </div>
      <div className="settings-switches">
        <Switch label="Send text messages with this provider" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
      </div>
      <div className="sms-actions">
        <Button onClick={save} disabled={busy !== null || !accountId.trim()}>{busy === 'save' ? 'Saving…' : 'Save'}</Button>
        {row.configured && (
          <div className="sms-test">
            <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="+233 20 000 0000" aria-label="Phone number for a test message" />
            <Button variant="secondary" onClick={test} disabled={busy !== null || !testTo.trim()}><Send size={15} /> {busy === 'test' ? 'Sending…' : 'Send a test'}</Button>
          </div>
        )}
      </div>
    </section>
  );
}

export default function SmsProvidersPage() {
  const [rows, setRows] = useState<ProviderRow[] | null>(null);
  const [envFallback, setEnvFallback] = useState(false);

  useEffect(() => {
    api.listSmsProviders()
      .then((d) => { setRows(d.providers); setEnvFallback(d.envFallback); })
      .catch(() => { setRows([]); toast.error('Couldn’t load the text message settings.'); });
  }, []);

  const onSaved = (saved: ProviderRow) =>
    setRows((list) => list?.map((r) => (r.provider === saved.provider ? saved : saved.isActive ? { ...r, isActive: false } : r)) || null);

  const anyActive = rows?.some((r) => r.isActive);

  return (
    <>
      <PageHeader title="Text messages" subtitle="The service that sends “you’re nearly up” texts and appointment reminders. Each text uses one of the organization’s message credits." />
      {rows && !anyActive && (
        <div className="upgrade-note" role="note">
          <span>{envFallback ? 'No provider is switched on here, so texts go through the Twilio account set in the server environment.' : 'No provider is set up, so no text messages are sent.'}</span>
        </div>
      )}
      {rows === null ? <div className="spinner" /> : (
        <div className="sms-grid">
          {rows.map((r) => <ProviderCard key={r.provider} row={r} onSaved={onSaved} />)}
        </div>
      )}
    </>
  );
}
