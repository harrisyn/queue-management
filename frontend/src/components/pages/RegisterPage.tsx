'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/api/client';

// ============================================================================
// MULTI-STEP REGISTRATION COMPONENT
// ============================================================================

interface RegistrationData {
  organizationName: string;
  email: string;
  phone: string;
  countryCode: string;
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
  otpCode: string;
  emailVerified: boolean;
}

const COUNTRY_CODES = [
  { code: '+1', country: 'US/CA', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+233', country: 'GH', flag: '🇬🇭' },
  { code: '+234', country: 'NG', flag: '🇳🇬' },
  { code: '+254', country: 'KE', flag: '🇰🇪' },
  { code: '+27', country: 'ZA', flag: '🇿🇦' },
  { code: '+91', country: 'IN', flag: '🇮🇳' },
  { code: '+86', country: 'CN', flag: '🇨🇳' },
  { code: '+81', country: 'JP', flag: '🇯🇵' },
  { code: '+49', country: 'DE', flag: '🇩🇪' },
  { code: '+33', country: 'FR', flag: '🇫🇷' },
  { code: '+61', country: 'AU', flag: '🇦🇺' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
];

const RegisterPage: React.FC = () => {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpResendTimer, setOtpResendTimer] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  const [formData, setFormData] = useState<RegistrationData>({
    organizationName: '',
    email: '',
    phone: '',
    countryCode: '+1',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
    otpCode: '',
    emailVerified: false,
  });

  // OTP resend timer
  useEffect(() => {
    if (otpResendTimer > 0) {
      const timer = setTimeout(() => setOtpResendTimer(otpResendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpResendTimer]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  // Handle OTP input
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newCode = formData.otpCode.split('');
    newCode[index] = value;
    const code = newCode.join('').slice(0, 6);
    setFormData(prev => ({ ...prev, otpCode: code }));

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !formData.otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    setFormData(prev => ({ ...prev, otpCode: pasted }));
    const focusIndex = Math.min(pasted.length, 5);
    otpInputRefs.current[focusIndex]?.focus();
  };

  // Send OTP
  const sendOTP = async () => {
    if (!formData.email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await api.sendOTP(formData.email);
      setOtpSent(true);
      setOtpResendTimer(60);
      setStep(3);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const verifyOTP = async () => {
    if (formData.otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.verifyOTP(formData.email, formData.otpCode);
      setFormData(prev => ({ ...prev, emailVerified: true }));
      setStep(4);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  // Complete registration
  const completeRegistration = async () => {
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const fullPhone = formData.phone ? `${formData.countryCode}${formData.phone.replace(/\D/g, '')}` : undefined;
      
      const { token } = await api.registerOrganization({
        organizationName: formData.organizationName,
        email: formData.email,
        phone: fullPhone,
        adminFirstName: formData.firstName,
        adminLastName: formData.lastName,
        adminPassword: formData.password,
        emailVerified: formData.emailVerified,
      });

      localStorage.setItem('token', token);
      setSuccess(true);
      
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.organizationName.trim()) {
        setError('Organization name is required');
        return;
      }
      if (!formData.firstName.trim() || !formData.lastName.trim()) {
        setError('Your name is required');
        return;
      }
    }
    if (step === 2) {
      if (!formData.email.trim()) {
        setError('Email is required');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        setError('Please enter a valid email address');
        return;
      }
      sendOTP();
      return;
    }
    setError('');
    setStep(step + 1);
  };

  const prevStep = () => {
    setError('');
    if (step === 3) {
      setStep(2);
    } else {
      setStep(step - 1);
    }
  };

  // Success state
  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.bgGradient} />
        <div style={styles.bgPattern} />
        <div style={styles.formContainer}>
          <div style={styles.successCard}>
            <div style={styles.successIconWrapper}>
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                <circle cx="40" cy="40" r="38" stroke="#10b981" strokeWidth="4"/>
                <path d="M24 40L35 51L56 30" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 style={styles.successTitle}>Welcome Aboard! 🎉</h2>
            <p style={styles.successText}>
              Your organization has been created successfully.
              <br />Redirecting to your dashboard...
            </p>
            <div style={styles.loadingDots}>
              <span style={styles.dot} />
              <span style={{ ...styles.dot, animationDelay: '0.2s' }} />
              <span style={{ ...styles.dot, animationDelay: '0.4s' }} />
            </div>
          </div>
        </div>
        <style>{keyframes}</style>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Background */}
      <div style={styles.bgGradient} />
      <div style={styles.bgPattern} />

      {/* Decorative elements */}
      <div style={styles.floatingOrb1} />
      <div style={styles.floatingOrb2} />
      <div style={styles.floatingOrb3} />

      <div style={styles.mainWrapper}>
        {/* Left side - Info panel */}
        <div style={styles.infoPanel}>
          <div style={styles.infoPanelContent}>
            <Link href="/" style={styles.logoLink}>
              <span style={styles.logoIcon}>🏥</span>
              <span style={styles.logoText}>QueueFlow</span>
            </Link>

            <h1 style={styles.infoTitle}>
              Streamline your<br />
              <span style={styles.gradientText}>queue management</span>
            </h1>

            <p style={styles.infoSubtitle}>
              Join thousands of organizations using QueueFlow to reduce wait times and improve customer satisfaction.
            </p>

            <div style={styles.featureList}>
              <div style={styles.featureItem}>
                <div style={styles.featureIcon}>⚡</div>
                <div>
                  <h4 style={styles.featureTitle}>Real-time Updates</h4>
                  <p style={styles.featureDesc}>Customers get instant notifications</p>
                </div>
              </div>
              <div style={styles.featureItem}>
                <div style={styles.featureIcon}>📱</div>
                <div>
                  <h4 style={styles.featureTitle}>QR Check-in</h4>
                  <p style={styles.featureDesc}>Scan and join in seconds</p>
                </div>
              </div>
              <div style={styles.featureItem}>
                <div style={styles.featureIcon}>📊</div>
                <div>
                  <h4 style={styles.featureTitle}>Analytics</h4>
                  <p style={styles.featureDesc}>Insights to optimize flow</p>
                </div>
              </div>
            </div>

            <div style={styles.testimonial}>
              <p style={styles.testimonialText}>
                &ldquo;QueueFlow reduced our wait times by 40% in the first month.&rdquo;
              </p>
              <div style={styles.testimonialAuthor}>
                <div style={styles.testimonialAvatar}>JD</div>
                <div>
                  <strong>Dr. James Davis</strong>
                  <span style={styles.testimonialRole}>City General Hospital</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Form */}
        <div style={styles.formPanel}>
          <div style={styles.formContainer}>
            {/* Progress */}
            <div style={styles.progressContainer}>
              <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: `${(step / 4) * 100}%` }} />
              </div>
              <div style={styles.stepIndicators}>
                {[
                  { num: 1, label: 'Details' },
                  { num: 2, label: 'Contact' },
                  { num: 3, label: 'Verify' },
                  { num: 4, label: 'Secure' },
                ].map(s => (
                  <div key={s.num} style={styles.stepItem}>
                    <div style={{
                      ...styles.stepDot,
                      ...(s.num <= step ? styles.stepDotActive : {}),
                      ...(s.num < step ? styles.stepDotComplete : {}),
                    }}>
                      {s.num < step ? '✓' : s.num}
                    </div>
                    <span style={s.num <= step ? styles.stepLabelActive : styles.stepLabel}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Form Card */}
            <div style={styles.card}>
              {/* Step 1: Organization & Name */}
              {step === 1 && (
                <div style={styles.stepContent}>
                  <h2 style={styles.stepTitle}>Let&apos;s get started</h2>
                  <p style={styles.stepSubtitle}>Tell us about your organization</p>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Organization Name</label>
                    <input
                      type="text"
                      name="organizationName"
                      value={formData.organizationName}
                      onChange={handleChange}
                      placeholder="e.g., City General Hospital"
                      style={styles.input}
                      autoFocus
                    />
                  </div>

                  <div style={styles.formRow}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Your First Name</label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        placeholder="John"
                        style={styles.input}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Your Last Name</label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        placeholder="Doe"
                        style={styles.input}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Contact Info */}
              {step === 2 && (
                <div style={styles.stepContent}>
                  <h2 style={styles.stepTitle}>Contact Information</h2>
                  <p style={styles.stepSubtitle}>We&apos;ll send a verification code to your email</p>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="you@organization.com"
                      style={styles.input}
                      autoFocus
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Phone Number (Optional)</label>
                    <div style={styles.phoneInput}>
                      <select
                        name="countryCode"
                        value={formData.countryCode}
                        onChange={handleChange}
                        style={styles.countrySelect}
                      >
                        {COUNTRY_CODES.map(c => (
                          <option key={c.code} value={c.code}>
                            {c.flag} {c.code}
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="123 456 7890"
                        style={styles.phoneNumber}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: OTP Verification */}
              {step === 3 && (
                <div style={styles.stepContent}>
                  <div style={styles.iconLarge}>📧</div>
                  <h2 style={styles.stepTitle}>Check your email</h2>
                  <p style={styles.stepSubtitle}>
                    We sent a 6-digit code to<br />
                    <strong style={{ color: '#6366f1' }}>{formData.email}</strong>
                  </p>

                  <div style={styles.otpContainer} onPaste={handleOtpPaste}>
                    {[0, 1, 2, 3, 4, 5].map(i => (
                      <input
                        key={i}
                        ref={el => { otpInputRefs.current[i] = el; }}
                        type="text"
                        maxLength={1}
                        value={formData.otpCode[i] || ''}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        style={{
                          ...styles.otpInput,
                          borderColor: formData.otpCode[i] ? '#6366f1' : 'rgba(255,255,255,0.2)',
                        }}
                        autoFocus={i === 0}
                      />
                    ))}
                  </div>

                  <div style={styles.resendSection}>
                    {otpResendTimer > 0 ? (
                      <span style={styles.resendTimer}>
                        Resend code in {otpResendTimer}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={sendOTP}
                        style={styles.resendButton}
                        disabled={loading}
                      >
                        Resend verification code
                      </button>
                    )}
                  </div>

                  <div style={styles.devNote}>
                    <span style={styles.devNoteIcon}>💡</span>
                    <span>In development mode, check your console for the OTP code.</span>
                  </div>
                </div>
              )}

              {/* Step 4: Create Password */}
              {step === 4 && (
                <div style={styles.stepContent}>
                  <div style={styles.iconLarge}>🔐</div>
                  <h2 style={styles.stepTitle}>Secure your account</h2>
                  <p style={styles.stepSubtitle}>Create a strong password</p>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Password</label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="At least 8 characters"
                      style={styles.input}
                      autoFocus
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Confirm Password</label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Re-enter your password"
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.passwordHints}>
                    <div style={formData.password.length >= 8 ? styles.hintValid : styles.hint}>
                      ✓ At least 8 characters
                    </div>
                    <div style={formData.password === formData.confirmPassword && formData.confirmPassword ? styles.hintValid : styles.hint}>
                      ✓ Passwords match
                    </div>
                  </div>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div style={styles.errorBox}>
                  <span style={styles.errorIcon}>⚠️</span>
                  {error}
                </div>
              )}

              {/* Navigation buttons */}
              <div style={styles.buttonRow}>
                {step > 1 && (
                  <button
                    type="button"
                    onClick={prevStep}
                    style={styles.backButton}
                    disabled={loading}
                  >
                    ← Back
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={step === 3 ? verifyOTP : step === 4 ? completeRegistration : nextStep}
                  style={loading ? styles.primaryButtonLoading : styles.primaryButton}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="spinner" style={{ width: 20, height: 20 }} />
                  ) : step === 3 ? (
                    'Verify Email'
                  ) : step === 4 ? (
                    'Create Account 🚀'
                  ) : (
                    'Continue →'
                  )}
                </button>
              </div>

              {/* Footer */}
              <div style={styles.footer}>
                Already have an account?{' '}
                <Link href="/login" style={styles.loginLink}>Sign in</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{keyframes}</style>
    </div>
  );
};

// ============================================================================
// KEYFRAMES
// ============================================================================

const keyframes = `
  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-20px) rotate(5deg); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.8; }
  }
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
`;

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    position: 'relative',
    overflow: 'hidden',
    background: '#0a0a0f',
  },
  bgGradient: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse at 30% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 40%)',
    zIndex: 0,
  },
  bgPattern: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%236366f1' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
    zIndex: 0,
  },
  floatingOrb1: {
    position: 'absolute',
    top: '10%',
    left: '5%',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%)',
    filter: 'blur(40px)',
    animation: 'float 8s ease-in-out infinite',
    zIndex: 0,
  },
  floatingOrb2: {
    position: 'absolute',
    bottom: '20%',
    right: '10%',
    width: '250px',
    height: '250px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
    filter: 'blur(40px)',
    animation: 'float 10s ease-in-out infinite reverse',
    zIndex: 0,
  },
  floatingOrb3: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)',
    filter: 'blur(60px)',
    animation: 'pulse 6s ease-in-out infinite',
    zIndex: 0,
  },
  mainWrapper: {
    display: 'flex',
    minHeight: '100vh',
    position: 'relative',
    zIndex: 1,
  },
  infoPanel: {
    display: 'none',
    width: '50%',
    padding: '3rem',
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
    borderRight: '1px solid rgba(255,255,255,0.05)',
  },
  infoPanelContent: {
    maxWidth: '480px',
    marginLeft: 'auto',
    marginRight: '3rem',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  logoLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    textDecoration: 'none',
    marginBottom: '3rem',
  },
  logoIcon: {
    fontSize: '2rem',
  },
  logoText: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'white',
  },
  infoTitle: {
    fontSize: '2.5rem',
    fontWeight: 800,
    color: 'white',
    lineHeight: 1.2,
    marginBottom: '1.5rem',
  },
  gradientText: {
    background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  infoSubtitle: {
    fontSize: '1.1rem',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.7,
    marginBottom: '2.5rem',
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    marginBottom: '3rem',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
  },
  featureIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'rgba(99, 102, 241, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    flexShrink: 0,
  },
  featureTitle: {
    color: 'white',
    fontWeight: 600,
    fontSize: '0.95rem',
    marginBottom: '0.25rem',
  },
  featureDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.85rem',
    margin: 0,
  },
  testimonial: {
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '16px',
    padding: '1.5rem',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  testimonialText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: '1rem',
    fontStyle: 'italic',
    lineHeight: 1.6,
    marginBottom: '1rem',
  },
  testimonialAuthor: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  testimonialAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 600,
    fontSize: '0.85rem',
  },
  testimonialRole: {
    display: 'block',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.8rem',
  },
  formPanel: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  formContainer: {
    width: '100%',
    maxWidth: '460px',
  },
  progressContainer: {
    marginBottom: '2rem',
  },
  progressBar: {
    height: '4px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginBottom: '1.5rem',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #6366f1, #a855f7)',
    borderRadius: '2px',
    transition: 'width 0.4s ease',
  },
  stepIndicators: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  stepItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  stepDot: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    fontWeight: 600,
    transition: 'all 0.3s ease',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: 'transparent',
  },
  stepDotActive: {
    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
    color: 'white',
    boxShadow: '0 0 20px rgba(99, 102, 241, 0.5)',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  stepDotComplete: {
    background: '#10b981',
    color: 'white',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  stepLabel: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.3)',
  },
  stepLabelActive: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.7)',
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    backdropFilter: 'blur(20px)',
    borderRadius: '24px',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '2.5rem',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  },
  stepContent: {
    marginBottom: '1.5rem',
  },
  stepTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'white',
    marginBottom: '0.5rem',
    textAlign: 'center',
  },
  stepSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: '2rem',
    lineHeight: 1.6,
  },
  iconLarge: {
    fontSize: '3.5rem',
    textAlign: 'center',
    marginBottom: '1rem',
  },
  formGroup: {
    marginBottom: '1.25rem',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  label: {
    display: 'block',
    marginBottom: '0.5rem',
    color: 'rgba(255,255,255,0.8)',
    fontSize: '0.9rem',
    fontWeight: 500,
  },
  input: {
    width: '100%',
    padding: '0.875rem 1rem',
    background: 'rgba(255,255,255,0.05)',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: 'white',
    fontSize: '1rem',
    transition: 'all 0.2s ease',
    outline: 'none',
    boxSizing: 'border-box',
  },
  phoneInput: {
    display: 'flex',
    gap: '0.5rem',
  },
  countrySelect: {
    width: '120px',
    padding: '0.875rem 0.75rem',
    background: 'rgba(255,255,255,0.05)',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: 'white',
    fontSize: '0.9rem',
    cursor: 'pointer',
    outline: 'none',
  },
  phoneNumber: {
    flex: 1,
    padding: '0.875rem 1rem',
    background: 'rgba(255,255,255,0.05)',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: 'white',
    fontSize: '1rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  otpContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  },
  otpInput: {
    width: '52px',
    height: '60px',
    textAlign: 'center',
    fontSize: '1.5rem',
    fontWeight: 700,
    background: 'rgba(255,255,255,0.05)',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: '12px',
    color: 'white',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
  resendSection: {
    textAlign: 'center',
    marginBottom: '1rem',
  },
  resendTimer: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '0.9rem',
  },
  resendButton: {
    background: 'none',
    border: 'none',
    color: '#a855f7',
    fontSize: '0.9rem',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  devNote: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.75rem',
    background: 'rgba(139, 92, 246, 0.1)',
    borderRadius: '8px',
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.6)',
  },
  devNoteIcon: {
    fontSize: '1rem',
  },
  passwordHints: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginTop: '0.5rem',
  },
  hint: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.3)',
  },
  hintValid: {
    fontSize: '0.85rem',
    color: '#10b981',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.875rem 1rem',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '12px',
    color: '#fca5a5',
    fontSize: '0.9rem',
    marginBottom: '1.5rem',
  },
  errorIcon: {
    fontSize: '1.1rem',
  },
  buttonRow: {
    display: 'flex',
    gap: '1rem',
  },
  backButton: {
    padding: '0.875rem 1.5rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  primaryButton: {
    flex: 1,
    padding: '0.875rem 1.5rem',
    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
    border: 'none',
    borderRadius: '12px',
    color: 'white',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
  },
  primaryButtonLoading: {
    flex: 1,
    padding: '0.875rem 1.5rem',
    background: 'rgba(99, 102, 241, 0.5)',
    border: 'none',
    borderRadius: '12px',
    color: 'white',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'not-allowed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    textAlign: 'center',
    marginTop: '2rem',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.9rem',
  },
  loginLink: {
    color: '#a855f7',
    textDecoration: 'none',
    fontWeight: 500,
  },
  successCard: {
    background: 'rgba(255,255,255,0.03)',
    backdropFilter: 'blur(20px)',
    borderRadius: '24px',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    padding: '3rem',
    textAlign: 'center',
    maxWidth: '400px',
    margin: '0 auto',
  },
  successIconWrapper: {
    marginBottom: '1.5rem',
  },
  successTitle: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: 'white',
    marginBottom: '0.75rem',
  },
  successText: {
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.6,
    marginBottom: '1.5rem',
  },
  loadingDots: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.5rem',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#10b981',
    animation: 'bounce 1.4s ease-in-out infinite',
  },
};

// Add media query styles via inline check
if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
  styles.infoPanel = { ...styles.infoPanel, display: 'flex' };
}

export default RegisterPage;
