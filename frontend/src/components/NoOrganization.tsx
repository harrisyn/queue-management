import React from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';

/** Shown on organization pages to an account that isn't in one (a platform admin). */
export default function NoOrganization() {
  return (
    <Layout>
      <div className="panel today-empty">
        <h2>This page belongs to an organization</h2>
        <p>Your account isn’t part of one. To manage an organization’s setup, open it from the platform’s organization list.</p>
        <Link className="btn btn-secondary" href="/superadmin/organizations">Go to organizations</Link>
      </div>
    </Layout>
  );
}
