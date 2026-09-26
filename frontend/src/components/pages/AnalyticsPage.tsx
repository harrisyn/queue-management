'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PieChart, MapPin } from 'lucide-react';
import api from '@/api/client';
import Layout from '@/components/Layout';
import { PageHeader } from '@/components/ui';
import { useAuthContext } from '@/contexts/AuthContext';
import type { Location } from '@/types';
import AiInsightsPanel from '@/components/ai/AiInsightsPanel';

interface ServiceMetrics {
  serviceId: string;
  serviceName: string;
  total: number;
  served: number;
  waiting?: number;
  noShows: number;
}

interface Metrics {
  totals?: {
    total: number;
    served: number;
    waiting: number;
  };
  services?: ServiceMetrics[];
}

interface EnhancedServiceMetrics {
  serviceId: string;
  serviceName: string;
  counts: {
    total: number;
    served: number;
    waiting: number;
    serving: number;
    noShows: number;
    cancelled: number;
  };
  waitTime: {
    average: number;
    longest: number;
    shortest: number;
  };
  serviceTime: {
    average: number;
  };
  turnaroundTime: {
    average: number;
  };
  completionRate: number;
  noShowRate: number;
}

interface EnhancedMetrics {
  locationId: string;
  services: EnhancedServiceMetrics[];
  totals: {
    total: number;
    served: number;
    waiting: number;
    serving: number;
    noShows: number;
  };
  longestCurrentWait: number;
}

interface JourneyAnalytics {
  summary: {
    totalJourneys: number;
    completedJourneys: number;
    inProgressJourneys: number;
    multiServiceJourneys: number;
    avgJourneyDuration: number;
    maxJourneyDuration: number;
    totalTransfers: number;
  };
  journeys: Array<{
    id: string;
    userId: string;
    userName: string;
    startedAt: string;
    completedAt?: string;
    totalDuration?: number;
    serviceCount: number;
    status: string;
  }>;
}

