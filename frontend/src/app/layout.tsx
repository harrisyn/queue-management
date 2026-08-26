import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';

export const metadata: Metadata = {
  title: 'QueueFlow',
  description: 'Professional queue management system for healthcare and services',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        {/*
          Cross-subdomain impersonation handoff. localStorage/sessionStorage
          are per-origin, so a token minted on admin.<domain> can't just be
          read on <slug>.<domain> - it's carried across in the URL fragment
          (never sent to the server, unlike a query string) and applied here,
          synchronously, before React hydrates and AuthProvider's mount
          effect reads localStorage for the first time.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
              try {
                var hash = window.location.hash;
                if (!hash || hash.length < 2) return;
                var params = new URLSearchParams(hash.slice(1));
                var impersonateToken = params.get('impersonate');
                var restoreToken = params.get('restore');
                if (impersonateToken) {
                  var superToken = params.get('superToken') || '';
                  var orgId = params.get('orgId') || '';
                  var orgName = params.get('orgName') || '';
                  localStorage.setItem('token', impersonateToken);
                  if (superToken) {
                    sessionStorage.setItem('impersonation', JSON.stringify({
                      returnToken: superToken,
                      returnPath: orgId ? ('/superadmin/organizations/' + orgId) : '/superadmin/organizations',
                      orgName: orgName
                    }));
                  }
                  history.replaceState(null, '', window.location.pathname + window.location.search);
                } else if (restoreToken) {
                  localStorage.setItem('token', restoreToken);
                  sessionStorage.removeItem('impersonation');
                  history.replaceState(null, '', window.location.pathname + window.location.search);
                }
              } catch (e) {}
            })();`,
          }}
        />
        <AuthProvider>
          <SubscriptionProvider>
            {children}
          </SubscriptionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
