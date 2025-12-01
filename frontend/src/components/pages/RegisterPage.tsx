'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthContext } from '@/contexts/AuthContext';

const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const { register } = useAuthContext();
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Calculate password strength
    if (name === 'password') {
      let strength = 0;
      if (value.length >= 8) strength++;
      if (/[A-Z]/.test(value)) strength++;
      if (/[0-9]/.test(value)) strength++;
      if (/[^A-Za-z0-9]/.test(value)) strength++;
      setPasswordStrength(strength);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });
      router.push('/login?registered=true');
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = () => {
    if (passwordStrength <= 1) return '#ef4444';
    if (passwordStrength <= 2) return '#f59e0b';
    if (passwordStrength <= 3) return '#10b981';
    return '#059669';
  };

  const getStrengthText = () => {
    if (passwordStrength <= 1) return 'Weak';
    if (passwordStrength <= 2) return 'Fair';
    if (passwordStrength <= 3) return 'Good';
    return 'Strong';
  };

  return (
    <div style={pageStyle}>
      {/* Background decoration */}
      <div style={bgPattern} />
      <div style={bgGradient} />
      
      {/* Main Container */}
      <div style={containerStyle}>
        {/* Left Side - Form */}
        <div style={formSection}>
          <div style={formCard}>
            {/* Back link */}
            <Link href="/login" style={backLink}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              <span>Back to login</span>
            </Link>

            <div style={formHeader}>
              <h2 style={formTitle}>Create operator account</h2>
              <p style={formSubtitle}>For organization staff and administrators only — patients do not need an account.</p>
              <p style={{ ...formSubtitle, marginTop: '0.5rem' }}>
                Customers can join public queues at your location URL (e.g. <strong>/join/[code]</strong>) — no signup required.
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

            <form onSubmit={handleSubmit} style={formStyle}>
              {/* Name row */}
              <div style={nameRow}>
                <div style={fieldGroup}>
                  <label style={labelStyle}>First name</label>
                  <div style={inputWrapper}>
                    <svg style={inputIconStyle} width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="John"
                      style={inputStyle}
                      required
                    />
                  </div>
                </div>
                <div style={fieldGroup}>
                  <label style={labelStyle}>Last name</label>
                  <div style={inputWrapper}>
                    <svg style={inputIconStyle} width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder="Doe"
                      style={inputStyle}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div style={fieldGroup}>
                <label style={labelStyle}>Email address</label>
                <div style={inputWrapper}>
                  <svg style={inputIconStyle} width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div style={fieldGroup}>
                <label style={labelStyle}>Password</label>
                <div style={inputWrapper}>
                  <svg style={inputIconStyle} width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    style={inputStyle}
                    required
                    minLength={6}
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
                {/* Password strength indicator */}
                {formData.password && (
                  <div style={strengthContainer}>
                    <div style={strengthBar}>
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          style={{
                            ...strengthSegment,
                            backgroundColor: passwordStrength >= level ? getStrengthColor() : '#e5e7eb',
                          }}
                        />
                      ))}
                    </div>
                    <span style={{ ...strengthText, color: getStrengthColor() }}>
                      {getStrengthText()}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div style={fieldGroup}>
                <label style={labelStyle}>Confirm password</label>
                <div style={inputWrapper}>
                  <svg style={inputIconStyle} width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    style={{
                      ...inputStyle,
                      borderColor: formData.confirmPassword && formData.password !== formData.confirmPassword ? '#ef4444' : undefined,
                    }}
                    required
                  />
                  {formData.confirmPassword && formData.password === formData.confirmPassword && (
                    <svg style={checkIconStyle} width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={submitButton}
              >
                {loading ? (
                  <>
                    <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create account</span>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            <p style={termsText}>
              By creating an account, you agree to our{' '}
              <Link href="/terms" style={termsLink}>Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" style={termsLink}>Privacy Policy</Link>
            </p>
          </div>
        </div>

        {/* Right Side - Features */}
        <div style={featuresSection}>
          <div style={logoContainer}>
            <div style={logoIcon}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect width="48" height="48" rx="12" fill="url(#gradient2)" />
                <path d="M14 24C14 18.477 18.477 14 24 14V14C29.523 14 34 18.477 34 24V34H14V24Z" fill="white" fillOpacity="0.9"/>
                <circle cx="24" cy="22" r="4" fill="#6366f1"/>
                <defs>
                  <linearGradient id="gradient2" x1="0" y1="0" x2="48" y2="48">
                    <stop stopColor="#6366f1"/>
                    <stop offset="1" stopColor="#8b5cf6"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span style={logoText}>QMS</span>
          </div>

          <h1 style={heroTitle}>
            Everything you need<br />
            to manage queues
          </h1>

          <div style={featureCards}>
            <div style={featureCard}>
              <div style={featureIconBox}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 4v1m6 11h-1.25M9.25 4v1M6 4v1m3.25 0H15m-3 5v7m4-7h-8a2 2 0 00-2 2v5a2 2 0 002 2h8a2 2 0 002-2v-5a2 2 0 00-2-2z" />
                </svg>
              </div>
              <div>
                <h3 style={featureCardTitle}>QR Code Check-in</h3>
                <p style={featureCardDesc}>Customers scan to join queues instantly</p>
              </div>
            </div>

            <div style={featureCard}>
              <div style={featureIconBox}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 style={featureCardTitle}>Real-time Updates</h3>
                <p style={featureCardDesc}>Live queue position notifications</p>
              </div>
            </div>

            <div style={featureCard}>
              <div style={featureIconBox}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h3 style={featureCardTitle}>Analytics Dashboard</h3>
                <p style={featureCardDesc}>Insights to optimize your operations</p>
              </div>
            </div>
          </div>

          <div style={testimonial}>
            <p style={testimonialText}>
              &ldquo;QMS reduced our wait times by 40% and improved customer satisfaction scores dramatically.&rdquo;
            </p>
            <div style={testimonialAuthor}>
              <div style={testimonialAvatar}>JD</div>
              <div>
                <div style={testimonialName}>Jane Doe</div>
                <div style={testimonialRole}>Operations Manager</div>
              </div>
            </div>
          </div>
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
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%236366f1' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
};

const bgGradient: React.CSSProperties = {
  position: 'absolute',
  top: '-50%',
  left: '-20%',
  width: '80%',
  height: '150%',
  background: 'radial-gradient(ellipse, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
  pointerEvents: 'none',
};

const containerStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '4rem',
  maxWidth: '1200px',
  width: '100%',
  position: 'relative',
  zIndex: 1,
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
  maxWidth: '480px',
};

const backLink: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  color: '#6b7280',
  fontSize: '0.875rem',
  marginBottom: '1.5rem',
  textDecoration: 'none',
};

const formHeader: React.CSSProperties = {
  marginBottom: '2rem',
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

const nameRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '1rem',
};

const fieldGroup: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#374151',
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

const checkIconStyle: React.CSSProperties = {
  position: 'absolute',
  right: '1rem',
  color: '#10b981',
};

const strengthContainer: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  marginTop: '0.5rem',
};

