'use client';

import React, { useEffect, useState, useCallback } from 'react';
import api from '@/api/client';
import Layout from '@/components/Layout';
import type { Location } from '@/types';

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

const AnalyticsPage: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const orgs = await api.getOrganizations();
      if (orgs.length > 0) {
        const locs = await api.getLocations(orgs[0].id);
        setLocations(locs);
        if (locs.length > 0) {
          setSelectedLocation(locs[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMetrics = useCallback(async (locationId: string) => {
    try {
      const data = await api.getLocationMetrics(locationId);
      setMetrics(data);
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

  return (
    <Layout>
      <div className="analytics-page">
        {/* Page Header */}
        <div className="page-header">
          <div className="header-content">
            <div className="header-left">
              <div className="header-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                  <path d="M22 12A10 10 0 0 0 12 2v10z" />
                </svg>
              </div>
              <div>
                <h1 className="page-title">Analytics</h1>
                <p className="page-subtitle">Track performance metrics and insights</p>
              </div>
            </div>
            
            <div className="location-selector">
              <label className="selector-label">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
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
          </div>
        </div>

        {metrics && (
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
                <div className="card-trend positive">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                  +12%
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
            max-width: 1200px;
            margin: 0 auto;
            animation: fadeIn 0.3s ease-out;
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .page-header {
            background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
            border-radius: 16px;
            padding: 2rem;
            margin-bottom: 2rem;
            color: white;
            box-shadow: 0 10px 40px rgba(99, 102, 241, 0.3);
          }

          .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 1.5rem;
          }

          .header-left {
            display: flex;
            align-items: center;
            gap: 1rem;
          }

          .header-icon {
            width: 56px;
            height: 56px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(10px);
          }

          .page-title {
            margin: 0;
            font-size: 1.75rem;
            font-weight: 700;
          }

          .page-subtitle {
            margin: 0.25rem 0 0;
            opacity: 0.9;
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
            background: linear-gradient(135deg, #f0f0ff 0%, #e8e8ff 100%);
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
            background: linear-gradient(135deg, #f0f0ff 0%, #e8e8ff 100%);
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
            .page-header {
              padding: 1.5rem;
            }

            .header-content {
              flex-direction: column;
              align-items: stretch;
            }

            .header-left {
              flex-direction: column;
              text-align: center;
            }

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
        `}</style>
      </div>
    </Layout>
  );
};

export default AnalyticsPage;
