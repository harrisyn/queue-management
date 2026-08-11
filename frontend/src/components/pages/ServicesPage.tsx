'use client';

import React, { useEffect, useState, useCallback } from 'react';
import api from '@/api/client';
import Layout from '@/components/Layout';
import { useAuthContext } from '@/contexts/AuthContext';
import { useSubscription, UpgradePrompt } from '@/contexts/SubscriptionContext';
import type { Service, Location, Organization, ServiceType } from '@/types';

interface ServicePoint {
  id: string;
  name: string;
  displayName?: string;
  type: string;
  isActive: boolean;
  capacity: number;
}

// Linked service point data from API (flat structure)
interface LinkedServicePoint {
  id: string;           // service point id
  name: string;
  displayName?: string;
  type: string;
  capacity: number;     // Effective capacity (serviceCapacity ?? defaultCapacity)
  isOccupied?: boolean;
  linkId: string;       // ServicePointService id
  // For capacity editing
  serviceCapacity?: number | null;  // Override capacity for this service
  defaultCapacity?: number;  // Original service point capacity
}

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
  const { user, isAdmin } = useAuthContext();
  const { canCreate, limits, refresh: refreshSubscription } = useSubscription();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  
  // Service Points state
  const [locationServicePoints, setLocationServicePoints] = useState<ServicePoint[]>([]);
  const [linkedServicePoints, setLinkedServicePoints] = useState<LinkedServicePoint[]>([]);
  const [showServicePointsPanel, setShowServicePointsPanel] = useState(false);
  
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
      if (user?.organizationId) {
        const org = await api.getOrganization(user.organizationId);
        setOrganizations([org]);
        setSelectedOrg(org.id);
      } else {
        const orgs = await api.getOrganizations();
        setOrganizations(orgs);
        if (orgs.length > 0) {
          setSelectedOrg(orgs[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user?.organizationId]);

  const loadLocations = useCallback(async (orgId: string) => {
    try {
      const locs = await api.getLocations(orgId);
      setLocations(locs);
      if (locs.length > 0) {
        setSelectedLocation(locs[0].id);
      } else {
        setSelectedLocation('');
        setServices([]);
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
      await refreshSubscription(); // Refresh subscription to update limits
      resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    try {
      await api.updateService(editingService.id, formData);
      await loadServices(selectedLocation);
      resetForm();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update service');
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service? This will also delete all associated queues.')) {
      return;
    }

    try {
      await api.deleteService(serviceId);
      await loadServices(selectedLocation);
      setShowDetails(false);
      setSelectedService(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete service');
    }
  };

  const openDetails = (service: Service) => {
    setSelectedService(service);
    setShowDetails(true);
    setShowForm(false);
  };

  const startEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      type: service.type,
      slotDuration: service.slotDuration,
      concurrentLimit: service.concurrentLimit,
      startTime: service.startTime || '09:00',
      endTime: service.endTime || '17:00',
      activeDays: service.activeDays || '1,2,3,4,5',
    });
    setShowForm(true);
    setShowDetails(false);
  };

  const resetForm = () => {
    setShowForm(false);
    setShowDetails(false);
    setSelectedService(null);
    setEditingService(null);
    setFormData({
      name: '',
      description: '',
      type: 'GENERAL',
      slotDuration: 15,
      concurrentLimit: 1,
      startTime: '09:00',
      endTime: '17:00',
      activeDays: '1,2,3,4,5',
    });
  };

  const getDayNames = (activeDays: string) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return activeDays.split(',').map(d => days[parseInt(d)] || d).join(', ');
  };

  const getCurrentLocation = () => {
    return locations.find((l: Location) => l.id === selectedLocation);
  };

  // Service Points Management
  const loadLocationServicePoints = useCallback(async (locationId: string) => {
    try {
      const points = await api.getServicePoints(locationId);
      setLocationServicePoints(points);
    } catch (err) {
      console.error('Failed to load service points:', err);
      setLocationServicePoints([]);
    }
  }, []);

  const loadLinkedServicePoints = useCallback(async (serviceId: string) => {
    try {
      const linked = await api.getServicePointsForService(serviceId);
      setLinkedServicePoints(linked);
    } catch (err) {
      console.error('Failed to load linked service points:', err);
      setLinkedServicePoints([]);
    }
  }, []);

  const handleLinkServicePoint = async (servicePointId: string) => {
    if (!selectedService) return;
    try {
      await api.linkServicePointToService(servicePointId, selectedService.id);
      await loadLinkedServicePoints(selectedService.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to link service point');
    }
  };

  const handleUnlinkServicePoint = async (servicePointId: string) => {
    if (!selectedService) return;
    try {
      await api.unlinkServicePointFromService(servicePointId, selectedService.id);
      await loadLinkedServicePoints(selectedService.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to unlink service point');
    }
  };

  const handleUpdateLinkCapacity = async (linkId: string, capacity: number | null) => {
    if (!selectedService) return;
    try {
      await api.updateServicePointLink(linkId, { capacity });
      await loadLinkedServicePoints(selectedService.id);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update capacity');
    }
  };

  const openServicePointsPanel = async (service: Service) => {
    setSelectedService(service);
    setShowServicePointsPanel(true);
    setShowDetails(false);
    setShowForm(false);
    await Promise.all([
      loadLocationServicePoints(selectedLocation),
      loadLinkedServicePoints(service.id)
    ]);
  };

  return (
    <Layout>
      <div style={pageContainer}>
        {/* Header */}
        <div style={headerSection}>
          <div style={headerContent}>
            <div style={headerLeft}>
              <div style={headerIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </div>
              <div>
                <h1 style={pageTitle}>Services</h1>
                <p style={pageSubtitle}>
                  Configure and manage your queue services
                  <span style={{ marginLeft: '8px', fontSize: '12px', color: '#6b7280' }}>
                    ({limits.services.current}/{limits.services.limit} used)
                  </span>
                </p>
              </div>
            </div>
            <button 
              onClick={() => { resetForm(); setShowForm(true); }} 
              style={{
                ...addButton,
                ...(!selectedLocation || !canCreate('services') ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
              }} 
              disabled={!selectedLocation || !canCreate('services')}
              title={!canCreate('services') ? 'Service limit reached. Upgrade to add more.' : !selectedLocation ? 'Select a location first' : 'Add a new service'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Service
            </button>
          </div>
        </div>

        {/* Upgrade prompt if limit reached */}
        {!canCreate('services') && (
          <div style={{ padding: '0 24px' }}>
            <UpgradePrompt resource="services" />
          </div>
        )}

        {/* Filters */}
        <div style={filtersBar}>
          {organizations.length > 1 && (
            <div style={filterGroup}>
              <label style={filterLabel}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Organization
              </label>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                style={filterSelect}
              >
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={filterGroup}>
            <label style={filterLabel}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Location
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              style={filterSelect}
            >
              {locations.length === 0 ? (
                <option value="">No locations available</option>
              ) : (
                locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))
              )}
            </select>
          </div>

          {getCurrentLocation()?.publicCode && (
            <div style={locationInfo}>
              <span style={locationBadge}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                /join/{getCurrentLocation()?.publicCode}
              </span>
            </div>
          )}
        </div>

        {/* Service Details Panel */}
        {showDetails && selectedService && (
          <div style={detailsPanel}>
            <div style={detailsHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h2 style={detailsTitle}>{selectedService.name}</h2>
                <span style={selectedService.type === 'GENERAL' ? typeBadgeGeneral : typeBadgeIndividual}>
                  {selectedService.type}
                </span>
              </div>
              <button onClick={() => setShowDetails(false)} style={closeButton}>×</button>
            </div>
            
            <div style={detailsBody}>
              {selectedService.description && (
                <p style={serviceDescription}>{selectedService.description}</p>
              )}
              
              <div style={detailsGrid}>
                <div style={detailItem}>
                  <span style={detailLabel}>Slot Duration</span>
                  <span style={detailValue}>{selectedService.slotDuration} minutes</span>
                </div>
                <div style={detailItem}>
                  <span style={detailLabel}>Concurrent Limit</span>
                  <span style={detailValue}>{selectedService.concurrentLimit} at a time</span>
                </div>
                <div style={detailItem}>
                  <span style={detailLabel}>Operating Hours</span>
                  <span style={detailValue}>{selectedService.startTime || '09:00'} - {selectedService.endTime || '17:00'}</span>
                </div>
                <div style={detailItem}>
                  <span style={detailLabel}>Active Days</span>
                  <span style={detailValue}>{getDayNames(selectedService.activeDays || '1,2,3,4,5')}</span>
                </div>
              </div>

              {/* Quick Stats */}
              <div style={statsSection}>
                <h3 style={statsSectionTitle}>Queue Information</h3>
                <div style={statsGrid}>
                  <div style={statCard}>
                    <div style={statIcon}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <div>
                      <div style={statValue}>{selectedService.queues?.length || 0}</div>
                      <div style={statLabel}>Active Queues</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={detailsActions}>
              <button onClick={() => openServicePointsPanel(selectedService)} style={servicePointsButtonLarge}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                Manage Service Points
              </button>
              <button onClick={() => startEdit(selectedService)} style={editButtonLarge}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit Service
              </button>
              <button onClick={() => handleDeleteService(selectedService.id)} style={deleteButtonLarge}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Delete Service
              </button>
            </div>
          </div>
        )}

        {/* Service Points Management Panel */}
        {showServicePointsPanel && selectedService && (
          <div style={detailsPanel}>
            <div style={detailsHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h2 style={detailsTitle}>Service Points for {selectedService.name}</h2>
              </div>
              <button onClick={() => { setShowServicePointsPanel(false); setSelectedService(null); }} style={closeButton}>×</button>
            </div>
            
            <div style={detailsBody}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Assign service points (windows/counters) where this service can be provided. 
                Patients will be directed to these service points when called.
              </p>

              {/* Linked Service Points */}
              <div style={servicePointsSection}>
                <h3 style={sectionTitle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  Linked Service Points ({linkedServicePoints.length})
                </h3>
                
                {linkedServicePoints.length === 0 ? (
                  <div style={emptyServicePoints}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                    <p>No service points linked yet</p>
                    <span>Add service points from the available list below</span>
                  </div>
                ) : (
                  <div style={servicePointsList}>
                    {linkedServicePoints.map((sp) => (
                      <div key={sp.linkId} style={servicePointCard}>
                        <div style={servicePointInfo}>
                          <div style={servicePointIcon}>
                            {sp.type === 'RECEPTION' ? (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="8.5" cy="7" r="4" />
                                <line x1="20" y1="8" x2="20" y2="14" />
                                <line x1="23" y1="11" x2="17" y2="11" />
                              </svg>
                            ) : sp.type === 'CONSULTATION' ? (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                              </svg>
                            ) : (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <line x1="3" y1="9" x2="21" y2="9" />
                                <line x1="9" y1="21" x2="9" y2="9" />
                              </svg>
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={servicePointName}>{sp.displayName || sp.name}</div>
                            <div style={servicePointMeta}>
                              Type: {sp.type}
                            </div>
                          </div>
                          <div style={capacityEditWrapper}>
                            <label style={capacityLabel}>Capacity:</label>
                            <input
                              type="number"
                              min="1"
                              value={sp.serviceCapacity ?? sp.defaultCapacity ?? sp.capacity}
                              onChange={(e) => {
                                const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                                handleUpdateLinkCapacity(sp.linkId, val);
                              }}
                              style={capacityInput}
                              title={sp.serviceCapacity != null ? `Custom for this service (default: ${sp.defaultCapacity})` : `Using default capacity`}
                            />
                            {sp.serviceCapacity != null && (
                              <button
                                onClick={() => handleUpdateLinkCapacity(sp.linkId, null)}
                                style={resetCapacityButton}
                                title={`Reset to default (${sp.defaultCapacity})`}
                              >
                                ↺
                              </button>
                            )}
                          </div>
                        </div>
                        <button 
                          onClick={() => handleUnlinkServicePoint(sp.id)} 
                          style={unlinkButton}
                          title="Remove from service"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Available Service Points */}
              <div style={{ ...servicePointsSection, marginTop: '2rem' }}>
                <h3 style={sectionTitle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  Available Service Points
                </h3>
                
                {locationServicePoints.filter(sp => 
                  !linkedServicePoints.some(linked => linked.id === sp.id)
                ).length === 0 ? (
                  <div style={emptyServicePoints}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <p>No available service points</p>
                    <span>All service points are already linked, or create new ones in Admin → Service Points</span>
                  </div>
                ) : (
                  <div style={servicePointsList}>
                    {locationServicePoints
                      .filter(sp => !linkedServicePoints.some(linked => linked.id === sp.id))
                      .map((sp) => (
                        <div key={sp.id} style={servicePointCardAvailable}>
                          <div style={servicePointInfo}>
                            <div style={servicePointIconAvailable}>
                              {sp.type === 'RECEPTION' ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                  <circle cx="8.5" cy="7" r="4" />
                                  <line x1="20" y1="8" x2="20" y2="14" />
                                  <line x1="23" y1="11" x2="17" y2="11" />
                                </svg>
                              ) : sp.type === 'CONSULTATION' ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                                </svg>
                              ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                  <line x1="3" y1="9" x2="21" y2="9" />
                                  <line x1="9" y1="21" x2="9" y2="9" />
                                </svg>
                              )}
                            </div>
                            <div>
                              <div style={servicePointName}>{sp.displayName || sp.name}</div>
                              <div style={servicePointMeta}>
                                Type: {sp.type} • 
                                Capacity: {sp.capacity} • 
                                {sp.isActive ? 'Active' : 'Inactive'}
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleLinkServicePoint(sp.id)} 
                            style={linkButton}
                            title="Add to service"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <div style={detailsActions}>
              <button onClick={() => { setShowServicePointsPanel(false); openDetails(selectedService); }} style={editButtonLarge}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                Back to Service Details
              </button>
            </div>
          </div>
        )}

        {/* Create/Edit Service Form */}
        {showForm && (
          <div style={formCard}>
            <div style={formHeader}>
              <h3 style={formTitle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {editingService ? 'Edit Service' : 'Create New Service'}
              </h3>
              <button onClick={resetForm} style={closeButton}>×</button>
            </div>
            <form onSubmit={editingService ? handleUpdateService : handleCreateService} style={formBody}>
              <div style={formGrid}>
                <div style={formField}>
                  <label style={labelStyle}>Service Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., General Consultation"
                    required
                    style={inputStyle}
                  />
                </div>

                <div style={formField}>
                  <label style={labelStyle}>Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as ServiceType })}
                    style={inputStyle}
                  >
                    <option value="GENERAL">General (First come, first served)</option>
                    <option value="INDIVIDUAL">Individual (Appointment-based)</option>
                  </select>
                </div>

                <div style={formField}>
                  <label style={labelStyle}>Slot Duration (minutes)</label>
                  <input
                    type="number"
                    value={formData.slotDuration}
                    onChange={(e) => setFormData({ ...formData, slotDuration: parseInt(e.target.value) })}
                    min={5}
                    style={inputStyle}
                  />
                </div>

                <div style={formField}>
                  <label style={labelStyle}>Concurrent Limit</label>
                  <input
                    type="number"
                    value={formData.concurrentLimit}
                    onChange={(e) => setFormData({ ...formData, concurrentLimit: parseInt(e.target.value) })}
                    min={1}
                    style={inputStyle}
                  />
                </div>

                <div style={formField}>
                  <label style={labelStyle}>Start Time</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                <div style={formField}>
                  <label style={labelStyle}>End Time</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={formFieldFull}>
                <label style={labelStyle}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the service..."
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div style={formActions}>
                <button type="submit" style={submitButton}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {editingService ? 'Save Changes' : 'Create Service'}
                </button>
                <button type="button" onClick={resetForm} style={cancelButton}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Services Grid */}
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <div className="spinner" />
          </div>
        ) : locations.length === 0 ? (
          <div style={emptyState}>
            <div style={emptyIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <h3 style={emptyTitle}>No Locations Yet</h3>
            <p style={emptyText}>Create a location first before adding services</p>
            <a href="/admin/locations" style={emptyLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Go to Locations
            </a>
          </div>
        ) : services.length === 0 && !showForm ? (
          <div style={emptyState}>
            <div style={emptyIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <h3 style={emptyTitle}>No Services Yet</h3>
            <p style={emptyText}>Create your first service to start managing queues</p>
            <button onClick={() => setShowForm(true)} style={emptyButton}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Your First Service
            </button>
          </div>
        ) : (
          <div style={servicesGrid}>
            {services.map(service => (
              <div 
                key={service.id} 
                style={{
                  ...serviceCard,
                  ...(selectedService?.id === service.id ? serviceCardActive : {}),
                }}
                onClick={() => openDetails(service)}
              >
                <div style={cardHeader}>
                  <div style={cardIcon}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                  </div>
                  <span style={service.type === 'GENERAL' ? typeBadgeGeneral : typeBadgeIndividual}>
                    {service.type}
                  </span>
                </div>
                <h3 style={serviceName}>{service.name}</h3>
                <p style={serviceDesc}>{service.description || 'No description provided'}</p>
                <div style={serviceDetails}>
                  <div style={detailChip}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {service.slotDuration} min
                  </div>
                  <div style={detailChip}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    {service.concurrentLimit} concurrent
                  </div>
                  <div style={detailChip}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {service.startTime || '09:00'} - {service.endTime || '17:00'}
                  </div>
                </div>

                <div style={cardClickHint}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  Click for details
                </div>

                <div style={cardActions} onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => startEdit(service)} style={editButton}>
                    Edit
                  </button>
                  <button onClick={() => handleDeleteService(service.id)} style={deleteButton}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ServicesPage;

// Styles
const pageContainer: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
};

const headerSection: React.CSSProperties = {
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  borderRadius: '16px',
  padding: '2rem',
  marginBottom: '1.5rem',
  color: 'white',
  boxShadow: '0 10px 40px rgba(99, 102, 241, 0.3)',
};

const headerContent: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const headerLeft: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
};

const headerIcon: React.CSSProperties = {
  width: '56px',
  height: '56px',
  background: 'rgba(255, 255, 255, 0.2)',
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backdropFilter: 'blur(10px)',
};

const pageTitle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.75rem',
  fontWeight: 700,
};

const pageSubtitle: React.CSSProperties = {
  margin: '0.25rem 0 0',
  opacity: 0.9,
};

const addButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.25rem',
  background: 'rgba(255, 255, 255, 0.2)',
  color: 'white',
  border: '1px solid rgba(255, 255, 255, 0.3)',
  borderRadius: '10px',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
  backdropFilter: 'blur(10px)',
};

const filtersBar: React.CSSProperties = {
  display: 'flex',
  gap: '1.5rem',
  marginBottom: '1.5rem',
  padding: '1rem 1.25rem',
  background: 'white',
  borderRadius: '12px',
  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.06)',
  alignItems: 'flex-end',
  flexWrap: 'wrap',
};

const filterGroup: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const filterLabel: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const filterSelect: React.CSSProperties = {
  padding: '0.6rem 1rem',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  fontSize: '0.95rem',
  minWidth: '200px',
  cursor: 'pointer',
  background: 'white',
  color: '#374151',
};

const locationInfo: React.CSSProperties = {
  marginLeft: 'auto',
};

const locationBadge: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  padding: '0.5rem 0.875rem',
  background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
  color: '#166534',
  borderRadius: '8px',
  fontSize: '0.875rem',
  fontWeight: 600,
};

const detailsPanel: React.CSSProperties = {
  background: 'white',
  borderRadius: '16px',
  marginBottom: '1.5rem',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
  overflow: 'hidden',
};

const detailsHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid #e5e7eb',
  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
};

const detailsTitle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 600,
  color: '#111827',
};

const detailsBody: React.CSSProperties = {
  padding: '1.5rem',
};

const serviceDescription: React.CSSProperties = {
  margin: '0 0 1.5rem',
  color: '#6b7280',
  lineHeight: 1.6,
};

const detailsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '1rem',
  marginBottom: '1.5rem',
};

const detailItem: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const detailLabel: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const detailValue: React.CSSProperties = {
  fontSize: '0.95rem',
  color: '#111827',
};

const statsSection: React.CSSProperties = {
  padding: '1.25rem',
  background: '#f9fafb',
  borderRadius: '12px',
};

const statsSectionTitle: React.CSSProperties = {
  margin: '0 0 1rem',
  fontSize: '0.9rem',
  fontWeight: 600,
  color: '#374151',
};

const statsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '1rem',
};

const statCard: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '1rem',
  background: 'white',
  borderRadius: '10px',
  border: '1px solid #e5e7eb',
};

const statIcon: React.CSSProperties = {
  width: '40px',
  height: '40px',
  background: 'linear-gradient(135deg, #f0f0ff 0%, #e8e8ff 100%)',
  borderRadius: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#6366f1',
};

const statValue: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 700,
  color: '#111827',
};

const statLabel: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#6b7280',
};

const detailsActions: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  padding: '1rem 1.5rem',
  borderTop: '1px solid #e5e7eb',
  background: '#f9fafb',
};

const editButtonLarge: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.5rem',
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '0.9375rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const deleteButtonLarge: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.5rem',
  background: 'white',
  color: '#dc2626',
  border: '1px solid #fecaca',
  borderRadius: '8px',
  fontSize: '0.9375rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const formCard: React.CSSProperties = {
  background: 'white',
  borderRadius: '16px',
  marginBottom: '2rem',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
  overflow: 'hidden',
};

const formHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1.25rem 1.5rem',
  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
  borderBottom: '1px solid #e5e7eb',
};

const formTitle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  margin: 0,
  fontSize: '1.1rem',
  color: '#111827',
};

const closeButton: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '1.5rem',
  color: '#9ca3af',
  cursor: 'pointer',
  lineHeight: 1,
};

const formBody: React.CSSProperties = {
  padding: '1.5rem',
};

const formGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '1.25rem',
  marginBottom: '1.25rem',
};

const formField: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const formFieldFull: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  marginBottom: '1.25rem',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#374151',
};

const inputStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
  fontSize: '0.95rem',
  background: '#f9fafb',
  color: '#111827',
};

const formActions: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
};

const submitButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.5rem',
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '10px',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
};

const cancelButton: React.CSSProperties = {
  padding: '0.75rem 1.5rem',
  background: '#f1f5f9',
  color: '#64748b',
  border: 'none',
  borderRadius: '10px',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const servicesGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
  gap: '1.5rem',
};

const serviceCard: React.CSSProperties = {
  background: 'white',
  borderRadius: '16px',
  padding: '1.5rem',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
  cursor: 'pointer',
  transition: 'all 0.2s',
  borderWidth: '2px',
  borderStyle: 'solid',
  borderColor: 'transparent',
};

const serviceCardActive: React.CSSProperties = {
  borderColor: '#6366f1',
  boxShadow: '0 8px 30px rgba(99, 102, 241, 0.2)',
};

const cardHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '1rem',
};

