import { buildRootUrl } from '@/lib/subdomain';
import { APP_NAME } from '@/lib/appConfig';

// Shown on a subdomain (or custom domain) that doesn't belong to any workspace.
export default function WorkspaceNotFound() {
  return (
    <main className="not-found">
      <div>
        <p className="not-found-code">?</p>
        <h1>There’s no workspace at this address</h1>
        <p>Check the link for typos. If your organization changed its address recently, ask your admin for the new one.</p>
        <div className="not-found-actions">
          <a className="btn btn-primary" href={buildRootUrl('/login')}>Find my workspace</a>
          <a className="btn btn-secondary" href={buildRootUrl('/')}>Go to {APP_NAME}</a>
        </div>
      </div>
    </main>
  );
}
