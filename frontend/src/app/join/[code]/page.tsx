'use client';

import React, { useState, useEffect, use, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { APP_NAME } from '@/lib/appConfig';

import { API_BASE } from '@/lib/apiBase';

interface IdentityFieldConfig {
  required: boolean;
  label: string;
  type?: string;
}

interface LocationInfo {
  id: string;
  name: string;
  publicCode: string;
  organization: {
    id: string;
    name: string;
    identityFieldsConfig?: Record<string, IdentityFieldConfig>;
    logoUrl?: string | null;
    primaryColor?: string | null;
    hidePoweredBy?: boolean;
  };
  services: {
    id: string;
    name: string;
    description?: string;
    type: string;
    slotDuration: number;
    startTime: string;
    endTime: string;
  }[];
}

interface JoinResult {
  ticketNumber: string;
  position: number;
  estimatedWait: number;
  queueId: string;
  entryId: string;
  serviceName: string;
  locationName: string;
  sessionId?: string;
}

interface SessionEntry {
  id: string;
  ticketNumber: string;
  status: string;
  position: number;
  serviceName: string;
  queueId: string;
}

type PageMode = 'normal' | 'kiosk' | 'session';

// Session storage key prefix
const SESSION_KEY_PREFIX = 'qms_session_';

export default function JoinQueuePage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const code = resolvedParams.code;
  const searchParams = useSearchParams();
  
  // Determine mode from URL params
  const urlMode = (searchParams?.get('mode') ?? null) as PageMode | null;
  const kioskAutoReset = parseInt(searchParams?.get('resetTime') || '15', 10); // seconds
  
  const [mode, setMode] = useState<PageMode>(urlMode || 'normal');
  const [step, setStep] = useState<'loading' | 'select-service' | 'form' | 'success' | 'error' | 'session-tickets'>('loading');
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [joinResult, setJoinResult] = useState<JoinResult | null>(null);
  const [sessionEntries, setSessionEntries] = useState<SessionEntry[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({
    name: '',
    phone: '',
    notes: '',
  });
  const [joining, setJoining] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [kioskCountdown, setKioskCountdown] = useState<number | null>(null);
  
  const printRef = useRef<HTMLDivElement>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Load or generate session ID
  useEffect(() => {
    if (mode === 'session') {
      const storedSession = localStorage.getItem(`${SESSION_KEY_PREFIX}${code}`);
      if (storedSession) {
        setSessionId(storedSession);
      } else {
        const newSessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem(`${SESSION_KEY_PREFIX}${code}`, newSessionId);
        setSessionId(newSessionId);
      }
    }
  }, [mode, code]);

  // Load session entries when in session mode
  useEffect(() => {
    if (mode === 'session' && sessionId && step === 'session-tickets') {
      loadSessionEntries();
    }
  }, [mode, sessionId, step]);

  const loadSessionEntries = async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_BASE}/public/session/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setSessionEntries(data.entries || []);
      }
    } catch (err) {
      console.error('Failed to load session entries', err);
    }
  };

  useEffect(() => {
    loadLocationInfo();
  }, [code]);

  // Kiosk mode auto-reset countdown
  useEffect(() => {
    if (mode === 'kiosk' && step === 'success') {
      setKioskCountdown(kioskAutoReset);
      countdownRef.current = setInterval(() => {
        setKioskCountdown(prev => {
          if (prev !== null && prev <= 1) {
            resetForNextCustomer();
            return null;
          }
          return prev !== null ? prev - 1 : null;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [mode, step, kioskAutoReset]);

  const resetForNextCustomer = useCallback(() => {
    // Reset all form data fields
    setFormData({});
    setSelectedServiceId('');
    setJoinResult(null);
    setError('');
    setKioskCountdown(null);
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setStep('select-service');
  }, []);

  const loadLocationInfo = async () => {
    try {
      const res = await fetch(`${API_BASE}/public/locations/${code}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (errData.error === 'ORGANIZATION_PAUSED') {
          setUnavailable(true);
        }
        throw new Error(errData.message || errData.error || 'Location not found');
      }
      const data: LocationInfo = await res.json();
      setLocation(data);
      
      if (data.services.length === 1) {
        setSelectedServiceId(data.services[0].id);
      }
      
      // In session mode, check if we have existing tickets
      if (mode === 'session' && sessionId) {
        const sessionRes = await fetch(`${API_BASE}/public/session/${sessionId}`);
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          if (sessionData.entries && sessionData.entries.length > 0) {
            setSessionEntries(sessionData.entries);
            setStep('session-tickets');
            return;
          }
        }
      }
      
      setStep('select-service');
    } catch (err) {
      console.error('Failed to load location info', err);
      setError(err instanceof Error ? err.message : 'Queue not found or no longer active');
      setStep('error');
    }
  };

  const handleSelectService = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setStep('form');
  };

  const NAME_FIELDS = ['name', 'fullName', 'firstName', 'lastName', 'customerName', 'patientName'];

  // Get identity fields config from organization, with fallback defaults
  const getIdentityFields = (): Record<string, IdentityFieldConfig> => {
    const orgConfig = location?.organization?.identityFieldsConfig;
    if (orgConfig && Object.keys(orgConfig).length > 0) {
      // Saved configs keep whatever key order they were written in; show
      // names first, then contact details, then org-specific fields.
      const ORDER = ['name', 'fullName', 'firstName', 'lastName', 'phone', 'email'];
      const rank = (key: string) => (ORDER.includes(key) ? ORDER.indexOf(key) : ORDER.length);
      return Object.fromEntries(Object.entries(orgConfig).sort(([a], [b]) => rank(a) - rank(b)));
    }
    // Default fallback if no config
    return {
      name: { required: true, label: 'Your Name', type: 'text' },
      phone: { required: false, label: 'Phone Number', type: 'tel' },
      notes: { required: false, label: 'Notes', type: 'textarea' },
    };
  };

  const handleJoinQueue = async () => {
    const identityFields = getIdentityFields();

    // Staff call people by name, and the server rejects a ticket without one -
    // even when an org's config marks every name field optional.
    const nameKeys = Object.keys(identityFields).filter((k) => NAME_FIELDS.includes(k));
    if (nameKeys.length > 0 && !nameKeys.some((k) => formData[k]?.trim())) {
      setError('Please enter your name so staff can call you.');
      return;
    }
    
    // Validate required fields
    for (const [fieldKey, fieldConfig] of Object.entries(identityFields)) {
      if (fieldConfig.required && !formData[fieldKey]?.trim()) {
        setError(`Please enter ${fieldConfig.label}`);
        return;
      }
    }

    if (!selectedServiceId) {
      setError('Please select a service');
      return;
    }

    setJoining(true);
    setError('');

    try {
      // Use session-join endpoint if in session mode
      const endpoint = mode === 'session' 
        ? `${API_BASE}/public/session-join`
        : `${API_BASE}/public/join`;
      
      // Build body data from all form fields
      const bodyData: Record<string, unknown> = {
        serviceId: selectedServiceId,
      };
      
      // Add all form fields (trimmed, excluding empty values)
      for (const [fieldKey, value] of Object.entries(formData)) {
        const trimmedValue = value?.trim();
        if (trimmedValue) {
          bodyData[fieldKey] = trimmedValue;
        }
      }
      
      if (mode === 'session') {
        bodyData.sessionId = sessionId;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'Failed to join queue');
      }

      const data: JoinResult = await res.json();
      setJoinResult(data);
      
      // In kiosk mode, auto-print the ticket
      if (mode === 'kiosk') {
        setTimeout(() => handlePrintTicket(), 500);
      }
      
      setStep('success');
    } catch (err) {
      console.error('Failed to join queue', err);
      setError(err instanceof Error ? err.message : 'Failed to join queue. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const handlePrintTicket = useCallback(() => {
    if (isPrinting || !joinResult) return;
    
    setIsPrinting(true);
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      setIsPrinting(false);
      return;
    }
    
    // Capture values to ensure they're available in the template
    const ticketNumber = joinResult.ticketNumber || 'N/A';
    const locationName = joinResult.locationName || location?.name || 'Queue';
    const serviceName = joinResult.serviceName || selectedService?.name || 'Service';
    const position = joinResult.position ?? 0;
    const estimatedWait = joinResult.estimatedWait ?? 0;
    const dateTime = new Date().toLocaleString();
    
    const ticketHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Queue Ticket - ${ticketNumber}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 5mm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              margin: 0;
              padding: 10mm;
              text-align: center;
              width: 80mm;
              background: white;
            }
            .header {
              font-size: 16pt;
              font-weight: bold;
              margin-bottom: 6mm;
              padding-bottom: 4mm;
              border-bottom: 2px dashed #333;
              letter-spacing: 1mm;
            }
            .location {
              font-size: 12pt;
              font-weight: bold;
              margin-bottom: 2mm;
              color: #000;
            }
            .service {
              font-size: 10pt;
              color: #555;
              margin-bottom: 6mm;
            }
            .ticket-number {
              font-size: 42pt;
              font-weight: bold;
              margin: 6mm 0;
              letter-spacing: 3mm;
              color: #000;
              padding: 4mm 0;
              border: 3px solid #000;
              border-radius: 4mm;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              font-size: 10pt;
              margin: 2mm 0;
              padding: 0 4mm;
            }
            .info-label {
              color: #666;
            }
            .info-value {
              font-weight: bold;
            }
            .datetime {
              font-size: 9pt;
              color: #666;
              margin-top: 4mm;
            }
            .footer {
              margin-top: 6mm;
              padding-top: 4mm;
              border-top: 2px dashed #333;
              font-size: 9pt;
              color: #555;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <div class="header">QUEUE TICKET</div>
          <div class="location">${locationName}</div>
          <div class="service">${serviceName}</div>
          <div class="ticket-number">${ticketNumber}</div>
          <div class="info-row">
            <span class="info-label">Position:</span>
            <span class="info-value">#${position}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Est. Wait:</span>
            <span class="info-value">~${estimatedWait} min</span>
          </div>
          <div class="datetime">${dateTime}</div>
          <div class="footer">
            Keep this ticket.<br/>
            Listen for your number.<br/>
            Thank you for waiting.
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(ticketHtml);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => {
        printWindow.close();
        setIsPrinting(false);
      }, 500);
    };
  }, [isPrinting, joinResult, location, selectedServiceId]);

  const selectedService = location?.services.find(s => s.id === selectedServiceId);
  const brandColor = location?.organization?.primaryColor || '#14b8a6';

  // Org logo if the org has uploaded one, otherwise the app's default mark
  const renderLogo = (size: number = 48) => (
    location?.organization?.logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={location.organization.logoUrl} alt={location.organization.name} style={{ height: `${size}px`, maxWidth: `${size * 3.3}px`, objectFit: 'contain' }} />
    ) : (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="12" fill={brandColor} />
        <path d="M14 24C14 18.477 18.477 14 24 14V14C29.523 14 34 18.477 34 24V34H14V24Z" fill="white" fillOpacity="0.9"/>
        <circle cx="24" cy="22" r="4" fill="#0d9488"/>
      </svg>
    )
  );

  // Mode selector for switching between modes
  const renderModeSelector = () => (
    <div style={modeSelectorContainer}>
      <button
        onClick={() => setMode('normal')}
        style={modeSelectorBtn(mode === 'normal')}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM0 8a8 8 0 1116 0A8 8 0 010 8z"/>
          <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
        </svg>
        Normal
      </button>
      <button
        onClick={() => setMode('kiosk')}
        style={modeSelectorBtn(mode === 'kiosk')}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M5 1a2 2 0 00-2 2v9a2 2 0 002 2h6a2 2 0 002-2V3a2 2 0 00-2-2H5zm2.5 11a.5.5 0 111 0 .5.5 0 01-1 0zM4 3h8v8H4V3z"/>
        </svg>
        Kiosk
      </button>
      <button
        onClick={() => setMode('session')}
        style={modeSelectorBtn(mode === 'session')}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6 8a3 3 0 100-6 3 3 0 000 6zm-5 6a5 5 0 0110 0H1zm11.5-5a.5.5 0 01.5.5V11h1.5a.5.5 0 010 1H13v1.5a.5.5 0 01-1 0V12h-1.5a.5.5 0 010-1H12V9.5a.5.5 0 01.5-.5z"/>
        </svg>
        Multi-Ticket
      </button>
    </div>
  );

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
          <circle cx="32" cy="32" r="28" fill={unavailable ? '#fffbeb' : '#fef2f2'} stroke={unavailable ? '#fde68a' : '#fecaca'} strokeWidth="2"/>
          <path d="M32 20v16M32 44h.01" stroke={unavailable ? '#f59e0b' : '#ef4444'} strokeWidth="4" strokeLinecap="round"/>
        </svg>
      </div>
      <h1 style={errorTitle}>{unavailable ? 'Temporarily Unavailable' : error}</h1>
      <p style={errorSubtitle}>
        {unavailable ? error : 'The queue code may be invalid or the queue may have closed.'}
      </p>
      <Link href="/locations" style={homeButton}>Browse Locations</Link>
    </div>
  );

  // Session mode: show existing tickets
  const renderSessionTickets = () => (
    <div style={infoContainer}>
      <div style={infoHeader}>
        <div style={logoBox}>
          {renderLogo()}
        </div>
        {renderModeSelector()}
      </div>

      <div style={queueDetailsCard}>
        <h1 style={queueName}>{location?.name}</h1>
        <p style={locationText}>Your Active Tickets</p>
      </div>

      <div style={formCard}>
        <h2 style={formTitle}>Your Tickets ({sessionEntries.length})</h2>
        <p style={formSubtitle}>Track all your queue tickets</p>

        <div style={sessionTicketList}>
          {sessionEntries.map(entry => (
            <Link
              key={entry.id}
              href={`/status/${entry.queueId}/${entry.id}`}
              style={sessionTicketCard}
            >
              <div style={{ ...sessionTicketNumber, color: brandColor }}>{entry.ticketNumber}</div>
              <div style={sessionTicketInfo}>
                <span style={sessionTicketService}>{entry.serviceName}</span>
                <span style={sessionTicketStatus(entry.status)}>
                  {entry.status === 'WAITING' ? `#${entry.position} in queue` : entry.status}
                </span>
              </div>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="#6b7280">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </Link>
          ))}
        </div>

        <button
          onClick={() => setStep('select-service')}
          style={{ ...addAnotherButton, background: brandColor }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
          </svg>
          Get Another Ticket
        </button>
      </div>

      {!location?.organization?.hidePoweredBy && (
        <p style={footerText}>
          Powered by <strong>{APP_NAME}</strong>
        </p>
      )}
    </div>
  );

  const renderServiceSelection = () => (
    <div style={infoContainer}>
      {/* Header */}
      <div style={infoHeader}>
        <div style={logoBox}>
          {renderLogo()}
        </div>
        {mode !== 'kiosk' && renderModeSelector()}
        {mode === 'kiosk' && (
          <div style={kioskBadge}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5 1a2 2 0 00-2 2v9a2 2 0 002 2h6a2 2 0 002-2V3a2 2 0 00-2-2H5zm2.5 11a.5.5 0 111 0 .5.5 0 01-1 0zM4 3h8v8H4V3z"/>
            </svg>
            Kiosk Mode
          </div>
        )}
      </div>

      {/* Location Details */}
      <div style={queueDetailsCard}>
        <h1 style={queueName}>{location?.name}</h1>
        <p style={locationText}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="#6b7280" style={{ marginRight: '0.25rem' }}>
            <path fillRule="evenodd" d="M8 1a5 5 0 00-5 5c0 2.764 5 9 5 9s5-6.236 5-9a5 5 0 00-5-5zm0 7a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
          </svg>
          {location?.organization?.name}
        </p>
        {mode === 'kiosk' && (
          <p style={kioskInstructions}>Touch a service to get your ticket</p>
        )}
      </div>

      {/* Service Selection */}
      <div style={formCard}>
        <h2 style={formTitle}>Select a Service</h2>
        <p style={formSubtitle}>Choose the service you need</p>

        <div style={serviceList}>
          {location?.services.map(service => (
            <button
              key={service.id}
              onClick={() => handleSelectService(service.id)}
              style={mode === 'kiosk' ? kioskServiceButton : serviceButton}
            >
              <div style={serviceInfo}>
                <span style={serviceName}>{service.name}</span>
                {service.description && <span style={serviceDesc}>{service.description}</span>}
                <span style={serviceTime}>{service.startTime} - {service.endTime}</span>
              </div>
              <svg width="20" height="20" viewBox="0 0 20 20" fill={brandColor}>
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          ))}
          {location?.services.length === 0 && (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '1rem' }}>
              No services available at this location.
            </p>
          )}
        </div>

        {/* Session mode: show link to existing tickets */}
        {mode === 'session' && sessionEntries.length > 0 && (
          <button
            onClick={() => setStep('session-tickets')}
            style={viewTicketsButton}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 4a2 2 0 012-2h6a2 2 0 012 2v1h2a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-1H2a2 2 0 01-2-2V4z"/>
            </svg>
            View Your {sessionEntries.length} Ticket{sessionEntries.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {!location?.organization?.hidePoweredBy && (
        <p style={footerText}>
          Powered by <strong>{APP_NAME}</strong>
        </p>
      )}
    </div>
  );

  const renderForm = () => (
    <div style={infoContainer}>
      {/* Header */}
      <div style={infoHeader}>
        <button onClick={() => setStep('select-service')} style={backBtn}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back
        </button>
        {mode === 'kiosk' ? (
          <div style={kioskBadge}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5 1a2 2 0 00-2 2v9a2 2 0 002 2h6a2 2 0 002-2V3a2 2 0 00-2-2H5zm2.5 11a.5.5 0 111 0 .5.5 0 01-1 0zM4 3h8v8H4V3z"/>
            </svg>
            Kiosk Mode
          </div>
        ) : (
          <div style={statusBadge('ACTIVE')}>
            <span style={statusDot('ACTIVE')} />
            <span>Open</span>
          </div>
        )}
      </div>

      {/* Service Info */}
      <div style={queueDetailsCard}>
        <h1 style={queueName}>{selectedService?.name}</h1>
        <p style={locationText}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="#6b7280" style={{ marginRight: '0.25rem' }}>
            <path fillRule="evenodd" d="M8 1a5 5 0 00-5 5c0 2.764 5 9 5 9s5-6.236 5-9a5 5 0 00-5-5zm0 7a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
          </svg>
          {location?.name}
        </p>
      </div>

      {/* Join Form */}
      <div style={formCard}>
        <h2 style={formTitle}>
          {mode === 'kiosk' ? 'Enter Your Details' : 'Join the Queue'}
        </h2>
        <p style={formSubtitle}>
          {mode === 'kiosk' 
            ? 'Touch fields to enter your information' 
            : 'Enter your details to receive your ticket'}
        </p>

        {error && (
          <div style={errorAlert}>
            <span>{error}</span>
          </div>
        )}

        <div style={formFields}>
          {/* Render fields dynamically based on organization identity config */}
          {Object.entries(getIdentityFields()).map(([fieldKey, fieldConfig]) => {
            // In kiosk mode, only show required fields (typically just name)
            if (mode === 'kiosk' && !fieldConfig.required && !NAME_FIELDS.includes(fieldKey)) {
              return null;
            }

            const inputType = fieldConfig.type || 'text';
            const isTextarea = inputType === 'textarea';

            return (
              <div key={fieldKey} style={fieldGroup}>
                <label style={labelStyle} htmlFor={`field-${fieldKey}`}>
                  {fieldConfig.label}
                  {fieldConfig.required && ' *'}
                </label>
                {isTextarea ? (
                  <textarea
                    id={`field-${fieldKey}`}
                    value={formData[fieldKey] || ''}
                    onChange={(e) => { 
                      setError(''); 
                      setFormData({ ...formData, [fieldKey]: e.target.value }); 
                    }}
                    placeholder={fieldConfig.label}
                    style={textareaStyle}
                    rows={3}
                  />
                ) : fieldKey === 'gender' ? (
                  <select
                    id={`field-${fieldKey}`}
                    value={formData[fieldKey] || ''}
                    onChange={(e) => { 
                      setError(''); 
                      setFormData({ ...formData, [fieldKey]: e.target.value }); 
                    }}
                    style={mode === 'kiosk' ? kioskInputStyle : inputStyle}
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                ) : (
                  <input
                    type={inputType}
                    id={`field-${fieldKey}`}
                    value={formData[fieldKey] || ''}
                    onChange={(e) => { 
                      setError(''); 
                      setFormData({ ...formData, [fieldKey]: e.target.value }); 
                    }}
                    placeholder={fieldConfig.label}
                    style={mode === 'kiosk' ? kioskInputStyle : inputStyle}
                    required={fieldConfig.required}
                  />
                )}
                {fieldKey === 'phone' && !fieldConfig.required && (
                  <span style={helpText}>We&apos;ll send you SMS updates about your position</span>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={handleJoinQueue}
          disabled={joining}
          style={{ ...(mode === 'kiosk' ? kioskJoinButton : joinButton), background: brandColor }}
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

      {!location?.organization?.hidePoweredBy && (
        <p style={footerText}>
          Powered by <strong>{APP_NAME}</strong>
        </p>
      )}
    </div>
  );

  const renderSuccess = () => (
    <div style={successContainer}>
      {/* Kiosk countdown */}
      {mode === 'kiosk' && kioskCountdown !== null && (
        <div style={kioskCountdownBanner}>
          <div style={{ ...countdownProgress, background: brandColor }} className="countdown-progress" />
          <span>Next customer in {kioskCountdown}s - Touch to cancel</span>
          <button 
            onClick={() => {
              setKioskCountdown(null);
              if (countdownRef.current) {
                clearInterval(countdownRef.current);
              }
            }}
            style={cancelCountdownBtn}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Printable Ticket (hidden, used for printing) */}
      <div ref={printRef} style={{ display: 'none' }}>
        <div id="printable-ticket">
          <h2>{joinResult?.locationName}</h2>
          <h3>{joinResult?.serviceName}</h3>
          <h1 style={{ fontSize: '48pt' }}>{joinResult?.ticketNumber}</h1>
          <p>Position: #{joinResult?.position}</p>
          <p>Est. Wait: ~{joinResult?.estimatedWait} min</p>
          <p>{new Date().toLocaleString()}</p>
        </div>
      </div>

      {/* Ticket Card */}
      <div style={mode === 'kiosk' ? kioskTicketCard : ticketCard}>
        {/* Ticket Header */}
        <div style={ticketHeader}>
          <div style={logoSmall}>
            {renderLogo(32)}
          </div>
          <div>
            <p style={ticketServiceName}>{joinResult?.serviceName}</p>
            <p style={ticketLocation}>{joinResult?.locationName}</p>
          </div>
        </div>

        {/* Ticket Number */}
        <div style={ticketNumberSection}>
          <span style={ticketLabel}>YOUR TICKET</span>
          <span style={mode === 'kiosk' ? kioskTicketNumberStyle : ticketNumberStyle}>{joinResult?.ticketNumber}</span>
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
            <span style={mode === 'kiosk' ? kioskTicketStatValue : ticketStatValue}>#{joinResult?.position}</span>
          </div>
          <div style={ticketStatItem}>
            <span style={ticketStatLabel}>Est. Wait</span>
            <span style={mode === 'kiosk' ? kioskTicketStatValue : ticketStatValue}>~{joinResult?.estimatedWait} min</span>
          </div>
        </div>
      </div>

      {/* Success message */}
      <div style={successMessage}>
        <div style={successIconStyle}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" fill="#dcfce7"/>
            <path d="M10 16l4 4 8-8" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 style={successTitle}>You&apos;re in the queue!</h2>
        <p style={successSubtitle}>
          {mode === 'kiosk' 
            ? 'Please take your printed ticket and wait for your number to be called.'
            : 'Keep this page open to track your position in real-time. We\'ll notify you when it\'s almost your turn.'}
        </p>
      </div>

      {/* Actions */}
      <div style={actionButtons}>
        {mode === 'kiosk' ? (
          <>
            <button onClick={handlePrintTicket} disabled={isPrinting} style={printButton}>
              {isPrinting ? (
                <>
                  <div className="spinner spinner-sm" style={{ borderTopColor: 'white' }} />
                  <span>Printing...</span>
                </>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                  </svg>
                  <span>Print Ticket Again</span>
                </>
              )}
            </button>
            <button onClick={resetForNextCustomer} style={nextCustomerButton}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
              </svg>
              <span>Next Customer</span>
            </button>
          </>
        ) : (
          <>
            <Link href={`/status/${joinResult?.queueId}/${joinResult?.entryId}`} style={trackButton}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd"/>
              </svg>
              <span>Track My Position</span>
            </Link>
            {mode === 'session' ? (
              <button 
                onClick={() => {
                  loadSessionEntries();
                  setStep('session-tickets');
                }} 
                style={newTicketButton}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 4a2 2 0 012-2h6a2 2 0 012 2v1h2a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-1H2a2 2 0 01-2-2V4z"/>
                </svg>
                <span>View All Tickets</span>
              </button>
            ) : (
              <button onClick={() => window.location.reload()} style={newTicketButton}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
                </svg>
                <span>Get Another Ticket</span>
              </button>
            )}
          </>
        )}
      </div>

      {!location?.organization?.hidePoweredBy && (
        <p style={footerText}>
          Powered by <strong>{APP_NAME}</strong>
        </p>
      )}
    </div>
  );

  return (
    <div style={mode === 'kiosk' ? kioskPageStyle : pageStyle}>
      <div style={bgPattern} />
      <div style={contentStyle}>
        {step === 'loading' && renderLoading()}
        {step === 'error' && renderError()}
        {step === 'select-service' && renderServiceSelection()}
        {step === 'form' && renderForm()}
        {step === 'success' && renderSuccess()}
        {step === 'session-tickets' && renderSessionTickets()}
      </div>
      
      {/* Kiosk mode CSS for animations */}
      <style jsx global>{`
        @keyframes countdown-shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        .countdown-progress {
          animation: countdown-shrink ${kioskAutoReset}s linear forwards;
        }
      `}</style>
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
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2314b8a6' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
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
  background: '#14b8a6',
  color: 'white',
  borderRadius: '0.75rem',
  textDecoration: 'none',
  fontWeight: 600,
};

const backBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  background: 'transparent',
  border: 'none',
  color: 'white',
  cursor: 'pointer',
  fontSize: '0.9375rem',
  fontWeight: 500,
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
  marginBottom: '0.5rem',
};

const serviceList: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};

const serviceButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '1rem',
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '0.75rem',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'all 0.15s ease',
};

const serviceInfo: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const serviceName: React.CSSProperties = {
  fontWeight: 600,
  color: '#111827',
};

const serviceDesc: React.CSSProperties = {
  fontSize: '0.8125rem',
  color: '#6b7280',
};

const serviceTime: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#9ca3af',
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
  background: '#14b8a6',
  border: 'none',
  borderRadius: '0.75rem',
  cursor: 'pointer',
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

const ticketNumberStyle: React.CSSProperties = {
  fontSize: '4rem',
  fontWeight: 800,
  background: 'var(--gradient-ticket)',
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

const successIconStyle: React.CSSProperties = {
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

// ========== KIOSK MODE STYLES ==========

const kioskPageStyle: React.CSSProperties = {
  ...pageStyle,
  cursor: 'default',
  userSelect: 'none',
};

const kioskBadge: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem 1rem',
  background: '#fef3c7',
  color: '#854d0e',
  borderRadius: '9999px',
  fontSize: '0.875rem',
  fontWeight: 600,
};

const kioskInstructions: React.CSSProperties = {
  marginTop: '0.5rem',
  padding: '0.5rem 1rem',
  background: '#f3f4f6',
  borderRadius: '0.5rem',
  color: '#4b5563',
  fontSize: '0.875rem',
};

const kioskServiceButton: React.CSSProperties = {
  ...serviceButton,
  padding: '1.5rem',
  fontSize: '1.125rem',
  minHeight: '80px',
};

const kioskInputStyle: React.CSSProperties = {
  ...inputStyle,
  padding: '1rem 1.25rem',
  fontSize: '1.25rem',
  minHeight: '56px',
};

const kioskJoinButton: React.CSSProperties = {
  ...joinButton,
  padding: '1.25rem',
  fontSize: '1.125rem',
  minHeight: '60px',
};

const kioskTicketCard: React.CSSProperties = {
  ...ticketCard,
  transform: 'scale(1.05)',
};

const kioskTicketNumberStyle: React.CSSProperties = {
  ...ticketNumberStyle,
  fontSize: '5rem',
};

const kioskTicketStatValue: React.CSSProperties = {
  ...ticketStatValue,
  fontSize: '1.5rem',
};

const kioskCountdownBanner: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1rem',
  padding: '1rem',
  background: '#1f2937',
  color: 'white',
  fontSize: '0.9375rem',
  zIndex: 100,
};

const countdownProgress: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  height: '3px',
  background: '#14b8a6',
};

const cancelCountdownBtn: React.CSSProperties = {
  padding: '0.5rem 1rem',
  background: '#ef4444',
  color: 'white',
  border: 'none',
  borderRadius: '0.5rem',
  cursor: 'pointer',
  fontWeight: 600,
};

const printButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  padding: '1.25rem',
  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '0.75rem',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '1rem',
  minHeight: '60px',
};

const nextCustomerButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  padding: '1.25rem',
  background: 'rgba(255, 255, 255, 0.1)',
  color: 'white',
  border: '2px solid rgba(255, 255, 255, 0.3)',
  borderRadius: '0.75rem',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '1rem',
  minHeight: '60px',
};

// ========== MODE SELECTOR STYLES ==========

const modeSelectorContainer: React.CSSProperties = {
  display: 'flex',
  gap: '0.25rem',
  background: 'rgba(255, 255, 255, 0.1)',
  padding: '0.25rem',
  borderRadius: '0.5rem',
};

const modeSelectorBtn = (isActive: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '0.375rem',
  padding: '0.375rem 0.75rem',
  background: isActive ? 'white' : 'transparent',
  color: isActive ? '#111827' : 'rgba(255, 255, 255, 0.7)',
  border: 'none',
  borderRadius: '0.375rem',
  cursor: 'pointer',
  fontSize: '0.75rem',
  fontWeight: 500,
  transition: 'all 0.15s ease',
});

// ========== SESSION MODE STYLES ==========

const sessionTicketList: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  marginBottom: '1rem',
};

const sessionTicketCard: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  padding: '1rem',
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '0.75rem',
  textDecoration: 'none',
  transition: 'all 0.15s ease',
};

const sessionTicketNumber: React.CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 700,
  color: '#0d9488',
  minWidth: '80px',
};

const sessionTicketInfo: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const sessionTicketService: React.CSSProperties = {
  fontWeight: 600,
  color: '#111827',
};

const sessionTicketStatus = (status: string): React.CSSProperties => ({
  fontSize: '0.8125rem',
  color: status === 'WAITING' ? '#6b7280' : status === 'SERVING' ? '#059669' : '#9ca3af',
  fontWeight: status === 'SERVING' ? 600 : 400,
});

const addAnotherButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  width: '100%',
  padding: '1rem',
  background: '#14b8a6',
  color: 'white',
  border: 'none',
  borderRadius: '0.75rem',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '1rem',
};

const viewTicketsButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  width: '100%',
  padding: '0.75rem',
  marginTop: '1rem',
  background: '#f3f4f6',
  color: '#374151',
  border: 'none',
  borderRadius: '0.5rem',
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: '0.875rem',
};
