'use client';

import React, { useEffect, useState, useCallback } from 'react';
import api from '@/api/client';
import Layout from '@/components/Layout';
import QueueDisplay from '@/components/QueueDisplay';
import QueueControl from '@/components/QueueControl';
import type { Queue, Service } from '@/types';

const QueueManagementPage: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<string>('');
  const [queue, setQueue] = useState<Queue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    if (selectedService) {
      loadOrCreateQueue(selectedService);
    }
  }, [selectedService]);

  const loadServices = async () => {
    try {
      const orgs = await api.getOrganizations();
      if (orgs.length > 0) {
        const locations = await api.getLocations(orgs[0].id);
        if (locations.length > 0) {
          const serviceList = await api.getServices(locations[0].id);
          setServices(serviceList);
          if (serviceList.length > 0) {
            setSelectedService(serviceList[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load services', err);
    } finally {
      setLoading(false);
    }
  };

  const loadOrCreateQueue = async (serviceId: string) => {
    try {
      setLoading(true);
      const queueData = await api.createQueue(serviceId);
      const fullQueue = await api.getQueue(queueData.id);
      setQueue(fullQueue);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  };

  const refreshQueue = useCallback(async () => {
    if (queue) {
      const fullQueue = await api.getQueue(queue.id);
      setQueue(fullQueue);
    }
  }, [queue]);

  if (loading && !queue) {
    return (
      <Layout>
        <div className="loading-container">
          <div className="loading-spinner" />
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Loading queue...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="queue-management-page">
        {/* Page Header */}
        <div className="page-header">
          <div className="header-content">
            <div className="header-left">
              <div className="header-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <h1 className="page-title">Queue Management</h1>
                <p className="page-subtitle">Manage your service queues and serve customers</p>
              </div>
            </div>
            
            <div className="service-selector">
              <label className="selector-label">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Service
              </label>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="service-select"
              >
                {services.length === 0 && <option value="">No services available</option>}
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="error-alert">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Main Content Grid */}
        {queue && (
          <div className="queue-grid">
            <div className="queue-display-wrapper">
              <QueueDisplay queue={queue} onRefresh={refreshQueue} />
            </div>
            <div className="queue-control-wrapper">
              <QueueControl queue={queue} onUpdate={refreshQueue} />
            </div>
          </div>
        )}

        {/* Empty State */}
        {!queue && !loading && (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3>No Queue Available</h3>
            <p>Select a service from the dropdown above to start managing its queue</p>
          </div>
        )}

        <style jsx>{`
          .queue-management-page {
            max-width: 1400px;
            margin: 0 auto;
            animation: fadeIn 0.3s ease-out;
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .page-header {
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
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
            gap: 2rem;
            flex-wrap: wrap;
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
            font-size: 0.95rem;
          }

          .service-selector {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .selector-label {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.85rem;
            font-weight: 500;
            opacity: 0.9;
          }

          .service-select {
            padding: 0.75rem 1rem;
            font-size: 1rem;
            border: none;
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.95);
            color: var(--text);
            min-width: 220px;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            transition: all 0.2s;
          }

          .service-select:hover {
            background: white;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
          }

          .service-select:focus {
            outline: none;
            box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.5);
          }

          .error-alert {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
            border: 1px solid #fecaca;
            color: #dc2626;
            padding: 1rem 1.25rem;
            border-radius: 12px;
            margin-bottom: 1.5rem;
            font-weight: 500;
            animation: slideDown 0.3s ease-out;
          }

          @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .queue-grid {
            display: grid;
            grid-template-columns: 1fr 400px;
            gap: 2rem;
          }

          @media (max-width: 1024px) {
            .queue-grid {
              grid-template-columns: 1fr;
            }
          }

          .queue-display-wrapper,
          .queue-control-wrapper {
            animation: slideUp 0.4s ease-out;
          }

          .queue-control-wrapper {
            animation-delay: 0.1s;
          }

          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
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
            font-size: 1.25rem;
          }

          .empty-state p {
            margin: 0;
            color: var(--text-secondary);
          }

          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 300px;
          }

          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid var(--border);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          @media (max-width: 768px) {
            .page-header {
              padding: 1.5rem;
            }

            .header-content {
              flex-direction: column;
              align-items: stretch;
            }

            .service-selector {
              width: 100%;
            }

            .service-select {
              width: 100%;
            }

            .page-title {
              font-size: 1.5rem;
            }
          }
        `}</style>
      </div>
    </Layout>
  );
};

export default QueueManagementPage;