const cardIcon: React.CSSProperties = {
  width: '48px',
  height: '48px',
  background: 'linear-gradient(135deg, #f0f0ff 0%, #e8e8ff 100%)',
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#6366f1',
};

const typeBadgeGeneral: React.CSSProperties = {
  padding: '0.35rem 0.75rem',
  background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
  color: '#16a34a',
  borderRadius: '20px',
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const typeBadgeIndividual: React.CSSProperties = {
  padding: '0.35rem 0.75rem',
  background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
  color: '#2563eb',
  borderRadius: '20px',
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const serviceName: React.CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '1.25rem',
  fontWeight: 600,
  color: '#111827',
};

const serviceDesc: React.CSSProperties = {
  margin: '0 0 1.25rem',
  color: '#6b7280',
  fontSize: '0.9rem',
  lineHeight: 1.5,
};

const serviceDetails: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.75rem',
  padding: '1rem',
  background: '#f8fafc',
  borderRadius: '10px',
  marginBottom: '1rem',
};

const detailChip: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  fontSize: '0.85rem',
  color: '#6b7280',
};

const cardClickHint: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.375rem',
  fontSize: '0.75rem',
  color: '#6366f1',
  marginBottom: '1rem',
};

const cardActions: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  paddingTop: '1rem',
  borderTop: '1px solid #f3f4f6',
};

