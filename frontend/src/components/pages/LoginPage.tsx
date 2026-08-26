'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { QrCode, Zap, Bell, Check, X, Loader2, ArrowRight } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { extractSubdomain, extractCustomDomainCandidate, buildTenantUrl, buildRootUrl } from '@/lib/subdomain';
import { api } from '@/api/client';
import { Button, Icon } from '@/components/ui';

type SlugStatus = 'idle' | 'checking' | 'found' | 'not-found';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [subdomain, setSubdomain] = useState<string | null>(null);
  const [hostChecked, setHostChecked] = useState(false);
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [orgName, setOrgName] = useState('');
  const [redirecting, setRedirecting] = useState(false);
  const [branding, setBranding] = useState<{ logoUrl?: string | null; primaryColor?: string | null } | null>(null);
  const { login } = useAuthContext();
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const host = window.location.host;
    const sub = extractSubdomain(host);
    if (sub) {
      setSubdomain(sub);
      setHostChecked(true);
      return;
    }

    // Not a <slug>.APP_DOMAIN host - it might still be a verified custom
    // domain an org has pointed at this app. Resolve it the same way, then
    // treat its slug exactly like a subdomain for the rest of this page.
    const candidate = extractCustomDomainCandidate(host);
    if (!candidate) {
      setSubdomain(null);
      setHostChecked(true);
      return;
    }
    api.getOrgByDomain(candidate)
      .then((org) => {
        setSubdomain(org?.slug ?? null);
        setHostChecked(true);
      })
      .catch(() => {
        setSubdomain(null);
        setHostChecked(true);
      });
  }, []);

  useEffect(() => {
    if (!subdomain || subdomain === 'admin') return;
    api.getOrgBySlug(subdomain)
      .then((org) => {
        if (org) setBranding({ logoUrl: org.logoUrl, primaryColor: org.primaryColor });
      })
      .catch(() => {
        // No branding available - fall back to defaults.
      });
  }, [subdomain]);

  // Live-validate the workspace slug as the user types, so a typo surfaces
  // before the full-page redirect (and the resulting workspace-not-found bounce).
  useEffect(() => {
    const slug = workspaceSlug.trim().toLowerCase();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!slug) {
      setSlugStatus('idle');
      setOrgName('');
      return;
    }

    setSlugStatus('checking');
    const requestId = ++requestIdRef.current;

    debounceRef.current = setTimeout(async () => {
      try {
        const org = await api.getOrgBySlug(slug);
        if (requestId !== requestIdRef.current) return;
        if (org) {
          setSlugStatus('found');
          setOrgName(org.name);
        } else {
          setSlugStatus('not-found');
          setOrgName('');
        }
      } catch {
        if (requestId !== requestIdRef.current) return;
        // Network hiccup — don't block the user, let submit attempt the redirect.
        setSlugStatus('idle');
        setOrgName('');
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [workspaceSlug]);

  const handleFindWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    const slug = workspaceSlug.trim().toLowerCase();
    if (!slug || slugStatus === 'not-found') return;

    setRedirecting(true);
    window.setTimeout(() => {
      window.location.href = buildTenantUrl(slug, '/login');
    }, 550);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const options = subdomain === 'admin'
        ? { adminLogin: true }
        : subdomain
          ? { slug: subdomain }
          : undefined;
      const success = await login(email, password, options);
      if (success) {
        router.push('/');
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const isLookupStep = hostChecked && !subdomain;

  return (
    <div style={pageStyle}>
      {/* Background decoration */}
      <div style={bgPattern} />
      <div style={bgGradient} />

      {/* Main Container */}
      <div style={containerStyle}>
        {/* Left Side - Branding */}
        <div style={brandingSection}>
          <div style={logoContainer}>
            <div style={logoIcon}>
              {branding?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl} alt="Organization logo" style={{ height: '48px', maxWidth: '160px', objectFit: 'contain' }} />
              ) : (
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect width="48" height="48" rx="12" fill={branding?.primaryColor || '#14b8a6'} />
                  <path d="M14 24C14 18.477 18.477 14 24 14V14C29.523 14 34 18.477 34 24V34H14V24Z" fill="white" fillOpacity="0.9"/>
                  <circle cx="24" cy="22" r="4" fill="#0d9488"/>
                </svg>
              )}
            </div>
            <span style={logoText}>QueueFlow</span>
          </div>

          <h1 style={heroTitle}>
            Smart Queue<br />
            Management
          </h1>

          <p style={heroSubtitle}>
            Streamline your waiting experience. Join queues remotely,
            get real-time updates, and never wait in line again.
          </p>

          <div style={featureList}>
            <div style={featureItem}>
              <Icon icon={QrCode} size={20} color="#2dd4bf" />
              <span>Scan QR to join queue</span>
            </div>
            <div style={featureItem}>
              <Icon icon={Zap} size={20} color="#2dd4bf" />
              <span>Real-time updates</span>
            </div>
            <div style={featureItem}>
              <Icon icon={Bell} size={20} color="#2dd4bf" />
              <span>Turn notifications</span>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div style={formSection}>
          <div style={formCard}>
            <div style={formHeader}>
              <h2 style={formTitle}>
                {subdomain === 'admin' ? 'Superadmin sign in' : isLookupStep ? 'Find your workspace' : 'Operator sign in'}
              </h2>
              <p style={formSubtitle}>
                {subdomain === 'admin'
                  ? 'Sign in with your superadmin account to manage organizations and plans.'
                  : isLookupStep
                    ? 'Sign-in is scoped to your organization\'s workspace. Enter your workspace URL to continue.'
                    : 'Sign in to your staff/admin account to manage queues and services.'}
              </p>
            </div>

            {error && (
              <div style={errorAlert}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0 }}>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {isLookupStep ? (
              redirecting ? (
                <div style={redirectingBox}>
                  <Loader2 className="qf-spin" size={22} color="#2dd4bf" />
                  <div>
                    <div style={redirectingTitle}>Taking you to {orgName || 'your workspace'}</div>
                    <div style={redirectingSubtitle}>{buildTenantUrl(workspaceSlug.trim().toLowerCase(), '')}</div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleFindWorkspace} style={formStyle}>
                  <div style={fieldGroup}>
                    <label style={labelStyle}>Workspace URL</label>
                    <div style={inputWrapper}>
                      <input
                        type="text"
                        value={workspaceSlug}
                        onChange={(e) => setWorkspaceSlug(e.target.value)}
                        placeholder="your-org"
                        className="qf-input"
                        style={{
                          ...inputStyle,
                          paddingLeft: '1rem',
                          paddingRight: '2.75rem',
                        }}
                        autoFocus
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        required
                      />
                      <span style={slugSuffix}>.queueflow.app</span>
                      <span style={slugStatusIcon}>
                        {slugStatus === 'checking' && <Loader2 className="qf-spin" size={18} color="#9ca3af" />}
                        {slugStatus === 'found' && <Icon icon={Check} size={18} color="#059669" />}
                        {slugStatus === 'not-found' && <Icon icon={X} size={18} color="#dc2626" />}
                      </span>
                    </div>
                    {slugStatus === 'found' && (
                      <p style={slugHintSuccess}>That&apos;s {orgName} &mdash; continue to sign in.</p>
                    )}
                    {slugStatus === 'not-found' && (
                      <p style={slugHintError}>No workspace found at this address. Check the spelling and try again.</p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={!workspaceSlug.trim() || slugStatus === 'not-found' || slugStatus === 'checking'}
                    style={{ width: '100%' }}
                  >
                    <span>Continue</span>
                    <Icon icon={ArrowRight} size={18} />
                  </Button>
                </form>
              )
            ) : (
            <form onSubmit={handleSubmit} style={formStyle}>
              <div style={fieldGroup}>
                <label style={labelStyle}>Email address</label>
                <div style={inputWrapper}>
                  <svg style={inputIconStyle} width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="qf-input"
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              <div style={fieldGroup}>
                <div style={labelRow}>
                  <label style={labelStyle}>Password</label>
                  <Link href="/forgot-password" style={forgotLink}>Forgot password?</Link>
                </div>
                <div style={inputWrapper}>
                  <svg style={inputIconStyle} width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="qf-input"
                    style={inputStyle}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={togglePasswordBtn}
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={loading}
                style={{ width: '100%' }}
              >
                {loading ? (
                  <>
                    <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </>
                )}
              </Button>

              {subdomain && subdomain !== 'admin' && (
                <a href={buildRootUrl('/login')} style={switchWorkspaceLink}>
                  Not your workspace?
                </a>
              )}
            </form>
            )}

            <div style={divider}>
              <span style={dividerLine} />
              <span style={dividerText}>or</span>
              <span style={dividerLine} />
            </div>

            <p style={signupPrompt}>
              Need an operator account? Contact your organization administrator to create one.
              For customers and patients, use the public join URLs — find your location at {' '}
              <Link href="/join" style={signupLink}>Public join pages</Link>.
            </p>
          </div>

          <p style={termsText}>
            By signing in, you agree to our{' '}
            <Link href="/terms" style={termsLink}>Terms</Link>
            {' '}and{' '}
            <Link href="/privacy" style={termsLink}>Privacy Policy</Link>
          </p>
        </div>
      </div>

      <style>{loginStyles}</style>
    </div>
  );
};

// Styles
const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem',
  position: 'relative',
  overflow: 'hidden',
  background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
};

const bgPattern: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2314b8a6' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
};

