import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="not-found">
      <div>
        <p className="not-found-code">404</p>
        <h1>There’s nothing at this address</h1>
        <p>If you were trying to join a queue, scan the QR code at the location again, or ask at the desk.</p>
        <div className="not-found-actions">
          <Link className="btn btn-primary" href="/">Go to the home page</Link>
          <Link className="btn btn-secondary" href="/locations">Find a location</Link>
        </div>
      </div>
    </main>
  );
}
