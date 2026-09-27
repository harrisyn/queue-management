'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Send, ChevronDown, ChevronRight, Newspaper } from 'lucide-react';
import api, { AiInsight, AiStatus } from '@/api/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button, Switch } from '@/components/ui';
import { apiErrorMessage } from '@/components/auth/AuthShell';

const SUGGESTIONS = [
  'How did this week compare with last week?',
  'Which service had the longest waits, and at what times?',
  'When should we add staff?',
  'How many appointments were never checked in this month?',
];

// Minimal, safe markdown: paragraphs, "- " bullets, **bold**. No HTML is
// ever injected from model output.
function inline(text: string, key: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong>
      : <React.Fragment key={`${key}-${i}`}>{part}</React.Fragment>
  );
}

export function AiText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      const items = bullets;
      blocks.push(<ul key={`ul-${blocks.length}`}>{items.map((b, i) => <li key={i}>{inline(b, `li-${blocks.length}-${i}`)}</li>)}</ul>);
      bullets = [];
    }
  };
  text.split('\n').forEach((raw) => {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/) || line.match(/^\d+\.\s+(.*)$/);
    if (bullet) return bullets.push(bullet[1]);
    flush();
    if (!line) return;
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    blocks.push(heading
      ? <p key={`h-${blocks.length}`} className="ai-heading">{inline(heading[1], `h-${blocks.length}`)}</p>
      : <p key={`p-${blocks.length}`}>{inline(line, `p-${blocks.length}`)}</p>);
  });
  flush();
  return <div className="ai-text">{blocks}</div>;
}

function Sources({ insight }: { insight: AiInsight }) {
  const [open, setOpen] = useState(false);
  if (!insight.sources?.length) return null;
  return (
    <div className="ai-sources">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Show the numbers ({insight.sources.length})
      </button>
      {open && insight.sources.map((s, i) => (
        <details key={i} className="ai-source">
          <summary><code>{s.tool}</code> {Object.keys(s.input || {}).length ? <span className="muted">{JSON.stringify(s.input)}</span> : null}</summary>
          <pre>{JSON.stringify(s.output, null, 2)}</pre>
        </details>
      ))}
    </div>
  );
}

export default function AiInsightsPanel({ locationId }: { locationId?: string }) {
  const { user } = useAuthContext();
  const canToggle = user?.role === 'ORG_ADMIN' || user?.role === 'SUPER_ADMIN';
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState<AiInsight | null>(null);
  const [digest, setDigest] = useState<AiInsight | null>(null);
  const [toggling, setToggling] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const s = await api.getAiStatus();
      setStatus(s);
      if (s.enabled && s.planIncludesAi) {
        const [latestDigest] = await api.getAiInsights('DIGEST', 1);
        setDigest(latestDigest ?? null);
      }
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const ask = async (q: string) => {
    if (q.trim().length < 3) return;
    setAsking(true);
    setError('');
    try {
      setAnswer(await api.askAi(q.trim(), locationId));
    } catch (err) {
      setError(apiErrorMessage(err, 'The AI assistant could not answer right now.'));
    } finally {
      setAsking(false);
    }
  };

  const toggle = async (enabled: boolean) => {
    setToggling(true);
    try {
      await api.updateAiSettings(enabled);
      await loadStatus();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not change the AI setting.'));
    } finally {
      setToggling(false);
    }
  };

  if (!status) return null;

  const header = (
    <div className="panel-header">
      <h2 className="panel-title row"><Sparkles size={18} color="var(--primary-600)" /> AI insights</h2>
      {canToggle && status.planIncludesAi && (
        <Switch label={status.enabled ? 'On' : 'Off'} checked={status.enabled} disabled={toggling} onChange={(e) => toggle(e.target.checked)} />
      )}
    </div>
  );

  if (!status.planIncludesAi) {
    return (
      <div className="panel ai-panel">
        {header}
        <div className="panel-body muted">
          Ask questions about your queues in plain language and get a daily summary of bottlenecks and staffing. Available on plans with AI-assisted analytics.{' '}
          {canToggle && <Link href="/admin/billing" style={{ color: 'var(--primary-700)', fontWeight: 500 }}>See plans</Link>}
        </div>
      </div>
    );
  }

  if (!status.enabled) {
    return (
      <div className="panel ai-panel">
        {header}
        <div className="panel-body muted">
          {canToggle
            ? 'Turn this on to ask questions about your queues and receive a daily digest. Only aggregated statistics are shared with the AI provider, never anyone’s personal details.'
            : 'An organization admin can turn on AI insights for your organization.'}
          {error && <div className="inline-alert inline-alert-error" style={{ marginTop: '0.75rem' }}>{error}</div>}
        </div>
      </div>
    );
  }

  if (!status.providerConfigured) {
    return (
      <div className="panel ai-panel">
        {header}
        <div className="panel-body muted">AI insights are switched on, but the platform administrator hasn&apos;t connected an AI provider yet.</div>
      </div>
    );
  }

  return (
    <div className="panel ai-panel">
      {header}
      <div className="panel-body stack">
        <form className="ai-ask" onSubmit={(e) => { e.preventDefault(); ask(question); }}>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about waits, busy hours, no-shows, staffing…"
            aria-label="Ask a question about your queues"
            maxLength={1000}
          />
          <Button type="submit" disabled={asking || question.trim().length < 3}>
            {asking ? <span className="spinner spinner-sm" style={{ borderTopColor: 'white' }} /> : <Send size={16} />}
            <span>{asking ? 'Thinking…' : 'Ask'}</span>
          </Button>
        </form>
        {!answer && !asking && (
          <div className="row">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="ai-chip" onClick={() => { setQuestion(s); ask(s); }}>{s}</button>
            ))}
          </div>
        )}
        {error && <div className="inline-alert inline-alert-error" role="alert">{error}</div>}
        {answer && (
          <div className="ai-answer">
            <p className="ai-question">{answer.question}</p>
            <AiText text={answer.answer} />
            <Sources insight={answer} />
          </div>
        )}
        {digest && (
          <div className="ai-digest">
            <p className="ai-question row"><Newspaper size={15} /> Daily digest · {new Date(digest.createdAt).toLocaleDateString([], { dateStyle: 'medium' })}</p>
            <AiText text={digest.answer} />
            <Sources insight={digest} />
          </div>
        )}
      </div>
    </div>
  );
}
