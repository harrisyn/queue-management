'use client';

import React, { useEffect, useState, useCallback } from 'react';
import api from '@/api/client';
import Layout from '@/components/Layout';
import type { Service, Location, Organization, ServiceType } from '@/types';

interface ServiceFormData {
  name: string;
  description: string;
  type: ServiceType;
  slotDuration: number;
  concurrentLimit: number;
  startTime: string;
  endTime: string;
  activeDays: string;
}

const ServicesPage: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<ServiceFormData>({
    name: '',
    description: '',
    type: 'GENERAL',
    slotDuration: 15,
    concurrentLimit: 1,
    startTime: '09:00',
    endTime: '17:00',
    activeDays: '1,2,3,4,5',
  });

  const loadOrganizations = useCallback(async () => {
    try {
      const orgs = await api.getOrganizations();
      setOrganizations(orgs);
      if (orgs.length > 0) {
        setSelectedOrg(orgs[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLocations = useCallback(async (orgId: string) => {
    try {
      const locs = await api.getLocations(orgId);
      setLocations(locs);
      if (locs.length > 0) {
        setSelectedLocation(locs[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadServices = useCallback(async (locationId: string) => {
    try {
      const svcs = await api.getServices(locationId);
      setServices(svcs);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    if (selectedOrg) loadLocations(selectedOrg);
  }, [selectedOrg, loadLocations]);

  useEffect(() => {
    if (selectedLocation) loadServices(selectedLocation);
  }, [selectedLocation, loadServices]);

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocation) return;

    try {
      await api.createService(selectedLocation, formData);
      await loadServices(selectedLocation);
      setShowForm(false);
      setFormData({
        name: '',
        description: '',
        type: 'GENERAL' as ServiceType,
        slotDuration: 15,
        concurrentLimit: 1,
        startTime: '09:00',
        endTime: '17:00',
        activeDays: '1,2,3,4,5',
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Layout>
      <div className="services-page">
        {/* Page Header */}
        <div className="page-header">
          <div className="header-content">
            <div className="header-left">
              <div className="header-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </div>
              <div>
                <h1 className="page-title">Services</h1>
                <p className="page-subtitle">Configure and manage your queue services</p>
              </div>
            </div>
            <button onClick={() => setShowForm(!showForm)} className="add-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Service
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Organization
            </label>
            <select
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              className="filter-select"
            >
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Location
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="filter-select"
            >
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Create Service Form */}
        {showForm && (
          <div className="form-card">
            <div className="form-header">
              <h3>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Create New Service
              </h3>
            </div>
            <form onSubmit={handleCreateService}>
              <div className="form-grid">
                <div className="form-field">
                  <label>Service Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., General Consultation"
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as ServiceType })}
                  >
                    <option value="GENERAL">General</option>
                    <option value="INDIVIDUAL">Individual</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Slot Duration (min)</label>
                  <input
                    type="number"
                    value={formData.slotDuration}
                    onChange={(e) => setFormData({ ...formData, slotDuration: parseInt(e.target.value) })}
                    min={5}
                  />
                </div>

                <div className="form-field">
                  <label>Concurrent Limit</label>
                  <input
                    type="number"
                    value={formData.concurrentLimit}
                    onChange={(e) => setFormData({ ...formData, concurrentLimit: parseInt(e.target.value) })}
                    min={1}
                  />
                </div>

                <div className="form-field">
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label>End Time</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-field full-width">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the service..."
                  rows={3}
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Create Service
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Services Grid */}
        <div className="services-grid">
          {services.map(service => (
            <div key={service.id} className="service-card">
              <div className="card-header">
                <div className="card-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                </div>
                <span className={`type-badge ${service.type.toLowerCase()}`}>{service.type}</span>
              </div>
              <h3 className="service-name">{service.name}</h3>
              <p className="service-description">{service.description || 'No description provided'}</p>
              <div className="service-details">
                <div className="detail-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {service.slotDuration} min
                </div>
                <div className="detail-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  {service.concurrentLimit} concurrent
                </div>
                <div className="detail-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {service.startTime} - {service.endTime}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {services.length === 0 && !loading && (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <h3>No Services Yet</h3>
            <p>Create your first service to start managing queues</p>
            <button onClick={() => setShowForm(true)} className="add-btn-inline">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Your First Service
            </button>
          </div>
        )}

        <style jsx>{`
          .services-page {
            max-width: 1200px;
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
            margin-bottom: 1.5rem;
            color: white;
            box-shadow: 0 10px 40px rgba(99, 102, 241, 0.3);
          }

          .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
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

          .add-btn {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.25rem;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 10px;
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            backdrop-filter: blur(10px);
          }

          .add-btn:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
          }

          .filters-bar {
            display: flex;
            gap: 1.5rem;
            margin-bottom: 1.5rem;
            padding: 1rem 1.25rem;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
          }

          .filter-group {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .filter-label {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            font-size: 0.8rem;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .filter-select {
            padding: 0.6rem 1rem;
            border: 1px solid var(--border);
            border-radius: 8px;
            font-size: 0.95rem;
            min-width: 200px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .filter-select:hover {
            border-color: var(--primary);
          }

          .filter-select:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
          }

          .form-card {
            background: white;
            border-radius: 16px;
            margin-bottom: 2rem;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            animation: slideDown 0.3s ease-out;
          }

          @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .form-header {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            padding: 1.25rem 1.5rem;
            border-bottom: 1px solid var(--border);
          }

          .form-header h3 {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin: 0;
            font-size: 1.1rem;
            color: var(--text);
          }

          .form-card form {
            padding: 1.5rem;
          }

          .form-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1.25rem;
            margin-bottom: 1.25rem;
          }

          .form-field {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .form-field.full-width {
            grid-column: 1 / -1;
          }

          .form-field label {
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--text-secondary);
          }

          .form-field input,
          .form-field select,
          .form-field textarea {
            padding: 0.75rem 1rem;
            border: 1px solid var(--border);
            border-radius: 10px;
            font-size: 0.95rem;
            transition: all 0.2s;
          }

          .form-field input:focus,
          .form-field select:focus,
          .form-field textarea:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
          }

          .form-field textarea {
            resize: vertical;
          }

          .form-actions {
            display: flex;
            gap: 1rem;
            margin-top: 1rem;
          }

          .btn-primary {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
          }

          .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
          }

          .btn-secondary {
            padding: 0.75rem 1.5rem;
            background: #f1f5f9;
            color: var(--text-secondary);
            border: none;
            border-radius: 10px;
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-secondary:hover {
            background: #e2e8f0;
          }

          .services-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 1.5rem;
          }

          .service-card {
            background: white;
            border-radius: 16px;
            padding: 1.5rem;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            transition: all 0.3s;
          }

          .service-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
          }

          .card-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 1rem;
          }

          .card-icon {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, #f0f0ff 0%, #e8e8ff 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--primary);
          }

          .type-badge {
            padding: 0.35rem 0.75rem;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .type-badge.general {
            background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
            color: #16a34a;
          }

          .type-badge.individual {
            background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
            color: #2563eb;
          }

          .service-name {
            margin: 0 0 0.5rem;
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--text);
          }

          .service-description {
            margin: 0 0 1.25rem;
            color: var(--text-secondary);
            font-size: 0.9rem;
            line-height: 1.5;
          }

          .service-details {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            padding: 1rem;
            background: #f8fafc;
            border-radius: 10px;
          }

          .detail-item {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            font-size: 0.85rem;
            color: var(--text-secondary);
          }

          .detail-item svg {
            color: var(--primary);
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
            margin: 0 0 1.5rem;
            color: var(--text-secondary);
          }

          .add-btn-inline {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
          }

          .add-btn-inline:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
          }

          @media (max-width: 768px) {
            .page-header {
              padding: 1.5rem;
            }

            .header-content {
              flex-direction: column;
              gap: 1rem;
              text-align: center;
            }

            .header-left {
              flex-direction: column;
            }

            .filters-bar {
              flex-direction: column;
            }

            .form-grid {
              grid-template-columns: 1fr;
            }

            .services-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </div>
    </Layout>
  );
};

export default ServicesPage;
