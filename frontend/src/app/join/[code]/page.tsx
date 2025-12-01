'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import api from '@/api/client';

interface QueueInfo {
  id: string;
  name: string;
  serviceName: string;
  locationName: string;
  currentPosition: number;
  estimatedWaitTime: number;
  status: 'ACTIVE' | 'PAUSED' | 'CLOSED';
}

interface JoinResult {
  ticketNumber: string;
  position: number;
  estimatedWait: number;
  queueId: string;
  entryId: string;
}

export default function JoinQueuePage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const code = resolvedParams.code;
  
  const [step, setStep] = useState<'loading' | 'info' | 'form' | 'success' | 'error'>('loading');
  const [queueInfo, setQueueInfo] = useState<QueueInfo | null>(null);
  const [joinResult, setJoinResult] = useState<JoinResult | null>(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    notes: '',
  });
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    loadQueueInfo();
  }, [code]);

  const loadQueueInfo = async () => {
    try {
      // In a real app, this would fetch from API using the code
      // For demo, we'll simulate the queue info
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setQueueInfo({
        id: 'queue-123',
        name: 'General Queue',
        serviceName: 'General Consultation',
        locationName: 'Main Clinic - Ground Floor',
        currentPosition: 12,
        estimatedWaitTime: 35,
        status: 'ACTIVE',
      });
      setStep('info');
    } catch (err) {
      console.error('Failed to load queue info', err);
      setError('Queue not found or no longer active');
      setStep('error');
    }
  };

  const handleJoinQueue = async () => {
    if (!formData.name.trim()) {
      setError('Please enter your name');
      return;
    }

    setJoining(true);
    setError('');

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setJoinResult({
        ticketNumber: 'A-013',
        position: 13,
        estimatedWait: 40,
        queueId: queueInfo?.id || '',
        entryId: 'entry-123',
      });
      setStep('success');
    } catch (err) {
      console.error('Failed to join queue', err);
      setError('Failed to join queue. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const renderLoading = () => (
    <div style={loadingContainer}>
      <div className="spinner" style={spinnerLarge} />
      <p style={loadingText}>Finding your queue...</p>
    </div>
  );

  const renderError = () => (
    <div style={centerContainer}>
      <div style={errorIcon}>
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="28" fill="#fef2f2" stroke="#fecaca" strokeWidth="2"/>
          <path d="M32 20v16M32 44h.01" stroke="#ef4444" strokeWidth="4" strokeLinecap="round"/>
        </svg>
      </div>
      <h1 style={errorTitle}>{error}</h1>
      <p style={errorSubtitle}>The queue code may be invalid or the queue may have closed.</p>
      <Link href="/" style={homeButton}>Go to Homepage</Link>
    </div>
  );

  const renderQueueInfo = () => (
    <div style={infoContainer}>
      {/* Header */}
      <div style={infoHeader}>
        <div style={logoBox}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="url(#gradient)" />
            <path d="M14 24C14 18.477 18.477 14 24 14V14C29.523 14 34 18.477 34 24V34H14V24Z" fill="white" fillOpacity="0.9"/>
            <circle cx="24" cy="22" r="4" fill="#6366f1"/>
            <defs>
              <linearGradient id="gradient" x1="0" y1="0" x2="48" y2="48">
                <stop stopColor="#6366f1"/>
                <stop offset="1" stopColor="#8b5cf6"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div style={statusBadge(queueInfo?.status || 'ACTIVE')}>
          <span style={statusDot(queueInfo?.status || 'ACTIVE')} />
          <span>{queueInfo?.status === 'ACTIVE' ? 'Open' : queueInfo?.status}</span>
        </div>
      </div>

      {/* Queue Details */}
      <div style={queueDetailsCard}>
        <h1 style={queueName}>{queueInfo?.serviceName}</h1>
        <p style={locationText}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="#6b7280" style={{ marginRight: '0.25rem' }}>
            <path fillRule="evenodd" d="M8 1a5 5 0 00-5 5c0 2.764 5 9 5 9s5-6.236 5-9a5 5 0 00-5-5zm0 7a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
          </svg>
          {queueInfo?.locationName}
        </p>

        <div style={statsRow}>
          <div style={statBox}>
            <span style={statNum}>{queueInfo?.currentPosition}</span>
            <span style={statLbl}>In Queue</span>
          </div>
          <div style={statDivider} />
          <div style={statBox}>
            <span style={statNum}>~{queueInfo?.estimatedWaitTime}</span>
            <span style={statLbl}>Min Wait</span>
          </div>
        </div>
      </div>

      {/* Join Form */}
      <div style={formCard}>
        <h2 style={formTitle}>Join the Queue</h2>
        <p style={formSubtitle}>Enter your details to receive your ticket</p>

        {error && (
          <div style={errorAlert}>
            <span>{error}</span>
          </div>
        )}

        <div style={formFields}>
          <div style={fieldGroup}>
            <label style={labelStyle}>Your Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Doe"
              style={inputStyle}
              required
            />
          </div>

          <div style={fieldGroup}>
            <label style={labelStyle}>Phone Number (optional)</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
              style={inputStyle}
            />
            <span style={helpText}>We&apos;ll send you SMS updates about your position</span>
          </div>

          <div style={fieldGroup}>
            <label style={labelStyle}>Notes (optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any special requirements..."
              style={textareaStyle}
              rows={3}
            />
          </div>
        </div>

        <button
          onClick={handleJoinQueue}
          disabled={joining || queueInfo?.status !== 'ACTIVE'}
          style={joinButton}
        >
          {joining ? (
            <>
              <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
              <span>Joining...</span>
            </>
          ) : (
            <>
              <span>Join Queue</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </>
          )}
        </button>
      </div>

      {/* Footer */}
      <p style={footerText}>
        Powered by <strong>QMS</strong>
      </p>
    </div>
  );

  const renderSuccess = () => (
    <div style={successContainer}>
      {/* Ticket Card */}
      <div style={ticketCard}>
        {/* Ticket Header */}
        <div style={ticketHeader}>
          <div style={logoSmall}>
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="url(#successGradient)" />
              <path d="M14 24C14 18.477 18.477 14 24 14V14C29.523 14 34 18.477 34 24V34H14V24Z" fill="white" fillOpacity="0.9"/>
              <circle cx="24" cy="22" r="4" fill="#6366f1"/>
              <defs>
                <linearGradient id="successGradient" x1="0" y1="0" x2="48" y2="48">
                  <stop stopColor="#6366f1"/>
                  <stop offset="1" stopColor="#8b5cf6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <p style={ticketServiceName}>{queueInfo?.serviceName}</p>
            <p style={ticketLocation}>{queueInfo?.locationName}</p>
          </div>
        </div>

        {/* Ticket Number */}
        <div style={ticketNumberSection}>
          <span style={ticketLabel}>YOUR TICKET</span>
          <span style={ticketNumber}>{joinResult?.ticketNumber}</span>
        </div>

        {/* Ticket Perforations */}
        <div style={perforationLine}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} style={perforationDot} />
          ))}
        </div>

        {/* Ticket Stats */}
        <div style={ticketStats}>
          <div style={ticketStatItem}>
            <span style={ticketStatLabel}>Position</span>
            <span style={ticketStatValue}>#{joinResult?.position}</span>
          </div>
          <div style={ticketStatItem}>
            <span style={ticketStatLabel}>Est. Wait</span>
            <span style={ticketStatValue}>~{joinResult?.estimatedWait} min</span>
          </div>
        </div>
      </div>

      {/* Success message */}
      <div style={successMessage}>
        <div style={successIcon}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" fill="#dcfce7"/>
            <path d="M10 16l4 4 8-8" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 style={successTitle}>You&apos;re in the queue!</h2>
        <p style={successSubtitle}>
          Keep this page open to track your position in real-time.
          We&apos;ll notify you when it&apos;s almost your turn.
        </p>
      </div>

      {/* Actions */}
      <div style={actionButtons}>
        <Link href={`/status/${joinResult?.queueId}/${joinResult?.entryId}`} style={trackButton}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd"/>
          </svg>
          <span>Track My Position</span>
        </Link>
        <button onClick={() => window.location.reload()} style={newTicketButton}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
          </svg>
          <span>Get Another Ticket</span>
        </button>
      </div>

      <p style={footerText}>
        Powered by <strong>QMS</strong>
      </p>
    </div>
  );

  return (
    <div style={pageStyle}>
      <div style={bgPattern} />
      <div style={contentStyle}>
        {step === 'loading' && renderLoading()}
        {step === 'error' && renderError()}
        {step === 'info' && renderQueueInfo()}
        {step === 'success' && renderSuccess()}
      </div>
    </div>
  );
}

