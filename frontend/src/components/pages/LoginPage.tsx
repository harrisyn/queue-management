'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { QrCode, Zap, Bell } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { extractSubdomain, buildTenantUrl } from '@/lib/subdomain';
import { Button, Icon } from '@/components/ui';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [subdomain, setSubdomain] = useState<string | null>(null);
  const [hostChecked, setHostChecked] = useState(false);
  const [workspaceSlug, setWorkspaceSlug] = useState('');
  const { login } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSubdomain(extractSubdomain(window.location.host));
      setHostChecked(true);
    }
  }, []);

  const handleFindWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (workspaceSlug.trim()) {
      window.location.href = buildTenantUrl(workspaceSlug.trim().toLowerCase(), '/login');
    }
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
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="12" fill="#14b8a6" />
                <path d="M14 24C14 18.477 18.477 14 24 14V14C29.523 14 34 18.477 34 24V34H14V24Z" fill="white" fillOpacity="0.9"/>
                <circle cx="24" cy="22" r="4" fill="#0d9488"/>
              </svg>
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
                {subdomain === 'admin' ? 'Superadmin sign in' : hostChecked && !subdomain ? 'Find your workspace' : 'Operator sign in'}
              </h2>
              <p style={formSubtitle}>
                {subdomain === 'admin'
                  ? 'Sign in with your superadmin account to manage organizations and plans.'
                  : hostChecked && !subdomain
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

            {hostChecked && !subdomain ? (
              <form onSubmit={handleFindWorkspace} style={formStyle}>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Workspace URL</label>
                  <div style={inputWrapper}>
                    <input
                      type="text"
                      value={workspaceSlug}
                      onChange={(e) => setWorkspaceSlug(e.target.value)}
                      placeholder="your-org"
                      style={inputStyle}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" variant="primary" size="lg" style={{ width: '100%' }}>
                  <span>Continue</span>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </Button>
              </form>
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
  border: '1px solid #e5e7eb',
  borderRadius: '0.75rem',
  background: '#f9fafb',
  transition: 'all 0.2s',
  outline: 'none',
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

export default LoginPage;
