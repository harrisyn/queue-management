'use client';

import { buildRootUrl } from '@/lib/subdomain';

export default function WorkspaceNotFoundPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '3rem',
        textAlign: 'center',
        maxWidth: '420px',
      }}>
        <h2 style={{ color: '#1e293b', marginTop: '1rem', fontSize: '1.5rem', fontWeight: 700 }}>
          Workspace not found
        </h2>
        <p style={{ color: '#64748b', marginTop: '0.5rem' }}>
          There&apos;s no organization at this address. Double-check the link,
          or head back to the main site.
        </p>
        <a
          href={buildRootUrl()}
          style={{
            display: 'inline-block',
            marginTop: '1.5rem',
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: 500,
          }}
        >
          Go to enqueueq.com
        </a>
      </div>
    </div>
  );
}
