import type { Metadata } from 'next';
import { Bricolage_Grotesque, Public_Sans } from 'next/font/google';
import './globals.css';
import './settings.css';
import './desk.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import ToastHost from '@/components/ui/ToastHost';
import { APP_NAME } from '@/lib/appConfig';

// Two families: Public Sans for UI/body (plain, highly legible - civic and
// healthcare signage heritage) and Bricolage Grotesque for headlines and big
// ticket numbers, where the type itself carries the personality.
const bodyFont = Public_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const displayFont = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-headline', display: 'swap', axes: ['opsz', 'wdth'] });

export const metadata: Metadata = {
  title: APP_NAME,
  description: `Professional queue management system for healthcare and services, powered by ${APP_NAME}`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
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
                var sessionToken = params.get('session');
                if (sessionToken) {
                  // New sign-up handed over from the root domain.
                  localStorage.setItem('token', sessionToken);
                  history.replaceState(null, '', window.location.pathname + window.location.search);
                } else if (impersonateToken) {
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
            <ToastHost />
          </SubscriptionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