const bgGradient: React.CSSProperties = {
  position: 'absolute',
  top: '-50%',
  right: '-20%',
  width: '80%',
  height: '150%',
  background: 'radial-gradient(ellipse, rgba(20, 184, 166, 0.15) 0%, transparent 70%)',
  pointerEvents: 'none',
};

const containerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '4rem',
  maxWidth: '1100px',
  width: '100%',
  position: 'relative',
  zIndex: 1,
};

const brandingSection: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  color: 'white',
};

const logoContainer: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  marginBottom: '2rem',
};

const logoIcon: React.CSSProperties = {
  display: 'flex',
};

const logoText: React.CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 700,
  letterSpacing: '-0.02em',
};

const heroTitle: React.CSSProperties = {
  fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
  fontWeight: 800,
  lineHeight: 1.1,
  marginBottom: '1.5rem',
  background: 'linear-gradient(135deg, #ffffff 0%, #99f6e4 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

const heroSubtitle: React.CSSProperties = {
  fontSize: '1.125rem',
  lineHeight: 1.7,
  color: '#9ca3af',
  marginBottom: '2.5rem',
  maxWidth: '400px',
};

const featureList: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const featureItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  color: '#d1d5db',
};

const formSection: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
};

const formCard: React.CSSProperties = {
  background: 'white',
  padding: '2.5rem',
  borderRadius: '1.5rem',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  width: '100%',
  maxWidth: '420px',
};

