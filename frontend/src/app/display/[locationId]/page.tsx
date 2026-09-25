'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import api from '@/api/client';
import { useSocket } from '@/hooks/useSocket';
import type { Location } from '@/types';
import { APP_NAME } from '@/lib/appConfig';

interface BrandedLocation extends Location {
  organization?: {
    id: string;
    name: string;
    logoUrl?: string | null;
    primaryColor?: string | null;
    hidePoweredBy?: boolean;
  };
}

// Expands a hex color (e.g. "#7c3aed") to an rgba() string for glow/tint
// overlays - the display board's CSS uses rgba accents throughout, and an
// org's primaryColor is stored as plain hex.
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num) || full.length !== 6) return `rgba(59, 130, 246, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface DisplayEntry {
  ticketNumber: string;
  serviceName: string;
  servicePointName: string;
}

interface DisplayServicePoint {
  id: string;
  name: string;
  displayName?: string;
  type: string;
  displayMode: string;
  currentlyServing: {
    ticketNumber: string;
    customerName: string;
    serviceName: string;
  } | null;
}

interface QueueSwimlane {
  serviceId: string;
  serviceName: string;
  serviceType: string;
  displayMode: string; // TICKET_ONLY, NAME_AND_TICKET, FULL_INFO
  queueId: string | null;
  queueStatus: string;
  activeServicePoints: number;
  stats: {
    serving: number;
    waiting: number;
    total: number;
  };
  currentlyServing: {
    id: string;
    ticketNumber: string;
    customerName: string;
    servicePoint: string | null;
    calledAt: string;
  }[];
  waitingList: {
    id: string;
    ticketNumber: string;
    customerName: string;
    position: number;
    joinedAt: string;
    estimatedWait: number;
  }[];
  estimatedWaitPerPerson: number;
}

type ViewMode = 'swimlanes' | 'service-points' | 'single-queue';

const TVDisplayPage: React.FC = () => {
  const params = useParams();
  const locationId = params.locationId as string;
  
  const [location, setLocation] = useState<BrandedLocation | null>(null);
  const [servicePoints, setServicePoints] = useState<DisplayServicePoint[]>([]);
  const [swimlanes, setSwimlanes] = useState<QueueSwimlane[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvedLocationId, setResolvedLocationId] = useState<string | null>(null);
  const [hasServicePoints, setHasServicePoints] = useState<boolean | null>(null);
  
  // View mode and selection
  const [viewMode, setViewMode] = useState<ViewMode>('swimlanes');
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Theme management
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  
  // Audio announcements
  const [audioEnabled, setAudioEnabled] = useState(false);
  const announcedTicketsRef = useRef<Set<string>>(new Set());
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);

  const searchParams = useSearchParams();
  const { joinLocation, onQueueUpdated, onEntryStatusChanged } = useSocket();
  const containerRef = useRef<HTMLDivElement>(null);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  // Audio announcement function
  const announceTicket = useCallback((ticketNumber: string, servicePointName?: string) => {
    if (!audioEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
    
    // Don't announce same ticket twice
    if (announcedTicketsRef.current.has(ticketNumber)) return;
    announcedTicketsRef.current.add(ticketNumber);
    
    // Clear old announced tickets (keep last 20)
    if (announcedTicketsRef.current.size > 20) {
      const arr = Array.from(announcedTicketsRef.current);
      announcedTicketsRef.current = new Set(arr.slice(-20));
    }
    
    // Create announcement
    const text = servicePointName 
      ? `Ticket ${ticketNumber}, please proceed to ${servicePointName}`
      : `Now serving ticket ${ticketNumber}`;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    window.speechSynthesis.cancel(); // Cancel any ongoing speech
    window.speechSynthesis.speak(utterance);
  }, [audioEnabled]);
  
  // Monitor serving entries for announcements
  useEffect(() => {
    if (!audioEnabled) return;
    
    if (viewMode === 'service-points') {
      servicePoints.forEach(sp => {
        if (sp.currentlyServing?.ticketNumber) {
          announceTicket(sp.currentlyServing.ticketNumber, sp.displayName || sp.name);
        }
      });
    } else if (viewMode === 'swimlanes') {
      swimlanes.forEach(lane => {
        lane.currentlyServing.forEach(entry => {
          announceTicket(entry.ticketNumber, entry.servicePoint || undefined);
        });
      });
    }
  }, [servicePoints, swimlanes, viewMode, audioEnabled, announceTicket]);
  
  // Track if initial load completed
  const initialLoadDone = useRef(false);

  // Fetch data and try to handle both internal IDs and public codes
  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);

      let idToUse = resolvedLocationId || locationId;

      // Only resolve on initial load
      if (!resolvedLocationId) {
        try {
          const publicLocation = await api.getLocationByCode(locationId);
          if (publicLocation && publicLocation.id) {
            setLocation(publicLocation);
            idToUse = publicLocation.id;
            setResolvedLocationId(publicLocation.id);
          }
        } catch (_) {
          try {
            const locationInfo = await api.getPublicLocationInfo(locationId);
            if (locationInfo) {
              setLocation(locationInfo);
              idToUse = locationId;
              setResolvedLocationId(locationId);
              setHasServicePoints((locationInfo._count?.servicePoints || 0) > 0);
            }
          } catch (_) {
            setResolvedLocationId(locationId);
          }
        }
      }

      // Fetch both service points and queue swimlanes
      const [displayData, queuesData] = await Promise.all([
        api.getDisplayData(idToUse),
        api.getLocationQueues(idToUse).catch(() => ({ swimlanes: [] })),
      ]);

      // Track if service points exist
      if (hasServicePoints === null) {
        setHasServicePoints((displayData || []).length > 0);
      }

      // Handle service point focus
      const focusSp = searchParams?.get('servicePoint') || searchParams?.get('sp') || null;
      if (focusSp) {
        const focused = (displayData || []).filter((d: any) => d.id === focusSp);
        setServicePoints(focused);
      } else {
        setServicePoints(displayData || []);
      }

      // Handle queue focus from URL
      const focusQueue = searchParams?.get('queue') || searchParams?.get('q') || null;
      if (focusQueue && !selectedQueueId) {
        setSelectedQueueId(focusQueue);
        setViewMode('single-queue');
      }

      setSwimlanes(queuesData.swimlanes || []);
      setError('');
    } catch (err) {
      console.error('Failed to fetch display data', err);
      setError('Failed to load display data');
      setServicePoints([]);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [locationId, searchParams, resolvedLocationId, hasServicePoints, selectedQueueId]);

  // Initial load
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchData(true);
    }
  }, [fetchData]);

  // Socket.IO real-time updates
  useEffect(() => {
    if (!resolvedLocationId) return;

    joinLocation(resolvedLocationId);

    const unsubQueue = onQueueUpdated(() => {
      fetchData(false);
    });

    const unsubEntry = onEntryStatusChanged(() => {
      fetchData(false);
    });

    return () => {
      unsubQueue();
      unsubEntry();
    };
  }, [resolvedLocationId, joinLocation, onQueueUpdated, onEntryStatusChanged, fetchData]);

  // Fallback polling
  useEffect(() => {
    const refreshInterval = setInterval(() => fetchData(false), 30000);
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => {
      clearInterval(refreshInterval);
      clearInterval(clockInterval);
    };
  }, [fetchData]);

  // Get service points with currently serving entries
  const activePoints = servicePoints.filter((sp: DisplayServicePoint) => sp.currentlyServing);
  const waitingAnnouncements = activePoints.slice(0, 5);

  // Get selected swimlane for single-queue view
  const selectedSwimlane = swimlanes.find(s => s.queueId === selectedQueueId);

  // Helper to check if customer names should be shown based on displayMode
  const shouldShowName = (displayMode: string) => {
    return displayMode === 'NAME_AND_TICKET' || displayMode === 'FULL_INFO';
  };

  const brandColor = location?.organization?.primaryColor || '#3b82f6';
  const brandGlow = hexToRgba(brandColor, 0.35);

  if (loading) {
    return (
      <div className="display-container loading">
        <div className="loading-spinner" />
        <p>Loading display...</p>
        <style jsx>{`
          .display-container {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #0f172a;
            color: white;
          }
          .loading-spinner {
            width: 60px;
            height: 60px;
            border: 4px solid rgba(255,255,255,0.2);
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Format wait time in a human-readable way
  const formatWaitTime = (minutes: number) => {
    if (minutes < 1) return 'Now';
    if (minutes < 60) return `~${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `~${hours}h ${mins}m` : `~${hours}h`;
  };

  return (
    <div
      className="display-container"
      data-theme={theme}
      ref={containerRef}
      style={{ '--brand-color': brandColor, '--brand-glow': brandGlow } as React.CSSProperties}
    >
      {/* Header */}
      <header className="display-header">
        <div className="header-left">
          {location?.organization?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={location.organization.logoUrl} alt={location.organization.name} className="org-logo" />
          )}
          <div>
            <h1 className="location-name">{location?.name || 'Queue Display'}</h1>
            <p className="subtitle">
              {viewMode === 'single-queue' && selectedSwimlane
                ? selectedSwimlane.serviceName
                : 'Now Serving'}
            </p>
          </div>
        </div>

        {/* View Mode Selector */}
        <div className="view-selector">
          <button 
            className={`view-btn ${viewMode === 'swimlanes' ? 'active' : ''}`}
            onClick={() => { setViewMode('swimlanes'); setSelectedQueueId(null); }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
            <span>Queues</span>
          </button>
          <button 
            className={`view-btn ${viewMode === 'service-points' ? 'active' : ''}`}
            onClick={() => { setViewMode('service-points'); setSelectedQueueId(null); }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Counters</span>
          </button>
          <button 
            className={`view-btn ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <button 
            className={`view-btn ${audioEnabled ? 'active' : ''}`}
            onClick={() => setAudioEnabled(!audioEnabled)}
            title={audioEnabled ? 'Disable audio announcements' : 'Enable audio announcements'}
          >
            {audioEnabled ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            )}
          </button>
          <button className="view-btn fullscreen-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}>
            {isFullscreen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            )}
          </button>
        </div>

        <div className="header-right">
          <div className="time">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="date">
            {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </header>

      {/* Main Display */}
      <main className="display-main">
        {error && <div className="error-message">{error}</div>}

        {/* Swimlanes View */}
        {viewMode === 'swimlanes' && (
          <>
            {swimlanes.length === 0 ? (
              <div className="empty-display">
                <svg width="160" height="160" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <h2>No Active Queues</h2>
                <p>No services have queues today</p>
              </div>
            ) : (
              <div className="swimlanes-container">
                {swimlanes.map(lane => (
                  <div 
                    key={lane.serviceId} 
                    className={`swimlane ${lane.stats.serving > 0 ? 'has-serving' : ''}`}
                    onClick={() => { setSelectedQueueId(lane.queueId); setViewMode('single-queue'); }}
                  >
                    <div className="swimlane-header">
                      <div className="swimlane-title-row">
                        <h3 className="swimlane-title">{lane.serviceName}</h3>
                        {lane.activeServicePoints > 0 && (
                          <span className="service-points-count" title="Active service points">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                              <path d="M16 3v4" />
                              <path d="M8 3v4" />
                            </svg>
                            {lane.activeServicePoints}
                          </span>
                        )}
                      </div>
                      <div className="swimlane-stats">
                        <span className="stat serving">{lane.stats.serving} serving</span>
                        <span className="stat waiting">{lane.stats.waiting} waiting</span>
                        {lane.stats.waiting > 0 && lane.estimatedWaitPerPerson > 0 && (
                          <span className="stat wait-time">
                            {formatWaitTime(lane.waitingList[lane.waitingList.length - 1]?.estimatedWait || lane.estimatedWaitPerPerson * lane.stats.waiting)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {lane.currentlyServing.length > 0 ? (
                      <div className="swimlane-serving">
                        {lane.currentlyServing.map(entry => (
                          <div key={entry.id} className="serving-ticket">
                            <span className="ticket-num">{entry.ticketNumber}</span>
                            {shouldShowName(lane.displayMode) && <span className="customer">{entry.customerName}</span>}
                            {entry.servicePoint && <span className="counter">→ {entry.servicePoint}</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="swimlane-empty">
                        <span>No one being served</span>
                      </div>
                    )}

                    {lane.waitingList.length > 0 && (
                      <div className="swimlane-waiting">
                        <div className="waiting-label">Next up:</div>
                        <div className="waiting-tickets">
                          {lane.waitingList.slice(0, 5).map(entry => (
                            <span key={entry.id} className="waiting-ticket">{entry.ticketNumber}</span>
                          ))}
                          {lane.waitingList.length > 5 && (
                            <span className="more-tickets">+{lane.waitingList.length - 5} more</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Single Queue View */}
        {viewMode === 'single-queue' && selectedSwimlane && (
          <div className="single-queue-view">
            <button className="back-btn" onClick={() => { setViewMode('swimlanes'); setSelectedQueueId(null); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              All Queues
            </button>
            
            <div className="queue-display">
              {/* Currently Serving */}
              <div className="serving-section">
                <h2 className="section-title">Now Serving</h2>
                {selectedSwimlane.currentlyServing.length > 0 ? (
                  <div className="serving-grid">
                    {selectedSwimlane.currentlyServing.map(entry => (
                      <div key={entry.id} className="big-ticket serving">
                        <div className="big-ticket-number">{entry.ticketNumber}</div>
                        {shouldShowName(selectedSwimlane.displayMode) && (
                          <div className="big-ticket-name">{entry.customerName}</div>
                        )}
                        {entry.servicePoint && (
                          <div className="big-ticket-counter">Counter: {entry.servicePoint}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-serving">
                    <p>Ready to serve next customer</p>
                  </div>
                )}
              </div>

              {/* Waiting List */}
              <div className="waiting-section">
                <h2 className="section-title">
                  Waiting ({selectedSwimlane.stats.waiting})
                </h2>
                {selectedSwimlane.waitingList.length > 0 ? (
                  <div className="waiting-grid">
                    {selectedSwimlane.waitingList.map(entry => (
                      <div key={entry.id} className="waiting-card">
                        <span className="position">#{entry.position}</span>
                        <span className="ticket">{entry.ticketNumber}</span>
                        {shouldShowName(selectedSwimlane.displayMode) && (
                          <span className="name">{entry.customerName}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-waiting">
                    <p>No customers waiting</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Service Points View (original) */}
        {viewMode === 'service-points' && (
          <>
            {!error && servicePoints.length === 0 && hasServicePoints === false && (
              <div className="empty-display admin-warning">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <h2>No Service Points Configured</h2>
                <p>Please add service points for this location in the admin panel.</p>
                <p className="admin-hint">Go to Admin → Service Points → Add Service Point</p>
              </div>
            )}

            {!error && servicePoints.length > 0 && activePoints.length === 0 && (
              <div className="empty-display">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <h2>No Active Queues</h2>
                <p>Waiting for customers to be called...</p>
                {servicePoints.length > 0 && (
                  <p className="ready-hint">{servicePoints.length} service point{servicePoints.length > 1 ? 's' : ''} ready</p>
                )}
              </div>
            )}

            {activePoints.length > 0 && (
              <div className="service-points-grid">
                {servicePoints.map((sp) => (
                  <div key={sp.id} className={`service-point-card ${sp.currentlyServing ? 'active' : 'idle'}`}>
                    <div className="sp-header">
                      <span className="sp-name">{sp.displayName || sp.name}</span>
                      <span className="sp-type">{sp.type.toLowerCase()}</span>
                    </div>
                    
                    {sp.currentlyServing ? (
                      <div className="now-serving">
                        <div className="ticket-label">NOW SERVING</div>
                        <div className="ticket-number">{sp.currentlyServing.ticketNumber}</div>
                        {shouldShowName(sp.displayMode || 'TICKET_ONLY') && (
                          <div className="customer-name">{sp.currentlyServing.customerName}</div>
                        )}
                        <div className="service-name">{sp.currentlyServing.serviceName}</div>
                      </div>
                    ) : (
                      <div className="waiting-state">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 8v4l2 2" />
                        </svg>
                        <span>Ready</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {!location?.organization?.hidePoweredBy && (
        <div
          className="powered-by-badge"
          style={viewMode === 'service-points' && activePoints.length > 0 ? { bottom: '6rem' } : undefined}
        >
          Powered by <strong>{APP_NAME}</strong>
        </div>
      )}

      {/* Announcement Ticker */}
      {(viewMode === 'service-points' && activePoints.length > 0) && (
        <div className="announcement-ticker">
          <div className="ticker-content">
            {waitingAnnouncements.map((sp, index) => (
              <span key={sp.id} className="ticker-item">
                <strong>{sp.currentlyServing?.ticketNumber}</strong> → {sp.displayName || sp.name}
                {index < waitingAnnouncements.length - 1 && <span className="ticker-separator">•</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        /* CSS Variables for theming */
        .display-container {
          /* Dark theme (default) */
          --bg-primary: linear-gradient(135deg, #0a0f1c 0%, #131b2e 50%, #0f172a 100%);
          --bg-secondary: rgba(0, 0, 0, 0.4);
          --bg-card: rgba(255, 255, 255, 0.04);
          --bg-card-hover: rgba(255, 255, 255, 0.08);
          --border-color: rgba(255, 255, 255, 0.12);
          --border-hover: rgba(255, 255, 255, 0.25);
          --text-primary: #ffffff;
          --text-secondary: rgba(255, 255, 255, 0.85);
          --text-muted: rgba(255, 255, 255, 0.6);
          --text-dimmed: rgba(255, 255, 255, 0.4);
          --accent-green: #22c55e;
          --accent-green-bg: rgba(34, 197, 94, 0.25);
          --accent-blue: #60a5fa;
          --accent-blue-bg: rgba(59, 130, 246, 0.25);
          --accent-yellow: #fcd34d;
          --accent-yellow-bg: rgba(251, 191, 36, 0.2);
          --shadow-color: rgba(0, 0, 0, 0.3);
          --shadow-lg: 0 10px 40px rgba(0, 0, 0, 0.3);
          --text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
          --header-gradient: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%);
        }
        
        .display-container[data-theme="light"] {
          --bg-primary: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%);
          --bg-secondary: rgba(255, 255, 255, 0.9);
          --bg-card: rgba(0, 0, 0, 0.03);
          --bg-card-hover: rgba(0, 0, 0, 0.06);
          --border-color: rgba(0, 0, 0, 0.1);
          --border-hover: rgba(0, 0, 0, 0.2);
          --text-primary: #0f172a;
          --text-secondary: #334155;
          --text-muted: #64748b;
          --text-dimmed: #94a3b8;
          --accent-green: #16a34a;
          --accent-green-bg: rgba(22, 163, 74, 0.15);
          --accent-blue: #2563eb;
          --accent-blue-bg: rgba(37, 99, 235, 0.15);
          --accent-yellow: #ca8a04;
          --accent-yellow-bg: rgba(202, 138, 4, 0.15);
          --shadow-color: rgba(0, 0, 0, 0.1);
          --shadow-lg: 0 10px 40px rgba(0, 0, 0, 0.1);
          --text-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          --header-gradient: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%);
        }
        
        .display-container {
          min-height: 100vh;
          background: var(--bg-primary);
          color: var(--text-primary);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          transition: background 0.3s ease, color 0.3s ease;
        }

        .display-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem 2.5rem;
          background: var(--bg-secondary);
          border-bottom: 2px solid var(--border-color);
          gap: 2rem;
          transition: background 0.3s ease, border-color 0.3s ease;
        }

        .header-left {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }

        .org-logo {
          height: 56px;
          max-width: 200px;
          object-fit: contain;
        }

        .location-name {
          margin: 0;
          font-size: 2.5rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text-primary);
          text-shadow: 0 2px 12px var(--shadow-color);
          transition: color 0.3s ease;
        }

        .subtitle {
          margin: 0.5rem 0 0;
          font-size: 1.25rem;
          color: var(--text-secondary);
          font-weight: 500;
          transition: color 0.3s ease;
        }

        .view-selector {
          display: flex;
          gap: 0.5rem;
          background: var(--bg-secondary);
          padding: 0.5rem;
          border-radius: 16px;
          border: 1px solid var(--border-color);
          transition: background 0.3s ease, border-color 0.3s ease;
        }

        .view-btn {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.5rem;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 1.1rem;
          font-weight: 600;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .view-btn span {
          display: inline-block;
        }

        .view-btn:hover {
          background: var(--bg-card-hover);
          color: var(--text-primary);
        }

        .view-btn.active {
          background: linear-gradient(135deg, var(--brand-glow) 0%, var(--brand-glow) 100%);
          color: var(--text-primary);
          box-shadow: 0 0 20px var(--brand-glow);
        }

        .fullscreen-btn {
          padding: 1rem;
        }

        .fullscreen-btn span {
          display: none;
        }

        .header-right {
          text-align: right;
        }

        .time {
          font-size: 4rem;
          font-weight: 800;
          letter-spacing: 0.02em;
          line-height: 1;
          text-shadow: 0 2px 20px var(--brand-glow);
        }

        .date {
          font-size: 1.2rem;
          opacity: 0.7;
          margin-top: 0.5rem;
          font-weight: 500;
        }

        .display-main {
          flex: 1;
          padding: 2rem 2.5rem;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          overflow-y: auto;
        }

        .error-message {
          background: rgba(220, 38, 38, 0.2);
          border: 2px solid rgba(220, 38, 38, 0.5);
          color: #fca5a5;
          padding: 1.5rem 2.5rem;
          border-radius: 16px;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .empty-display {
          text-align: center;
          color: var(--text-secondary);
          padding-top: 3rem;
        }

        .empty-display svg {
          margin-bottom: 2rem;
          opacity: 0.6;
        }

        .empty-display h2 {
          margin: 0 0 1rem;
          font-size: 3rem;
          font-weight: 700;
          color: var(--text-primary);
          text-shadow: var(--text-shadow);
        }

        .empty-display p {
          margin: 0 0 0.5rem;
          font-size: 1.5rem;
          color: var(--text-secondary);
        }

        .empty-display .ready-hint {
          margin-top: 1.5rem;
          font-size: 1.25rem;
          color: var(--text-muted);
        }

        .empty-display.admin-warning {
          color: rgba(251, 191, 36, 0.9);
        }

        .empty-display.admin-warning svg {
          opacity: 0.7;
          stroke: #fbbf24;
        }

        .empty-display.admin-warning h2 {
          color: #fbbf24;
        }

        .empty-display .admin-hint {
          margin-top: 2rem;
          padding: 1rem 2rem;
          background: rgba(251, 191, 36, 0.15);
          border: 2px solid rgba(251, 191, 36, 0.4);
          border-radius: 12px;
          font-size: 1.25rem;
          display: inline-block;
        }

        /* Queue position change animations */
        @keyframes slideUp {
          0% { transform: translateY(20px); opacity: 0.5; }
          100% { transform: translateY(0); opacity: 1; }
        }

        @keyframes positionChange {
          0% { background-color: rgba(34, 197, 94, 0.3); transform: scale(1.02); }
          100% { background-color: var(--bg-card); transform: scale(1); }
        }

        @keyframes newEntry {
          0% { transform: translateX(100%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }

        @keyframes callToServe {
          0%, 20%, 40%, 60%, 80%, 100% { transform: scale(1); }
          10%, 30%, 50%, 70%, 90% { transform: scale(1.05); }
        }

        /* Swimlanes View - TV Optimized */
        .swimlanes-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
          gap: 2rem;
          width: 100%;
          max-width: 2000px;
        }

        .swimlane {
          background: var(--bg-card);
          border: 2px solid var(--border-color);
          border-radius: 24px;
          padding: 1.75rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .swimlane:hover {
          background: var(--bg-card-hover);
          border-color: var(--border-hover);
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
        }

        .swimlane.has-serving {
          border-color: rgba(34, 197, 94, 0.5);
          box-shadow: 0 0 50px rgba(34, 197, 94, 0.15);
        }

        .swimlane-header {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid var(--border-color);
          background: var(--header-gradient);
          margin: -1.75rem -1.75rem 1.25rem -1.75rem;
          padding: 1.5rem 1.75rem;
          border-radius: 22px 22px 0 0;
        }

        .swimlane-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .swimlane-title {
          margin: 0;
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-primary);
          text-shadow: var(--text-shadow);
        }

        .service-points-count {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 1rem;
          opacity: 0.6;
          background: var(--bg-secondary);
          padding: 0.4rem 0.75rem;
          border-radius: 8px;
          color: var(--text-primary);
        }

        .swimlane-stats {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .swimlane-stats .stat {
          font-size: 1.1rem;
          font-weight: 600;
          padding: 0.5rem 1rem;
          border-radius: 10px;
          background: var(--bg-secondary);
          color: var(--text-primary);
        }

        .swimlane-stats .stat.serving {
          background: rgba(34, 197, 94, 0.25);
          color: #4ade80;
        }

        .swimlane-stats .stat.waiting {
          background: rgba(59, 130, 246, 0.25);
          color: #60a5fa;
        }

        .swimlane-stats .stat.wait-time {
          background: rgba(251, 191, 36, 0.2);
          color: #fcd34d;
        }

        .swimlane-serving {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .serving-ticket {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.25) 0%, rgba(16, 185, 129, 0.15) 100%);
          border: 2px solid rgba(34, 197, 94, 0.5);
          padding: 1rem 1.5rem;
          border-radius: 16px;
          flex: 1;
          min-width: 250px;
          animation: callToServe 1s ease-out;
        }

        .serving-ticket .ticket-num {
          font-size: 2.25rem;
          font-weight: 800;
          color: #22c55e;
          text-shadow: 0 0 20px rgba(34, 197, 94, 0.5);
        }

        .serving-ticket .customer {
          flex: 1;
          font-size: 1.25rem;
          font-weight: 500;
          color: var(--text-primary);
        }

        .serving-ticket .counter {
          font-size: 1.1rem;
          color: var(--text-secondary);
          white-space: nowrap;
          background: var(--bg-secondary);
          padding: 0.4rem 0.75rem;
          border-radius: 8px;
        }

        .swimlane-empty {
          padding: 1.5rem;
          text-align: center;
          color: var(--text-muted);
          font-size: 1.2rem;
        }

        .swimlane-waiting {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .waiting-label {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .waiting-tickets {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
        }

        .waiting-ticket {
          background: var(--bg-secondary);
          padding: 0.5rem 1rem;
          border-radius: 10px;
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--text-primary);
          transition: all 0.3s ease;
          animation: slideUp 0.3s ease-out;
        }

        .waiting-ticket.position-changed {
          animation: positionChange 1s ease-out;
        }

        .waiting-ticket.new-entry {
          animation: newEntry 0.5s ease-out;
        }

        .more-tickets {
          font-size: 1.1rem;
          color: var(--text-muted);
          padding: 0.5rem 1rem;
          font-weight: 600;
        }

        /* Single Queue View */
        .single-queue-view {
          width: 100%;
          max-width: 1600px;
        }

        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.75rem;
          background: var(--bg-secondary);
          border: 2px solid var(--border-color);
          color: var(--text-primary);
          font-size: 1.25rem;
          font-weight: 600;
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: 2rem;
        }

        .back-btn:hover {
          background: var(--bg-card-hover);
        }

        .queue-display {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2.5rem;
        }

        .serving-section, .waiting-section {
          background: var(--bg-card);
          border: 2px solid var(--border-color);
          border-radius: 28px;
          padding: 2rem;
          overflow: hidden;
        }

        .section-title {
          margin: -2rem -2rem 1.5rem -2rem;
          padding: 1.5rem 2rem;
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--text-primary);
          text-shadow: var(--text-shadow);
          background: var(--header-gradient);
          border-bottom: 2px solid var(--border-color);
        }

        .serving-section .section-title {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%);
          border-color: rgba(34, 197, 94, 0.3);
        }

        .waiting-section .section-title {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.1) 100%);
          border-color: rgba(59, 130, 246, 0.3);
        }

        .serving-grid {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .big-ticket {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.25) 0%, rgba(16, 185, 129, 0.15) 100%);
          border: 3px solid rgba(34, 197, 94, 0.6);
          border-radius: 24px;
          padding: 2.5rem;
          text-align: center;
          animation: pulse-green 2s ease-in-out infinite, callToServe 1s ease-out;
        }

        .big-ticket-number {
          font-size: 6rem;
          font-weight: 900;
          color: #22c55e;
          text-shadow: 0 0 40px rgba(34, 197, 94, 0.6);
        }

        .big-ticket-name {
          font-size: 2rem;
          font-weight: 600;
          margin-top: 1rem;
          color: var(--text-primary);
        }

        .big-ticket-counter {
          font-size: 1.5rem;
          color: var(--text-secondary);
          margin-top: 0.75rem;
        }

        .no-serving, .no-waiting {
          text-align: center;
          padding: 4rem 1rem;
          font-size: 1.5rem;
          color: var(--text-muted);
        }

        .waiting-grid {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          max-height: 60vh;
          overflow-y: auto;
        }

        .waiting-card {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          background: var(--bg-card);
          border: 2px solid var(--border-color);
          padding: 1.25rem 1.5rem;
          border-radius: 16px;
          transition: all 0.3s ease;
          animation: slideUp 0.3s ease-out;
        }

        .waiting-card.position-changed {
          animation: positionChange 1s ease-out;
        }

        .waiting-card .position {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-muted);
          min-width: 50px;
        }

        .waiting-card .ticket {
          font-size: 1.75rem;
          font-weight: 800;
          color: #60a5fa;
          min-width: 100px;
        }

        .waiting-card .name {
          flex: 1;
          font-size: 1.25rem;
          font-weight: 500;
          color: var(--text-primary);
        }

        /* Service Points View */
        .service-points-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
          gap: 2.5rem;
          width: 100%;
          max-width: 1800px;
        }

        .service-point-card {
          background: var(--bg-card);
          border: 2px solid var(--border-color);
          border-radius: 28px;
          padding: 2.5rem;
          transition: all 0.3s ease;
        }

        .service-point-card.active {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%);
          border-color: rgba(34, 197, 94, 0.5);
          box-shadow: 0 0 60px rgba(34, 197, 94, 0.25);
          animation: pulse-green 2s ease-in-out infinite;
        }

        @keyframes pulse-green {
          0%, 100% { box-shadow: 0 0 40px rgba(34, 197, 94, 0.2); }
          50% { box-shadow: 0 0 80px rgba(34, 197, 94, 0.4); }
        }

        .service-point-card.idle {
          opacity: 0.5;
        }

        .sp-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          padding-bottom: 1.25rem;
          border-bottom: 2px solid var(--border-color);
          background: var(--header-gradient);
          margin: -2.5rem -2.5rem 2rem -2.5rem;
          padding: 1.5rem 2.5rem;
          border-radius: 26px 26px 0 0;
        }

        .sp-name {
          font-size: 2rem;
          font-weight: 700;
          color: var(--text-primary);
          text-shadow: var(--text-shadow);
        }

        .sp-type {
          font-size: 1rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--text-secondary);
          padding: 0.5rem 1rem;
          background: var(--bg-secondary);
          border-radius: 10px;
          font-weight: 600;
        }

        .now-serving {
          text-align: center;
          padding: 1.5rem 0;
        }

        .ticket-label {
          font-size: 1.25rem;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: #22c55e;
          margin-bottom: 1rem;
          font-weight: 700;
        }

        .ticket-number {
          font-size: 7rem;
          font-weight: 900;
          line-height: 1;
          color: #22c55e;
          text-shadow: 0 0 50px rgba(34, 197, 94, 0.6);
          animation: glow 2s ease-in-out infinite;
        }

        @keyframes glow {
          0%, 100% { text-shadow: 0 0 40px rgba(34, 197, 94, 0.5); }
          50% { text-shadow: 0 0 80px rgba(34, 197, 94, 0.8); }
        }

        .customer-name {
          font-size: 2rem;
          font-weight: 600;
          margin-top: 1.25rem;
          color: var(--text-primary);
        }

        .service-name {
          font-size: 1.25rem;
          color: var(--text-secondary);
          margin-top: 0.75rem;
        }

        .waiting-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 220px;
          color: var(--text-muted);
        }

        .waiting-state svg {
          margin-bottom: 1rem;
          width: 64px;
          height: 64px;
          stroke: var(--text-muted);
        }

        .waiting-state span {
          font-size: 1.5rem;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          font-weight: 600;
          color: var(--text-muted);
        }

        .powered-by-badge {
          position: fixed;
          bottom: 1rem;
          right: 1.25rem;
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-dimmed);
          background: var(--bg-secondary);
          padding: 0.4rem 0.85rem;
          border-radius: 999px;
          border: 1px solid var(--border-color);
          z-index: 5;
          pointer-events: none;
        }

        .powered-by-badge strong {
          color: var(--text-muted);
          font-weight: 700;
        }

        .announcement-ticker {
          background: var(--bg-secondary);
          padding: 1.5rem 3rem;
          border-top: 2px solid var(--border-color);
          overflow: hidden;
        }

        .ticker-content {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          font-size: 1.75rem;
          font-weight: 600;
          color: var(--text-primary);
          animation: scroll 30s linear infinite;
        }

        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .ticker-item {
          white-space: nowrap;
        }

        .ticker-item strong {
          color: #22c55e;
          font-size: 2.25rem;
          font-weight: 800;
        }

        .ticker-separator {
          margin: 0 1.5rem;
          opacity: 0.3;
        }

        /* Large TV (1080p+) optimizations */
        @media (min-width: 1920px) {
          .display-header {
            padding: 2rem 3rem;
          }

          .location-name {
            font-size: 3.5rem;
          }

          .subtitle {
            font-size: 1.5rem;
          }

          .time {
            font-size: 5rem;
          }

          .date {
            font-size: 1.5rem;
          }

          .display-main {
            padding: 2.5rem 3rem;
          }

          .swimlanes-container {
            grid-template-columns: repeat(auto-fit, minmax(550px, 1fr));
            gap: 2.5rem;
          }

          .swimlane {
            padding: 2.25rem;
          }

          .swimlane-title {
            font-size: 2.25rem;
          }

          .swimlane-stats .stat {
            font-size: 1.35rem;
            padding: 0.6rem 1.25rem;
          }

          .serving-ticket .ticket-num {
            font-size: 3rem;
          }

          .serving-ticket .customer {
            font-size: 1.5rem;
          }

          .waiting-ticket {
            font-size: 1.5rem;
            padding: 0.6rem 1.25rem;
          }

          .ticket-number {
            font-size: 10rem;
          }

          .big-ticket-number {
            font-size: 8rem;
          }

          .service-points-grid {
            grid-template-columns: repeat(auto-fit, minmax(480px, 1fr));
            gap: 3rem;
          }
        }

        /* 4K TV optimizations */
        @media (min-width: 3000px) {
          .location-name {
            font-size: 5rem;
          }

          .time {
            font-size: 7rem;
          }

          .swimlane-title {
            font-size: 3rem;
          }

          .ticket-number {
            font-size: 14rem;
          }

          .big-ticket-number {
            font-size: 12rem;
          }
        }

        /* Mobile/tablet for single-queue view */
        @media (max-width: 1024px) {
          .queue-display {
            grid-template-columns: 1fr;
          }

          .view-btn span {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default TVDisplayPage;