// Styles
const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
  position: 'relative',
  overflow: 'hidden',
};

const bgPattern: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%236366f1' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
};

const contentStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: '2rem',
};

const loadingContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1.5rem',
};

const spinnerLarge: React.CSSProperties = {
  width: '48px',
  height: '48px',
  borderWidth: '4px',
};

const loadingText: React.CSSProperties = {
  color: '#9ca3af',
  fontSize: '1.125rem',
};

const centerContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  maxWidth: '400px',
};

const errorIcon: React.CSSProperties = {
  marginBottom: '1.5rem',
};

const errorTitle: React.CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 700,
  color: 'white',
  marginBottom: '0.75rem',
};

const errorSubtitle: React.CSSProperties = {
  color: '#9ca3af',
  marginBottom: '2rem',
  lineHeight: 1.6,
};

const homeButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0.75rem 1.5rem',
  background: '#6366f1',
  color: 'white',
  borderRadius: '0.75rem',
  textDecoration: 'none',
  fontWeight: 600,
};

const infoContainer: React.CSSProperties = {
  width: '100%',
  maxWidth: '420px',
};

const infoHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '1.5rem',
};

const logoBox: React.CSSProperties = {
  display: 'flex',
};

const statusBadge = (status: string): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem 1rem',
  background: status === 'ACTIVE' ? '#dcfce7' : status === 'PAUSED' ? '#fef3c7' : '#fee2e2',
  color: status === 'ACTIVE' ? '#166534' : status === 'PAUSED' ? '#854d0e' : '#991b1b',
  borderRadius: '9999px',
  fontSize: '0.875rem',
  fontWeight: 600,
});