const strengthBar: React.CSSProperties = {
  display: 'flex',
  gap: '0.25rem',
  flex: 1,
};

const strengthSegment: React.CSSProperties = {
  height: '4px',
  flex: 1,
  borderRadius: '2px',
  transition: 'background-color 0.2s',
};

const strengthText: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 500,
};

const submitButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  width: '100%',
  padding: '1rem',
  fontSize: '1rem',
  fontWeight: 600,
  color: 'white',
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  border: 'none',
  borderRadius: '0.75rem',
  cursor: 'pointer',
  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
  transition: 'all 0.2s',
  marginTop: '0.5rem',
};

const termsText: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '0.75rem',
  color: '#6b7280',
  marginTop: '1.5rem',
  lineHeight: 1.5,
};

const termsLink: React.CSSProperties = {
  color: '#6366f1',
  textDecoration: 'underline',
};

const featuresSection: React.CSSProperties = {
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
  fontSize: 'clamp(2rem, 4vw, 2.5rem)',
  fontWeight: 800,
  lineHeight: 1.1,
  marginBottom: '2rem',
  background: 'linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

const featureCards: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  marginBottom: '2rem',
};

const featureCard: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '1rem',
  padding: '1rem',
  background: 'rgba(255, 255, 255, 0.05)',
  borderRadius: '0.75rem',
  border: '1px solid rgba(255, 255, 255, 0.1)',
};

const featureIconBox: React.CSSProperties = {
  width: '48px',
  height: '48px',
  borderRadius: '0.75rem',
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  flexShrink: 0,
};

const featureCardTitle: React.CSSProperties = {
  fontWeight: 600,
  marginBottom: '0.25rem',
  color: '#ffffff',
};

const featureCardDesc: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#d1d5db',
};

const testimonial: React.CSSProperties = {
  padding: '1.5rem',
  background: 'rgba(255, 255, 255, 0.05)',
  borderRadius: '1rem',
  border: '1px solid rgba(255, 255, 255, 0.1)',
};

const testimonialText: React.CSSProperties = {
  fontSize: '1rem',
  fontStyle: 'italic',
  marginBottom: '1rem',
  lineHeight: 1.6,
  color: '#e5e7eb',
};

const testimonialAuthor: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
};

const testimonialAvatar: React.CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 600,
  fontSize: '0.875rem',
};

const testimonialName: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '0.875rem',
  color: '#ffffff',
};

const testimonialRole: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#d1d5db',
};

export default RegisterPage;