const editButton: React.CSSProperties = {
  flex: 1,
  padding: '0.5rem 1rem',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  background: 'white',
  color: '#374151',
  fontWeight: 500,
  cursor: 'pointer',
  fontSize: '0.875rem',
};

const deleteButton: React.CSSProperties = {
  flex: 1,
  padding: '0.5rem 1rem',
  borderRadius: '8px',
  border: '1px solid #fecaca',
  background: '#fef2f2',
  color: '#dc2626',
  fontWeight: 500,
  cursor: 'pointer',
  fontSize: '0.875rem',
};

const emptyState: React.CSSProperties = {
  textAlign: 'center',
  padding: '4rem 2rem',
  background: 'white',
  borderRadius: '16px',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
};

const emptyIcon: React.CSSProperties = {
  width: '100px',
  height: '100px',
  background: 'linear-gradient(135deg, #f0f0ff 0%, #e8e8ff 100%)',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: '0 auto 1.5rem',
  color: '#6366f1',
};

const emptyTitle: React.CSSProperties = {
  margin: '0 0 0.5rem',
  color: '#111827',
  fontSize: '1.25rem',
};

const emptyText: React.CSSProperties = {
  margin: '0 0 1.5rem',
  color: '#6b7280',
};

const emptyButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.5rem',
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '10px',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
};

