'use client';

import React from 'react';
import { Building2, Inbox, Settings } from 'lucide-react';
import { Button, Card, Badge, PageHeader, EmptyState } from '@/components/ui';

export default function StyleGuidePage() {
  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem' }}>
      <PageHeader
        title="Style Guide"
        subtitle="Internal reference for the shared UI component set — not linked from app navigation."
        actions={<Button variant="secondary" size="sm">Secondary action</Button>}
      />

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Buttons</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant="primary" size="sm">Primary sm</Button>
          <Button variant="primary" size="md">Primary md</Button>
          <Button variant="primary" size="lg">Primary lg</Button>
          <Button variant="secondary" size="md">Secondary</Button>
          <Button variant="ghost" size="md">Ghost</Button>
        </div>
      </section>

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Badges</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Badge tone="primary">Primary</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="error">Error</Badge>
          <Badge tone="neutral">Neutral</Badge>
        </div>
      </section>

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Cards</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          <Card style={{ padding: '1.5rem' }}>Static card</Card>
          <Card hoverable style={{ padding: '1.5rem' }}>Hoverable card</Card>
        </div>
      </section>

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Empty state</h2>
        <Card>
          <EmptyState
            icon={Inbox}
            title="No items yet"
            description="This is the shared empty-state pattern that replaces the 8 duplicated inline copies across the admin pages."
            action={{ label: 'Create one', onClick: () => {} }}
          />
        </Card>
      </section>

      <section>
        <h2 style={{ marginBottom: '1rem' }}>Icons</h2>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <Building2 size={24} />
          <Settings size={24} />
          <Inbox size={24} />
        </div>
      </section>
    </div>
  );
}