const statusDot = (status: string): React.CSSProperties => ({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: status === 'ACTIVE' ? '#10b981' : status === 'PAUSED' ? '#f59e0b' : '#ef4444',
  animation: status === 'ACTIVE' ? 'pulse 2s infinite' : 'none',
});

const queueDetailsCard: React.CSSProperties = {
  background: 'white',
  padding: '1.5rem',
  borderRadius: '1rem',
  marginBottom: '1rem',
  textAlign: 'center',
};

const queueName: React.CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 700,
  color: '#111827',
  marginBottom: '0.5rem',
};

const locationText: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#6b7280',
  fontSize: '0.9375rem',
  marginBottom: '1.5rem',
};

const statsRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2rem',
};

const statBox: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const statNum: React.CSSProperties = {
  fontSize: '2rem',
  fontWeight: 700,
  color: '#6366f1',
};

const statLbl: React.CSSProperties = {
  fontSize: '0.8125rem',
  color: '#6b7280',
};

const statDivider: React.CSSProperties = {
  width: '1px',
  height: '48px',
  background: '#e5e7eb',
};

const formCard: React.CSSProperties = {
  background: 'white',
  padding: '1.5rem',
  borderRadius: '1rem',
  marginBottom: '1.5rem',
};

const formTitle: React.CSSProperties = {
  fontSize: '1.125rem',
  fontWeight: 600,
  color: '#111827',
  marginBottom: '0.25rem',
};

const formSubtitle: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '0.875rem',
  marginBottom: '1.5rem',
};

const errorAlert: React.CSSProperties = {
  padding: '0.75rem 1rem',
  background: '#fef2f2',
  color: '#dc2626',
  borderRadius: '0.5rem',
  marginBottom: '1rem',
  fontSize: '0.875rem',
};

const formFields: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const fieldGroup: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.375rem',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#374151',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem',
  fontSize: '1rem',
  border: '1px solid #e5e7eb',
  borderRadius: '0.5rem',
  background: '#f9fafb',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical' as const,
};

const helpText: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#9ca3af',
};

const joinButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  width: '100%',
  padding: '1rem',
  marginTop: '1rem',
  fontSize: '1rem',
  fontWeight: 600,
  color: 'white',
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  border: 'none',
  borderRadius: '0.75rem',
  cursor: 'pointer',
  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
};

const successContainer: React.CSSProperties = {
  width: '100%',
  maxWidth: '420px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const ticketCard: React.CSSProperties = {
  width: '100%',
  background: 'white',
  borderRadius: '1rem',
  overflow: 'hidden',
  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
};

const ticketHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  padding: '1.25rem',
  background: '#f9fafb',
  borderBottom: '1px solid #e5e7eb',
};

const logoSmall: React.CSSProperties = {
  display: 'flex',
};

const ticketServiceName: React.CSSProperties = {
  fontWeight: 600,
  color: '#111827',
};

const ticketLocation: React.CSSProperties = {
  fontSize: '0.8125rem',
  color: '#6b7280',
};

const ticketNumberSection: React.CSSProperties = {
  padding: '2rem',
  textAlign: 'center',
};

const ticketLabel: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#9ca3af',
  letterSpacing: '0.1em',
  marginBottom: '0.5rem',
};

const ticketNumber: React.CSSProperties = {
  fontSize: '4rem',
  fontWeight: 800,
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  letterSpacing: '-0.02em',
};

const perforationLine: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '0 0.5rem',
};

const perforationDot: React.CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: '#e5e7eb',
};

const ticketStats: React.CSSProperties = {
  display: 'flex',
  padding: '1.5rem',
  gap: '1rem',
};

const ticketStatItem: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '1rem',
  background: '#f9fafb',
  borderRadius: '0.75rem',
};

const ticketStatLabel: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#6b7280',
  marginBottom: '0.25rem',
};

const ticketStatValue: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 700,
  color: '#111827',
};

const successMessage: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  marginTop: '2rem',
  marginBottom: '1.5rem',
};

const successIcon: React.CSSProperties = {
  marginBottom: '1rem',
};

const successTitle: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 700,
  color: 'white',
  marginBottom: '0.5rem',
};

const successSubtitle: React.CSSProperties = {
  color: '#9ca3af',
  fontSize: '0.9375rem',
  lineHeight: 1.6,
  maxWidth: '320px',
};

const actionButtons: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  width: '100%',
};

const trackButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  padding: '1rem',
  background: 'white',
  color: '#111827',
  borderRadius: '0.75rem',
  textDecoration: 'none',
  fontWeight: 600,
};

const newTicketButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  padding: '1rem',
  background: 'rgba(255, 255, 255, 0.1)',
  color: 'white',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '0.75rem',
  cursor: 'pointer',
  fontWeight: 600,
};

const footerText: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '0.8125rem',
  textAlign: 'center',
  marginTop: '2rem',
};