const AnalyticsPage: React.FC = () => {
  const { user } = useAuthContext();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [enhancedMetrics, setEnhancedMetrics] = useState<EnhancedMetrics | null>(null);
  const [journeyAnalytics, setJourneyAnalytics] = useState<JourneyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'journeys'>('overview');

  const loadData = useCallback(async () => {
    if (!user?.organizationId) {
      // No organization on this account (e.g. a superadmin). Never guess an
      // org - render the empty state instead of leaking another tenant's data.
      setLocations([]);
      setLoading(false);
      return;
    }
    try {
      const locs = await api.getLocations(user.organizationId);
      setLocations(locs);
      if (locs.length > 0) {
        setSelectedLocation(locs[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadMetrics = useCallback(async (locationId: string) => {
    try {
      const [basicData, enhancedData, journeyData] = await Promise.all([
        api.getLocationMetrics(locationId),
        api.getDetailedAnalytics(locationId).catch(() => null),
        api.getJourneyAnalytics(locationId).catch(() => null),
      ]);
      setMetrics(basicData);
      setEnhancedMetrics(enhancedData);
      setJourneyAnalytics(journeyData);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedLocation) {
      loadMetrics(selectedLocation);
    }
  }, [selectedLocation, loadMetrics]);

  const servedPercentage = metrics?.totals?.total ?
    Math.round((metrics.totals.served / metrics.totals.total) * 100) : 0;

  if (!loading && !user?.organizationId) {
    return (
      <Layout>
        <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
          No organization is associated with this account.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="analytics-page">
        <PageHeader
          icon={PieChart}
          title="Analytics"
          subtitle="Track performance metrics and insights"
          actions={
            <div className="location-selector">
              <label className="selector-label">
                <MapPin size={16} />
                Location
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="location-select"
              >
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          }
        />

        <AiInsightsPanel locationId={selectedLocation || undefined} />

        {/* Tabs Navigation */}
        <div className="tabs-container">
          <button 
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Overview
          </button>
          <button 
            className={`tab-btn ${activeTab === 'services' ? 'active' : ''}`}
            onClick={() => setActiveTab('services')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            Services
          </button>
          <button 
            className={`tab-btn ${activeTab === 'journeys' ? 'active' : ''}`}
            onClick={() => setActiveTab('journeys')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Journeys
          </button>
        </div>

        {metrics && activeTab === 'overview' && (
          <>
            {/* Summary Cards */}
            <div className="summary-grid">
              <div className="summary-card total">
                <div className="card-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div className="card-content">
                  <span className="card-value">{metrics.totals?.total || 0}</span>
                  <span className="card-label">Total Visitors Today</span>
                </div>
              </div>

              <div className="summary-card served">
                <div className="card-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="card-content">
                  <span className="card-value">{metrics.totals?.served || 0}</span>
                  <span className="card-label">Successfully Served</span>
                </div>
                <div className="progress-ring">
                  <svg viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#e2e8f0"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3"
                      strokeDasharray={`${servedPercentage}, 100`}
                    />
                  </svg>
                  <span>{servedPercentage}%</span>
                </div>
              </div>

              <div className="summary-card waiting">
                <div className="card-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="card-content">
                  <span className="card-value">{metrics.totals?.waiting || 0}</span>
                  <span className="card-label">Currently Waiting</span>
                </div>
                {(metrics.totals?.waiting || 0) > 0 && (
                  <div className="live-indicator">
                    <span className="live-dot" />
                    Live
                  </div>
                )}
              </div>
            </div>

            {/* Enhanced Metrics - TAT, Longest Wait, Journey */}
            {enhancedMetrics && (
              <div className="enhanced-metrics-grid">
                <div className="metric-card tat">
                  <div className="metric-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div className="metric-content">
                    <span className="metric-value">
                      {enhancedMetrics.services.length > 0 
                        ? Math.round(enhancedMetrics.services.reduce((acc, s) => acc + s.turnaroundTime.average, 0) / enhancedMetrics.services.length)
                        : 0} min
                    </span>
                    <span className="metric-label">Avg. Turnaround Time</span>
                  </div>
                </div>

                <div className="metric-card longest-wait">
                  <div className="metric-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v10l4.5 4.5" />
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                  </div>
                  <div className="metric-content">
                    <span className="metric-value">{enhancedMetrics.longestCurrentWait} min</span>
                    <span className="metric-label">Longest Current Wait</span>
                  </div>
                  {enhancedMetrics.longestCurrentWait > 30 && (
                    <div className="metric-alert">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      Attention needed
                    </div>
                  )}
                </div>

                <div className="metric-card avg-wait">
                  <div className="metric-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 20V10" />
                      <path d="M12 20V4" />
                      <path d="M6 20v-6" />
                    </svg>
                  </div>
                  <div className="metric-content">
                    <span className="metric-value">
                      {enhancedMetrics.services.length > 0 
                        ? Math.round(enhancedMetrics.services.reduce((acc, s) => acc + s.waitTime.average, 0) / enhancedMetrics.services.length)
                        : 0} min
                    </span>
                    <span className="metric-label">Avg. Wait Time</span>
                  </div>
                </div>

                <div className="metric-card avg-service">
                  <div className="metric-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                  </div>
                  <div className="metric-content">
                    <span className="metric-value">
                      {enhancedMetrics.services.length > 0 
                        ? Math.round(enhancedMetrics.services.reduce((acc, s) => acc + s.serviceTime.average, 0) / enhancedMetrics.services.length)
                        : 0} min
                    </span>
                    <span className="metric-label">Avg. Service Time</span>
                  </div>
                </div>
              </div>
            )}

            {/* Journey Summary */}
            {journeyAnalytics && (
              <div className="journey-summary">
                <div className="section-header">
                  <h2 className="section-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                    Patient Journey Overview
                  </h2>
                </div>
                <div className="journey-stats">
                  <div className="journey-stat">
                    <span className="stat-value">{journeyAnalytics.summary.totalJourneys}</span>
                    <span className="stat-label">Total Journeys</span>
                  </div>
                  <div className="journey-stat">
                    <span className="stat-value">{journeyAnalytics.summary.completedJourneys}</span>
                    <span className="stat-label">Completed</span>
                  </div>
                  <div className="journey-stat">
                    <span className="stat-value">{journeyAnalytics.summary.multiServiceJourneys}</span>
                    <span className="stat-label">Multi-Service</span>
                  </div>
                  <div className="journey-stat">
                    <span className="stat-value">{journeyAnalytics.summary.avgJourneyDuration} min</span>
                    <span className="stat-label">Avg. Duration</span>
                  </div>
                </div>
              </div>
            )}

            {/* Service Breakdown */}
            <div className="breakdown-section">
              <div className="section-header">
                <h2 className="section-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                  Service Breakdown
                </h2>
              </div>
              
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Total</th>
                      <th>Served</th>
                      <th>Waiting</th>
                      <th>No Shows</th>
                      <th>Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.services?.map((service) => {
                      const servicePercentage = service.total > 0 
                        ? Math.round((service.served / service.total) * 100) 
                        : 0;
                      return (
                        <tr key={service.serviceId}>
                          <td>
                            <div className="service-cell">
                              <div className="service-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                                </svg>
                              </div>
                              {service.serviceName}
                            </div>
                          </td>
                          <td><span className="metric-badge total">{service.total}</span></td>
                          <td><span className="metric-badge served">{service.served}</span></td>
                          <td><span className="metric-badge waiting">{service.waiting || 0}</span></td>
                          <td><span className="metric-badge noshow">{service.noShows}</span></td>
                          <td>
                            <div className="performance-bar">
                              <div className="bar-track">
                                <div 
                                  className="bar-fill" 
                                  style={{ width: `${servicePercentage}%` }}
                                />
                              </div>
                              <span className="bar-value">{servicePercentage}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Services Tab - Detailed Service Analytics */}
        {activeTab === 'services' && enhancedMetrics && (
          <div className="services-analytics">
            <div className="section-header">
              <h2 className="section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
                Service Performance Details
              </h2>
            </div>

            <div className="services-grid">
              {enhancedMetrics.services.map((service) => (
                <div key={service.serviceId} className="service-analytics-card">
                  <div className="service-header">
                    <h3 className="service-name">{service.serviceName}</h3>
                    <span className="completion-badge">{service.completionRate}% completion</span>
                  </div>
                  
                  <div className="service-counts">
                    <div className="count-item">
                      <span className="count-value">{service.counts.total}</span>
                      <span className="count-label">Total</span>
                    </div>
                    <div className="count-item served">
                      <span className="count-value">{service.counts.served}</span>
                      <span className="count-label">Served</span>
                    </div>
                    <div className="count-item waiting">
                      <span className="count-value">{service.counts.waiting}</span>
                      <span className="count-label">Waiting</span>
                    </div>
                    <div className="count-item no-show">
                      <span className="count-value">{service.counts.noShows}</span>
                      <span className="count-label">No Shows</span>
                    </div>
                  </div>

                  <div className="service-times">
                    <div className="time-item">
                      <span className="time-label">Avg Wait</span>
                      <span className="time-value">{service.waitTime.average} min</span>
                    </div>
                    <div className="time-item">
                      <span className="time-label">Longest Wait</span>
                      <span className="time-value highlight">{service.waitTime.longest} min</span>
                    </div>
                    <div className="time-item">
                      <span className="time-label">Avg Service</span>
                      <span className="time-value">{service.serviceTime.average} min</span>
                    </div>
                    <div className="time-item">
                      <span className="time-label">Turnaround</span>
                      <span className="time-value">{service.turnaroundTime.average} min</span>
                    </div>
                  </div>

                  <div className="service-rates">
                    <div className="rate-bar">
                      <div className="rate-label">Completion Rate</div>
                      <div className="rate-track">
                        <div className="rate-fill success" style={{ width: `${service.completionRate}%` }} />
                      </div>
                      <span className="rate-value">{service.completionRate}%</span>
                    </div>
                    <div className="rate-bar">
                      <div className="rate-label">No Show Rate</div>
                      <div className="rate-track">
                        <div className="rate-fill danger" style={{ width: `${service.noShowRate}%` }} />
                      </div>
                      <span className="rate-value">{service.noShowRate}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Journeys Tab - Patient Journey Analytics */}
        {activeTab === 'journeys' && (
          <div className="journeys-analytics">
            {journeyAnalytics ? (
              <>
                <div className="journey-overview-cards">
                  <div className="journey-card total">
                    <div className="journey-card-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <div className="journey-card-content">
                      <span className="journey-card-value">{journeyAnalytics.summary.totalJourneys}</span>
                      <span className="journey-card-label">Total Journeys Today</span>
                    </div>
                  </div>

                  <div className="journey-card completed">
                    <div className="journey-card-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div className="journey-card-content">
                      <span className="journey-card-value">{journeyAnalytics.summary.completedJourneys}</span>
                      <span className="journey-card-label">Completed</span>
                    </div>
                  </div>

                  <div className="journey-card in-progress">
                    <div className="journey-card-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div className="journey-card-content">
                      <span className="journey-card-value">{journeyAnalytics.summary.inProgressJourneys}</span>
                      <span className="journey-card-label">In Progress</span>
                    </div>
                  </div>

                  <div className="journey-card multi-service">
                    <div className="journey-card-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                    </div>
                    <div className="journey-card-content">
                      <span className="journey-card-value">{journeyAnalytics.summary.multiServiceJourneys}</span>
                      <span className="journey-card-label">Multi-Service Visits</span>
                    </div>
                  </div>
                </div>

                <div className="journey-timing-section">
                  <div className="section-header">
                    <h2 className="section-title">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      Journey Timing
                    </h2>
                  </div>
                  <div className="timing-cards">
                    <div className="timing-card">
                      <span className="timing-value">{journeyAnalytics.summary.avgJourneyDuration} min</span>
                      <span className="timing-label">Average Journey Duration</span>
                    </div>
                    <div className="timing-card">
                      <span className="timing-value">{journeyAnalytics.summary.maxJourneyDuration} min</span>
                      <span className="timing-label">Longest Journey</span>
                    </div>
                    <div className="timing-card">
                      <span className="timing-value">{journeyAnalytics.summary.totalTransfers}</span>
                      <span className="timing-label">Total Transfers</span>
                    </div>
                  </div>
                </div>

                {journeyAnalytics.journeys.length > 0 && (
                  <div className="recent-journeys-section">
                    <div className="section-header">
                      <h2 className="section-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                        Recent Journeys
                      </h2>
                    </div>
                    <div className="journeys-list">
                      {journeyAnalytics.journeys.slice(0, 10).map((journey) => (
                        <div key={journey.id} className="journey-item">
                          <div className="journey-user">
                            <div className="user-avatar">
                              {journey.userName.charAt(0).toUpperCase()}
                            </div>
                            <div className="user-info">
                              <span className="user-name">{journey.userName}</span>
                              <span className="journey-time">
                                {new Date(journey.startedAt).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                          <div className="journey-details">
                            <span className="service-count">{journey.serviceCount} service{journey.serviceCount > 1 ? 's' : ''}</span>
                            {journey.totalDuration && (
                              <span className="duration">{journey.totalDuration} min</span>
                            )}
                          </div>
                          <span className={`journey-status ${journey.status}`}>
                            {journey.status === 'completed' ? 'Completed' : 'In Progress'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <h3>No Journey Data</h3>
                <p>Journey analytics will appear when patients visit multiple services</p>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!metrics && !loading && (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                <path d="M22 12A10 10 0 0 0 12 2v10z" />
              </svg>
            </div>
            <h3>No Analytics Data</h3>
            <p>Select a location to view performance metrics</p>
          </div>
        )}

        <style jsx>{`
          .analytics-page {
            animation: fadeIn 0.3s ease-out;
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .location-selector {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .selector-label {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            font-size: 0.8rem;
            font-weight: 500;
            opacity: 0.9;
          }

          .location-select {
            padding: 0.75rem 1rem;
            font-size: 1rem;
            border: none;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.95);
            color: var(--text);
            min-width: 200px;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            transition: all 0.2s;
          }

          .location-select:hover {
            background: white;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1.5rem;
            margin-bottom: 2rem;
          }

          .summary-card {
            background: white;
            padding: 1.5rem;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            align-items: flex-start;
            position: relative;
            transition: all 0.3s;
          }

          .summary-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
          }

          .card-icon {
            width: 56px;
            height: 56px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .summary-card.total .card-icon {
            background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
            color: #2563eb;
          }

          .summary-card.served .card-icon {
            background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
            color: #16a34a;
          }

          .summary-card.waiting .card-icon {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            color: #d97706;
          }

          .card-content {
            flex: 1;
            min-width: 100px;
          }

          .card-value {
            display: block;
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--text);
            line-height: 1.1;
          }

          .card-label {
            display: block;
            font-size: 0.9rem;
            color: var(--text-secondary);
            margin-top: 0.25rem;
          }

          .card-trend {
            display: flex;
            align-items: center;
            gap: 0.25rem;
            padding: 0.35rem 0.6rem;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
          }

          .card-trend.positive {
            background: #dcfce7;
            color: #16a34a;
          }

          .progress-ring {
            width: 48px;
            height: 48px;
            position: relative;
          }

          .progress-ring svg {
            transform: rotate(-90deg);
          }

          .progress-ring span {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 0.7rem;
            font-weight: 700;
            color: #16a34a;
          }

          .live-indicator {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.35rem 0.6rem;
            background: #fef3c7;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            color: #d97706;
          }

          .live-dot {
            width: 8px;
            height: 8px;
            background: #f59e0b;
            border-radius: 50%;
            animation: blink 1.5s infinite;
          }

          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }

          .breakdown-section {
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
          }

          .section-header {
            padding: 1.25rem 1.5rem;
            border-bottom: 1px solid #f1f5f9;
          }

          .section-title {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin: 0;
            font-size: 1.1rem;
            color: var(--text);
          }

          .table-container {
            overflow-x: auto;
          }

          .data-table {
            width: 100%;
            border-collapse: collapse;
          }

          .data-table th {
            text-align: left;
            padding: 1rem 1.25rem;
            background: #f8fafc;
            font-size: 0.8rem;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .data-table td {
            padding: 1rem 1.25rem;
            border-bottom: 1px solid #f1f5f9;
          }

          .data-table tr:last-child td {
            border-bottom: none;
          }

          .data-table tr:hover td {
            background: #fafbfc;
          }

          .service-cell {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            font-weight: 500;
            color: var(--text);
          }

          .service-icon {
            width: 32px;
            height: 32px;
            background: rgba(20, 184, 166, 0.1);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--primary);
          }

          .metric-badge {
            display: inline-block;
            padding: 0.35rem 0.75rem;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
          }

          .metric-badge.total {
            background: #dbeafe;
            color: #2563eb;
          }

          .metric-badge.served {
            background: #dcfce7;
            color: #16a34a;
          }

          .metric-badge.waiting {
            background: #fef3c7;
            color: #d97706;
          }

          .metric-badge.noshow {
            background: #fee2e2;
            color: #dc2626;
          }

          .performance-bar {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            min-width: 120px;
          }

          .bar-track {
            flex: 1;
            height: 8px;
            background: #e2e8f0;
            border-radius: 4px;
            overflow: hidden;
          }

          .bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #10b981 0%, #059669 100%);
            border-radius: 4px;
            transition: width 0.5s ease-out;
          }

          .bar-value {
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--text);
            min-width: 35px;
          }

          .empty-state {
            text-align: center;
            padding: 4rem 2rem;
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          }

          .empty-icon {
            width: 100px;
            height: 100px;
            background: rgba(20, 184, 166, 0.1);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1.5rem;
            color: var(--primary);
          }

          .empty-state h3 {
            margin: 0 0 0.5rem;
            color: var(--text);
          }

          .empty-state p {
            margin: 0;
            color: var(--text-secondary);
          }

          @media (max-width: 1024px) {
            .summary-grid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 768px) {
            .location-selector {
              width: 100%;
            }

            .location-select {
              width: 100%;
            }

            .data-table th,
            .data-table td {
              padding: 0.75rem;
            }
          }

          /* Tabs Navigation */
          .tabs-container {
            display: flex;
            gap: 0.5rem;
            padding: 0.5rem;
            background: var(--bg-secondary, #f3f4f6);
            border-radius: 12px;
            margin-bottom: 1.5rem;
          }

          .tab-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.25rem;
            background: transparent;
            border: none;
            border-radius: 8px;
            font-size: 0.9rem;
            font-weight: 500;
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.2s;
          }

          .tab-btn:hover {
            background: var(--bg-tertiary, rgba(255,255,255,0.5));
          }

          .tab-btn.active {
            background: white;
            color: var(--primary);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }

          /* Enhanced Metrics Grid */
          .enhanced-metrics-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1rem;
            margin-bottom: 2rem;
          }

          .metric-card {
            background: white;
            border-radius: 12px;
            padding: 1.25rem;
            display: flex;
            align-items: flex-start;
            gap: 1rem;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
            border: 1px solid var(--border-color, #e5e7eb);
          }

          .metric-icon {
            width: 44px;
            height: 44px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .metric-card.tat .metric-icon {
            background: linear-gradient(135deg, #fef3c7, #fde68a);
            color: #d97706;
          }

          .metric-card.longest-wait .metric-icon {
            background: linear-gradient(135deg, #fee2e2, #fecaca);
            color: #dc2626;
          }

          .metric-card.avg-wait .metric-icon {
            background: linear-gradient(135deg, #dbeafe, #bfdbfe);
            color: #2563eb;
          }

          .metric-card.avg-service .metric-icon {
            background: linear-gradient(135deg, #d1fae5, #a7f3d0);
            color: #059669;
          }

          .metric-content {
            flex: 1;
          }

          .metric-value {
            display: block;
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--text);
            margin-bottom: 0.25rem;
          }

          .metric-label {
            font-size: 0.85rem;
            color: var(--text-secondary);
          }

          .metric-alert {
            display: inline-flex;
            align-items: center;
            gap: 0.375rem;
            padding: 0.25rem 0.5rem;
            background: #fef2f2;
            color: #dc2626;
            font-size: 0.75rem;
            font-weight: 500;
            border-radius: 6px;
            margin-top: 0.5rem;
          }

          /* Journey Summary */
          .journey-summary {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 2rem;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          }

          .journey-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1rem;
            margin-top: 1rem;
          }

          .journey-stat {
            text-align: center;
            padding: 1rem;
            background: var(--bg-secondary, #f9fafb);
            border-radius: 10px;
          }

          .stat-value {
            display: block;
            font-size: 1.75rem;
            font-weight: 700;
            color: var(--primary);
            margin-bottom: 0.25rem;
          }

          .stat-label {
            font-size: 0.85rem;
            color: var(--text-secondary);
          }

          /* Services Tab Styles */
          .services-analytics {
            margin-top: 1rem;
          }

          .services-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 1.5rem;
            margin-top: 1rem;
          }

          .service-analytics-card {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
            border: 1px solid var(--border-color, #e5e7eb);
          }

          .service-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid var(--border-color, #e5e7eb);
          }

          .service-name {
            margin: 0;
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--text);
          }

          .completion-badge {
            padding: 0.25rem 0.75rem;
            background: linear-gradient(135deg, #d1fae5, #a7f3d0);
            color: #059669;
            font-size: 0.8rem;
            font-weight: 600;
            border-radius: 20px;
          }

          .service-counts {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 0.75rem;
            margin-bottom: 1.25rem;
          }

          .count-item {
            text-align: center;
            padding: 0.75rem;
            background: var(--bg-secondary, #f9fafb);
            border-radius: 8px;
          }

          .count-item.served { background: #d1fae5; }
          .count-item.waiting { background: #fef3c7; }
          .count-item.no-show { background: #fee2e2; }

          .count-value {
            display: block;
            font-size: 1.25rem;
            font-weight: 700;
            color: var(--text);
          }

          .count-label {
            font-size: 0.75rem;
            color: var(--text-secondary);
          }

          .service-times {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
            margin-bottom: 1.25rem;
          }

          .time-item {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 0;
            border-bottom: 1px dashed var(--border-color, #e5e7eb);
          }

          .time-label {
            font-size: 0.85rem;
            color: var(--text-secondary);
          }

          .time-value {
            font-weight: 600;
            color: var(--text);
          }

          .time-value.highlight {
            color: #dc2626;
          }

          .service-rates {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }

          .rate-bar {
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }

          .rate-label {
            font-size: 0.8rem;
            color: var(--text-secondary);
            min-width: 100px;
          }

          .rate-track {
            flex: 1;
            height: 8px;
            background: var(--bg-secondary, #e5e7eb);
            border-radius: 4px;
            overflow: hidden;
          }

          .rate-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.3s;
          }

          .rate-fill.success { background: linear-gradient(135deg, #10b981, #059669); }
          .rate-fill.danger { background: linear-gradient(135deg, #f87171, #dc2626); }

          .rate-value {
            font-size: 0.85rem;
            font-weight: 600;
            min-width: 40px;
            text-align: right;
          }

          /* Journeys Tab Styles */
          .journeys-analytics {
            margin-top: 1rem;
          }

          .journey-overview-cards {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1rem;
            margin-bottom: 2rem;
          }

          .journey-card {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            display: flex;
            align-items: center;
            gap: 1rem;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          }

          .journey-card-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .journey-card.total .journey-card-icon { background: rgba(20, 184, 166, 0.12); color: #0d9488; }
          .journey-card.completed .journey-card-icon { background: linear-gradient(135deg, #d1fae5, #a7f3d0); color: #059669; }
          .journey-card.in-progress .journey-card-icon { background: linear-gradient(135deg, #fef3c7, #fde68a); color: #d97706; }
          .journey-card.multi-service .journey-card-icon { background: linear-gradient(135deg, #fce7f3, #fbcfe8); color: #db2777; }

          .journey-card-value {
            display: block;
            font-size: 1.75rem;
            font-weight: 700;
            color: var(--text);
          }

          .journey-card-label {
            font-size: 0.85rem;
            color: var(--text-secondary);
          }

          .journey-timing-section {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 2rem;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          }

          .timing-cards {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1rem;
            margin-top: 1rem;
          }

          .timing-card {
            text-align: center;
            padding: 1.25rem;
            background: var(--bg-secondary, #f9fafb);
            border-radius: 10px;
          }

          .timing-value {
            display: block;
            font-size: 2rem;
            font-weight: 700;
            color: var(--primary);
            margin-bottom: 0.25rem;
          }

          .timing-label {
            font-size: 0.9rem;
            color: var(--text-secondary);
          }

          .recent-journeys-section {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          }

          .journeys-list {
            margin-top: 1rem;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }

          .journey-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem;
            background: var(--bg-secondary, #f9fafb);
            border-radius: 10px;
          }

          .journey-user {
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }

          .user-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: var(--primary);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
          }

          .user-name {
            display: block;
            font-weight: 600;
            color: var(--text);
          }

          .journey-time {
            font-size: 0.8rem;
            color: var(--text-secondary);
          }

          .journey-details {
            display: flex;
            align-items: center;
            gap: 1rem;
          }

          .service-count, .duration {
            padding: 0.25rem 0.75rem;
            background: white;
            border-radius: 6px;
            font-size: 0.85rem;
            color: var(--text-secondary);
          }

          .journey-status {
            padding: 0.375rem 0.875rem;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
          }

          .journey-status.completed {
            background: #d1fae5;
            color: #059669;
          }

          .journey-status.in-progress {
            background: #fef3c7;
            color: #d97706;
          }

          @media (max-width: 1024px) {
            .enhanced-metrics-grid,
            .journey-overview-cards {
              grid-template-columns: repeat(2, 1fr);
            }

            .journey-stats {
              grid-template-columns: repeat(2, 1fr);
            }

            .timing-cards {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 768px) {
            .enhanced-metrics-grid,
            .journey-overview-cards,
            .journey-stats,
            .service-counts {
              grid-template-columns: 1fr;
            }

            .services-grid {
              grid-template-columns: 1fr;
            }

            .service-times {
              grid-template-columns: 1fr;
            }

            .tabs-container {
              flex-wrap: wrap;
            }

            .journey-item {
              flex-direction: column;
              gap: 1rem;
              align-items: flex-start;
            }
          }
        `}</style>
      </div>
    </Layout>
  );
};

export default AnalyticsPage;