const emptyLink: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.5rem',
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  color: 'white',
  borderRadius: '10px',
  fontSize: '0.95rem',
  fontWeight: 600,
  textDecoration: 'none',
  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)',
};

// Service Points Styles
const servicePointsButtonLarge: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.25rem',
  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '10px',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
};

const servicePointsSection: React.CSSProperties = {
  background: 'var(--bg-tertiary, #f9fafb)',
  borderRadius: '12px',
  padding: '1.25rem',
  border: '1px solid var(--border-color, #e5e7eb)',
};

const sectionTitle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  margin: '0 0 1rem',
  fontSize: '1rem',
  fontWeight: 600,
  color: 'var(--text-primary, #111827)',
};

const emptyServicePoints: React.CSSProperties = {
  textAlign: 'center',
  padding: '2rem 1rem',
  color: 'var(--text-secondary, #6b7280)',
};

const servicePointsList: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};

const servicePointCard: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '1rem',
  background: 'white',
  borderRadius: '10px',
  border: '1px solid #d1fae5',
  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)',
};

const servicePointCardAvailable: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '1rem',
  background: 'white',
  borderRadius: '10px',
  border: '1px solid var(--border-color, #e5e7eb)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
};

const servicePointInfo: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
};

const servicePointIcon: React.CSSProperties = {
  width: '40px',
  height: '40px',
  background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
  borderRadius: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#059669',
};