const formHeader: React.CSSProperties = {
  marginBottom: '2rem',
  textAlign: 'center',
};

const formTitle: React.CSSProperties = {
  fontSize: '1.75rem',
  fontWeight: 700,
  color: '#111827',
  marginBottom: '0.5rem',
};

const formSubtitle: React.CSSProperties = {
  color: '#6b7280',
};

const errorAlert: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '1rem',
  background: '#fef2f2',
  color: '#dc2626',
  borderRadius: '0.75rem',
  marginBottom: '1.5rem',
  fontSize: '0.875rem',
};

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
};

const fieldGroup: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const labelRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#374151',
};

const forgotLink: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#14b8a6',
  fontWeight: 500,
};

const switchWorkspaceLink: React.CSSProperties = {
  fontSize: '0.8125rem',
  color: '#9ca3af',
  textAlign: 'center',
  marginTop: '-0.25rem',
};

const inputWrapper: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
};

const inputIconStyle: React.CSSProperties = {
  position: 'absolute',
  left: '1rem',
  color: '#9ca3af',
  pointerEvents: 'none',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.875rem 1rem 0.875rem 2.75rem',
  fontSize: '1rem',
  borderRadius: '0.75rem',
  background: '#f9fafb',
  outline: 'none',
};

const slugSuffix: React.CSSProperties = {
  position: 'absolute',
  right: '2.75rem',
  fontSize: '0.875rem',
  color: '#9ca3af',
  pointerEvents: 'none',
};

const slugStatusIcon: React.CSSProperties = {
  position: 'absolute',
  right: '1rem',
  display: 'flex',
  alignItems: 'center',
};

const slugHintSuccess: React.CSSProperties = {
  fontSize: '0.8125rem',
  color: '#059669',
  margin: 0,
};

const slugHintError: React.CSSProperties = {
  fontSize: '0.8125rem',
  color: '#dc2626',
  margin: 0,
};

const redirectingBox: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  padding: '1.25rem',
  background: '#f9fafb',
  borderRadius: '0.75rem',
  border: '1px solid #e5e7eb',
};

const redirectingTitle: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 600,
  color: '#111827',
};

const redirectingSubtitle: React.CSSProperties = {
  fontSize: '0.8125rem',
  color: '#9ca3af',
  marginTop: '0.125rem',
};

const togglePasswordBtn: React.CSSProperties = {
  position: 'absolute',
  right: '1rem',
  background: 'none',
  border: 'none',
  color: '#9ca3af',
  cursor: 'pointer',
  padding: '0.25rem',
  display: 'flex',
};

const divider: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  margin: '1.5rem 0',
  gap: '1rem',
};

const dividerLine: React.CSSProperties = {
  flex: 1,
  height: '1px',
  background: '#e5e7eb',
};

const dividerText: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#9ca3af',
};

const signupPrompt: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '0.875rem',
  color: '#6b7280',
};

const signupLink: React.CSSProperties = {
  color: '#14b8a6',
  fontWeight: 600,
};

const termsText: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '0.75rem',
  color: '#6b7280',
  marginTop: '1.5rem',
  maxWidth: '420px',
};

const termsLink: React.CSSProperties = {
  color: '#9ca3af',
  textDecoration: 'underline',
};

const loginStyles = `
  .qf-input {
    border: 1px solid #e5e7eb;
    transition: border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
  }
  .qf-input:focus {
    border-color: #14b8a6;
    background: #ffffff;
    box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.15);
  }
  .qf-spin {
    animation: qf-spin-anim 0.8s linear infinite;
  }
  @keyframes qf-spin-anim {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .qf-spin { animation-duration: 1.6s; }
  }
`;

export default LoginPage;
