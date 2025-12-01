'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';

interface QueueStatus {
  ticketNumber: string;
  position: number;
  estimatedWaitTime: number;
  serviceName: string;
  locationName: string;
  status: 'WAITING' | 'CALLED' | 'SERVING' | 'COMPLETED' | 'CANCELLED';
  currentlyServing: string;
  totalInQueue: number;
}

export default function QueueStatusPage({ 
  params 
}: { 
  params: Promise<{ queueId: string; entryId: string }> 
}) {
  const resolvedParams = use(params);
  const { queueId, entryId } = resolvedParams;
  
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    loadStatus();
    // In real app, connect to WebSocket for real-time updates
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, [queueId, entryId]);

  const loadStatus = async () => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setStatus({
        ticketNumber: 'A-013',
        position: 5,
        estimatedWaitTime: 15,
        serviceName: 'General Consultation',
        locationName: 'Main Clinic - Ground Floor',
        status: 'WAITING',
        currentlyServing: 'A-008',
        totalInQueue: 12,
      });
    } catch (err) {
      console.error('Failed to load status', err);
    } finally {
      setLoading(false);
    }
  };

  const enableNotifications = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WAITING': return '#6366f1';
      case 'CALLED': return '#f59e0b';
      case 'SERVING': return '#10b981';
      case 'COMPLETED': return '#059669';
      case 'CANCELLED': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'WAITING': return 'Waiting in Queue';
      case 'CALLED': return 'You\'re Being Called!';
      case 'SERVING': return 'Now Being Served';
      case 'COMPLETED': return 'Completed';
      case 'CANCELLED': return 'Cancelled';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={bgPattern} />
        <div style={loadingContainer}>
          <div className="spinner" style={spinnerLarge} />
          <p style={loadingText}>Loading your status...</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div style={pageStyle}>
        <div style={bgPattern} />
        <div style={errorContainer}>
          <h1 style={errorTitle}>Ticket Not Found</h1>
          <p style={errorSubtitle}>This ticket may have been cancelled or completed.</p>
          <Link href="/" style={homeButton}>Go to Homepage</Link>
        </div>
      </div>
    );
  }

  const isCalled = status.status === 'CALLED';

  return (
    <div style={{ ...pageStyle, background: isCalled ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : pageStyle.background }}>
      <div style={bgPattern} />
      
      <div style={contentStyle}>
        {/* Status indicator for called */}
        {isCalled && (
          <div style={calledBanner}>
            <div style={pulsingCircle} />
            <span style={calledText}>It&apos;s Your Turn!</span>
          </div>
        )}

        {/* Header */}
        <div style={headerStyle}>
          <div style={logoBox}>
            <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="white" fillOpacity="0.2" />
              <path d="M14 24C14 18.477 18.477 14 24 14V14C29.523 14 34 18.477 34 24V34H14V24Z" fill="white" fillOpacity="0.9"/>
              <circle cx="24" cy="22" r="4" fill={isCalled ? '#f59e0b' : '#6366f1'}/>
            </svg>
          </div>
          <div style={headerInfo}>
            <p style={serviceName}>{status.serviceName}</p>
            <p style={locationName}>{status.locationName}</p>
          </div>
        </div>

        {/* Main Status Card */}
        <div style={statusCard}>
          {/* Ticket Number */}
          <div style={ticketSection}>
            <span style={ticketLabel}>YOUR TICKET</span>
            <span style={ticketNumber}>{status.ticketNumber}</span>
          </div>

          {/* Status Badge */}
          <div style={statusBadgeContainer}>
            <div style={{ ...statusBadge, background: `${getStatusColor(status.status)}15`, color: getStatusColor(status.status) }}>
              <span style={{ ...statusDot, background: getStatusColor(status.status) }} />
              <span>{getStatusText(status.status)}</span>
            </div>
          </div>

          {/* Position Display */}
          {status.status === 'WAITING' && (
            <div style={positionSection}>
              <div style={positionRing}>
                <svg width="160" height="160" viewBox="0 0 160 160">
                  {/* Background circle */}
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${((status.totalInQueue - status.position) / status.totalInQueue) * 439.82} 439.82`}
                    transform="rotate(-90 80 80)"
                    style={{ transition: 'stroke-dasharray 0.5s ease' }}
                  />
                </svg>
                <div style={positionContent}>
                  <span style={positionNumber}>{status.position}</span>
                  <span style={positionLabel}>in line</span>
                </div>
              </div>
            </div>
          )}

          {/* Wait Time */}
          <div style={infoGrid}>
            <div style={infoItem}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <div>
                <span style={infoLabel}>Estimated Wait</span>
                <span style={infoValue}>~{status.estimatedWaitTime} min</span>
              </div>
            </div>
            <div style={infoItem}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <div>
                <span style={infoLabel}>Now Serving</span>
                <span style={infoValue}>{status.currentlyServing}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {!notificationsEnabled && status.status === 'WAITING' && (
          <button onClick={enableNotifications} style={notifyButton}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
            <span>Notify me when it&apos;s my turn</span>
          </button>
        )}

        {notificationsEnabled && (
          <div style={notifyEnabled}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="#10b981">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>You&apos;ll be notified when it&apos;s your turn</span>
          </div>
        )}

        {/* Actions */}
        <div style={actionButtons}>
          <button onClick={loadStatus} style={refreshButton}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            <span>Refresh Status</span>
          </button>
        </div>

        {/* Help text */}
        <p style={helpText}>
          This page updates automatically. Please stay nearby when your number approaches.
        </p>

        <p style={footerText}>
          Powered by <strong>QMS</strong>
        </p>
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
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
};

const contentStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  minHeight: '100vh',
  padding: '2rem',
  paddingTop: '3rem',
};

const loadingContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  gap: '1.5rem',
  position: 'relative',
  zIndex: 1,
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

const errorContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  textAlign: 'center',
  position: 'relative',
  zIndex: 1,
};

const errorTitle: React.CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 700,
  color: 'white',
  marginBottom: '0.5rem',
};

const errorSubtitle: React.CSSProperties = {
  color: '#9ca3af',
  marginBottom: '2rem',
};

const homeButton: React.CSSProperties = {
  padding: '0.75rem 1.5rem',
  background: '#6366f1',
  color: 'white',
  borderRadius: '0.75rem',
  textDecoration: 'none',
  fontWeight: 600,
};

const calledBanner: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '1rem 2rem',
  background: 'white',
  borderRadius: '9999px',
  marginBottom: '2rem',
  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
};

const pulsingCircle: React.CSSProperties = {
  width: '12px',
  height: '12px',
  borderRadius: '50%',
  background: '#f59e0b',
  animation: 'pulse 1s infinite',
};

const calledText: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '1.125rem',
  color: '#111827',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  marginBottom: '2rem',
};

const logoBox: React.CSSProperties = {
  display: 'flex',
};

const headerInfo: React.CSSProperties = {
  textAlign: 'left',
};

const serviceName: React.CSSProperties = {
  fontWeight: 600,
  color: 'white',
  fontSize: '1.125rem',
};

const locationName: React.CSSProperties = {
  color: 'rgba(255, 255, 255, 0.7)',
  fontSize: '0.875rem',
};

const statusCard: React.CSSProperties = {
  width: '100%',
  maxWidth: '400px',
  background: 'white',
  borderRadius: '1.5rem',
  padding: '2rem',
  boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
};

const ticketSection: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: '1.5rem',
};

const ticketLabel: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#9ca3af',
  letterSpacing: '0.1em',
  marginBottom: '0.25rem',
};

const ticketNumber: React.CSSProperties = {
  fontSize: '2.5rem',
  fontWeight: 800,
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

const statusBadgeContainer: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  marginBottom: '2rem',
};

const statusBadge: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem 1rem',
  borderRadius: '9999px',
  fontSize: '0.875rem',
  fontWeight: 600,
};

const statusDot: React.CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
};

const positionSection: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  marginBottom: '2rem',
};

const positionRing: React.CSSProperties = {
  position: 'relative',
  width: '160px',
  height: '160px',
};

const positionContent: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
};

const positionNumber: React.CSSProperties = {
  fontSize: '3rem',
  fontWeight: 800,
  color: '#111827',
  lineHeight: 1,
};

const positionLabel: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#6b7280',
  marginTop: '0.25rem',
};

const infoGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '1rem',
};

const infoItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '1rem',
  background: '#f9fafb',
  borderRadius: '0.75rem',
};

const infoLabel: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  color: '#6b7280',
};

const infoValue: React.CSSProperties = {
  display: 'block',
  fontSize: '1rem',
  fontWeight: 600,
  color: '#111827',
};

const notifyButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  width: '100%',
  maxWidth: '400px',
  padding: '1rem',
  marginTop: '1.5rem',
  background: 'white',
  color: '#111827',
  border: 'none',
  borderRadius: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const notifyEnabled: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  width: '100%',
  maxWidth: '400px',
  padding: '1rem',
  marginTop: '1.5rem',
  background: 'rgba(16, 185, 129, 0.1)',
  color: '#10b981',
  borderRadius: '0.75rem',
  fontWeight: 500,
  fontSize: '0.9375rem',
};

const actionButtons: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  width: '100%',
  maxWidth: '400px',
  marginTop: '1rem',
};

const refreshButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  flex: 1,
  padding: '0.875rem',
  background: 'rgba(255, 255, 255, 0.1)',
  color: 'white',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const helpText: React.CSSProperties = {
  color: 'rgba(255, 255, 255, 0.5)',
  fontSize: '0.8125rem',
  textAlign: 'center',
  marginTop: '1.5rem',
  maxWidth: '320px',
  lineHeight: 1.5,
};

const footerText: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '0.8125rem',
  textAlign: 'center',
  marginTop: '2rem',
};