const servicePointIconAvailable: React.CSSProperties = {
  width: '40px',
  height: '40px',
  background: 'var(--bg-tertiary, #f3f4f6)',
  borderRadius: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-secondary, #6b7280)',
};

const servicePointName: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '0.95rem',
  color: 'var(--text-primary, #111827)',
};

const servicePointMeta: React.CSSProperties = {
  fontSize: '0.8rem',
  color: 'var(--text-secondary, #6b7280)',
  marginTop: '0.125rem',
};

const capacityEditWrapper: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginLeft: 'auto',
  marginRight: '0.5rem',
};

const capacityLabel: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--text-secondary, #6b7280)',
  fontWeight: 500,
};

const capacityInput: React.CSSProperties = {
  width: '60px',
  padding: '0.25rem 0.5rem',
  border: '1px solid var(--border, #e5e7eb)',
  borderRadius: '6px',
  fontSize: '0.85rem',
  textAlign: 'center',
};

const resetCapacityButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  background: 'transparent',
  border: '1px solid var(--border, #e5e7eb)',
  borderRadius: '4px',
  color: 'var(--text-secondary, #6b7280)',
  cursor: 'pointer',
  fontSize: '0.9rem',
};

const unlinkButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '8px',
  color: '#dc2626',
  cursor: 'pointer',
};

const linkButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  padding: '0.5rem 1rem',
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
};
