'use client';

import React, { useEffect, useState, useCallback } from 'react';
import api from '@/api/client';
import Layout from '@/components/Layout';
import { useSocket } from '@/hooks/useSocket';
import { useAuthContext } from '@/contexts/AuthContext';
import type { Queue, Service, QueueEntry, Location } from '@/types';

// localStorage keys for persistence
const STORAGE_KEYS = {
  LOCATION: 'qms_operator_location',
  SERVICE: 'qms_operator_service',
  SERVICE_POINT: 'qms_operator_service_point',
  INSTANCE_ID: 'qms_operator_instance_id',
};

interface IdentityData {
  mrNumber?: string;
  patientId?: string;
  insuranceId?: string;
  nationalId?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  alternatePhone?: string;
  emergencyContact?: string;
  allergies?: string;
  medicalConditions?: string;
  lastVisitDate?: string;
  primaryPhysician?: string;
  [key: string]: string | undefined;
}

interface LinkedServicePoint {
  id: string;
  name: string;
  displayName?: string;
  type: string;
  capacity: number;
  isOccupied: boolean;
  activatedBy?: { id: string; firstName: string; lastName: string } | null;
  activatedAt?: string | null;
  linkId: string;
}

// Service point instance from the backend
interface ServicePointInstance {
  id: string;
  servicePointId: string;
  servicePointName: string;
  instanceNumber: number;
  displayName: string | null;
  isOccupied: boolean;
  occupiedBy?: { id: string; firstName: string; lastName: string } | null;
}

interface OperatorQueueData {
  queue: Queue;
  serving: QueueEntry[];
  waiting: QueueEntry[];
  nextServices: {
    serviceId: string;
    serviceName: string;
    displayName: string;
    isRequired: boolean;
    autoTransfer: boolean;
  }[];
  stats: {
    waiting: number;
    serving: number;
    total: number;
  };
}

const QueueManagementPage: React.FC = () => {
  const { user } = useAuthContext();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<string>('');
  const [operatorData, setOperatorData] = useState<OperatorQueueData | null>(null);
  const [servicePointInstances, setServicePointInstances] = useState<ServicePointInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [isActivating, setIsActivating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draggedEntry, setDraggedEntry] = useState<QueueEntry | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completedEntry, setCompletedEntry] = useState<QueueEntry | null>(null);
  const [nextServiceSuggestions, setNextServiceSuggestions] = useState<any[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Legacy - keep for backward compatibility during transition
  const [servicePoints, setServicePoints] = useState<LinkedServicePoint[]>([]);
  const [selectedServicePoint, setSelectedServicePoint] = useState<string>('');
  
  // Customer details modal state
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<QueueEntry | null>(null);
  const [customerIdentityData, setCustomerIdentityData] = useState<IdentityData>({});
  const [isLoadingIdentity, setIsLoadingIdentity] = useState(false);
  const [isSavingIdentity, setIsSavingIdentity] = useState(false);
  const [dataSources, setDataSources] = useState<any[]>([]);
  const [isFetchingFromSource, setIsFetchingFromSource] = useState(false);
  const [identityFieldsConfig, setIdentityFieldsConfig] = useState<Record<string, { required: boolean; label: string; type?: string }>>({});
  
  const { joinQueue, onQueueUpdated, onEntryStatusChanged } = useSocket();

  // Persist selections to localStorage
  useEffect(() => {
    if (selectedLocation && isInitialized) {
      localStorage.setItem(STORAGE_KEYS.LOCATION, selectedLocation);
    }
  }, [selectedLocation, isInitialized]);

  useEffect(() => {
    if (selectedService && isInitialized) {
      localStorage.setItem(STORAGE_KEYS.SERVICE, selectedService);
    }
  }, [selectedService, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(STORAGE_KEYS.SERVICE_POINT, selectedServicePoint);
    }
  }, [selectedServicePoint, isInitialized]);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(STORAGE_KEYS.INSTANCE_ID, selectedInstanceId);
    }
  }, [selectedInstanceId, isInitialized]);

  useEffect(() => {
    loadLocations();
  }, [user]);

  useEffect(() => {
    if (selectedLocation) {
      loadServices(selectedLocation);
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (selectedService) {
      loadOperatorQueue(selectedService);
      loadServicePointInstances(selectedService);
    }
  }, [selectedService]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (operatorData?.queue?.id) {
      joinQueue(operatorData.queue.id);
      
      const unsubscribeQueue = onQueueUpdated(() => {
        refreshQueue();
      });

      const unsubscribeEntry = onEntryStatusChanged(() => {
        refreshQueue();
      });

      return () => {
        unsubscribeQueue();
        unsubscribeEntry();
      };
    }
  }, [operatorData?.queue?.id]);

  const loadLocations = async () => {
    if (!user?.organizationId) {
      // No organization on this account (e.g. a superadmin). Never guess an
      // org - render the empty state instead of leaking another tenant's data.
      setLocations([]);
      setLoading(false);
      return;
    }
    try {
      {
        const locs = await api.getLocations(user.organizationId);
        setLocations(locs);
        
        // Try to restore from localStorage first
        const savedLocation = localStorage.getItem(STORAGE_KEYS.LOCATION);
        const savedService = localStorage.getItem(STORAGE_KEYS.SERVICE);
        const savedInstanceId = localStorage.getItem(STORAGE_KEYS.INSTANCE_ID);
        
        if (savedLocation && locs.some((l: Location) => l.id === savedLocation)) {
          setSelectedLocation(savedLocation);
          
          // Pre-load services for saved location
          const serviceList = await api.getServices(savedLocation);
          setServices(serviceList);
          
          let activeServiceId = '';
          if (savedService && serviceList.some((s: Service) => s.id === savedService)) {
            setSelectedService(savedService);
            activeServiceId = savedService;
          } else if (serviceList.length > 0) {
            setSelectedService(serviceList[0].id);
            activeServiceId = serviceList[0].id;
          }
          
          // Pre-load service point instances for the active service
          if (activeServiceId) {
            try {
              const instances = await api.getServiceInstances(activeServiceId);
              setServicePointInstances(instances);
              
              // Restore saved instance selection if valid
              if (savedInstanceId && instances.some((inst: ServicePointInstance) => inst.id === savedInstanceId)) {
                setSelectedInstanceId(savedInstanceId);
              }
            } catch (err) {
              console.error('Failed to load service point instances', err);
            }
          }
        } else if (locs.length > 0) {
          setSelectedLocation(locs[0].id);
        }
        
        setIsInitialized(true);
      }
    } catch (err) {
      console.error('Failed to load locations', err);
    } finally {
      setLoading(false);
    }
  };

  const loadServices = async (locationId: string) => {
    try {
      const serviceList = await api.getServices(locationId);
      setServices(serviceList);
      if (serviceList.length > 0) {
        setSelectedService(serviceList[0].id);
      } else {
        setSelectedService('');
        setOperatorData(null);
      }
    } catch (err) {
      console.error('Failed to load services', err);
    }
  };

  // Load database-backed service point instances for a service
  const loadServicePointInstances = async (serviceId: string) => {
    try {
      const instances = await api.getServiceInstances(serviceId);
      setServicePointInstances(instances);
    } catch (err) {
      console.error('Failed to load service point instances', err);
      setServicePointInstances([]);
    }
  };
  
  // Legacy function - keep for backward compatibility
  const loadServicePoints = async (serviceId: string) => {
    try {
      const points = await api.getServicePointsForService(serviceId);
      // API returns flat structure: {id, name, displayName, type, capacity, isOccupied, linkId, ...}
      
      // Expand service points by capacity - if capacity > 1, create multiple entries
      // Each instance uses the same base service point ID for backend calls,
      // but has a unique composite ID for UI selection
      const expandedPoints: LinkedServicePoint[] = [];
      
      points.forEach((p: any) => {
        const capacity = p.capacity || 1;
        
        if (capacity === 1) {
          // Single capacity - use as-is
          expandedPoints.push({
            id: p.id,
            name: p.name,
            displayName: p.displayName,
            type: p.type,
            capacity: 1,
            isOccupied: p.isOccupied,
            activatedBy: p.activatedBy,
            activatedAt: p.activatedAt,
            linkId: p.linkId
          });
        } else {
          // Multiple capacity - create numbered instances
          // All instances share the same base service point ID for backend calls
          for (let i = 1; i <= capacity; i++) {
            const baseName = p.displayName || p.name;
            expandedPoints.push({
              id: `${p.id}#${i}`, // Composite ID: baseId#instanceNumber
              name: `${p.name} ${i}`,
              displayName: `${baseName} ${i}`,
              type: p.type,
              capacity: 1,
              isOccupied: false, // TODO: Track per-instance occupancy on backend
              activatedBy: null,
              activatedAt: null,
              linkId: p.linkId
            });
          }
        }
      });
      
      setServicePoints(expandedPoints);
    } catch (err) {
      console.error('Failed to load service points', err);
      setServicePoints([]);
    }
  };
  
  // Extract base service point ID from composite ID (handles "id#instance" format)
  const getBaseServicePointId = (compositeId: string): string => {
    const hashIndex = compositeId.indexOf('#');
    return hashIndex > 0 ? compositeId.substring(0, hashIndex) : compositeId;
  };

  const loadOperatorQueue = async (serviceId: string) => {
    try {
      setLoading(true);
      // First create/get queue for today
      const queueData = await api.createQueue(serviceId);
      // Then get operator-specific view
      const data = await api.getQueueForOperator(queueData.id);
      setOperatorData(data);
      setError('');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  };

  const refreshQueue = useCallback(async () => {
    if (operatorData?.queue?.id) {
      try {
        const data = await api.getQueueForOperator(operatorData.queue.id);
        setOperatorData(data);
      } catch (err) {
        console.error('Failed to refresh queue', err);
      }
    }
  }, [operatorData?.queue?.id]);

  const handleCallNext = async () => {
    if (!operatorData?.queue?.id) return;
    
    // Require an instance to be selected (new instance-based flow)
    // Fall back to legacy service point if instances not available
    const instanceId = selectedInstanceId;
    const servicePointId = selectedServicePoint;
    
    if (!instanceId && !servicePointId) {
      setError('Please select a service desk before calling the next customer');
      return;
    }
    
    try {
      // Use the selected instance's service point ID for the backend call
      // The backend associates the entry with the service point AND instance
      const instance = servicePointInstances.find(i => i.id === instanceId);
      const baseId = instance?.servicePointId || getBaseServicePointId(servicePointId);
      await api.callNextWithServicePoint(operatorData.queue.id, baseId, instanceId || undefined);
      await refreshQueue();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to call next');
    }
  };

  // Vacate desk - clear the instance selection and notify backend
  const handleVacateDesk = async () => {
    if (!selectedInstanceId && !selectedServicePoint) return;
    if (!selectedService) return;
    
    try {
      if (selectedInstanceId) {
        // Use new instance-based API
        await api.vacateServicePointInstance(selectedInstanceId);
        setSelectedInstanceId('');
        localStorage.removeItem(STORAGE_KEYS.INSTANCE_ID);
        await loadServicePointInstances(selectedService);
      } else {
        // Legacy fallback
        const baseId = getBaseServicePointId(selectedServicePoint);
        await api.vacateServicePoint(baseId, selectedService);
        setSelectedServicePoint('');
        localStorage.removeItem(STORAGE_KEYS.SERVICE_POINT);
        await loadServicePoints(selectedService);
      }
    } catch (err) {
      console.error('Failed to vacate desk', err);
    }
  };

  // Activate a service point instance
  const handleActivateInstance = async (instanceId: string) => {
    if (!selectedService) return;
    
    setIsActivating(true);
    try {
      await api.activateServicePointInstance(instanceId, selectedService);
      setSelectedInstanceId(instanceId);
      // Reload instances to update occupancy status
      await loadServicePointInstances(selectedService);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to activate desk');
    } finally {
      setIsActivating(false);
    }
  };

  // Legacy: Activate a service point desk (for backward compatibility)
  const handleActivateDesk = async (servicePointId: string) => {
    if (!selectedService) return;
    
    setIsActivating(true);
    try {
      // Use base service point ID for backend call
      const baseId = getBaseServicePointId(servicePointId);
      await api.activateServicePoint(baseId, selectedService);
      setSelectedServicePoint(servicePointId); // Keep composite ID for UI
      // Reload service points to update occupancy status
      await loadServicePoints(selectedService);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to activate desk');
    } finally {
      setIsActivating(false);
    }
  };

  const handleComplete = async (entry: QueueEntry) => {
    if (!operatorData?.queue?.id) return;
    
    try {
      const result = await api.completeEntryWithSuggestions(operatorData.queue.id, entry.id);
      
      if (result.autoTransferred) {
        // Show notification that patient was auto-transferred
        alert(`Patient transferred to ${result.nextTicket?.serviceName} - New ticket: ${result.nextTicket?.ticketNumber}`);
      } else if (result.nextServices && result.nextServices.length > 0) {
        // Show modal with next service suggestions
        setCompletedEntry(entry);
        setNextServiceSuggestions(result.nextServices);
        setShowCompleteModal(true);
      }
      
      await refreshQueue();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to complete entry');
    }
  };

  const handleNoShow = async (entry: QueueEntry) => {
    if (!operatorData?.queue?.id) return;
    
    if (!confirm(`Mark ${entry.user?.firstName || entry.ticketNumber} as no-show?`)) return;
    
    try {
      await api.cancelEntry(operatorData.queue.id, entry.id);
      await refreshQueue();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to mark as no-show');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (entry: QueueEntry) => {
    setDraggedEntry(entry);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetEntry: QueueEntry) => {
    e.preventDefault();
    if (!draggedEntry || draggedEntry.id === targetEntry.id || !operatorData) return;
    
    // Reorder entries
    const waiting = [...operatorData.waiting];
    const draggedIndex = waiting.findIndex(e => e.id === draggedEntry.id);
    const targetIndex = waiting.findIndex(e => e.id === targetEntry.id);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    // Remove dragged item and insert at target position
    waiting.splice(draggedIndex, 1);
    waiting.splice(targetIndex, 0, draggedEntry);
    
    // Update sort order
    const reorderedEntries = waiting.map((entry, index) => ({
      id: entry.id,
      sortOrder: index + 1
    }));

    try {
      await api.reorderQueueEntries(operatorData.queue.id, reorderedEntries);
      await refreshQueue();
    } catch (err) {
      console.error('Failed to reorder', err);
    }
    
    setDraggedEntry(null);
  };

  const handleDragEnd = () => {
    setDraggedEntry(null);
  };

  // Customer identity handlers
  const handleViewCustomer = async (entry: QueueEntry) => {
    setSelectedCustomer(entry);
    setShowCustomerModal(true);
    setIsLoadingIdentity(true);
    
    try {
      // Load user's identity data
      const userData = await api.getUser(entry.user?.id || '');
      setCustomerIdentityData(userData.identityData || {});
      
      // Load available data sources and identity fields config from organization.
      // Never guess an org from a global org list - only load for the
      // logged-in user's own organization.
      if (user?.organizationId) {
        const org = await api.getOrganization(user.organizationId);
        if (org.identityFieldsConfig) {
          setIdentityFieldsConfig(org.identityFieldsConfig as Record<string, { required: boolean; label: string; type?: string }>);
        } else {
          setIdentityFieldsConfig({});
        }

        try {
          const sources = await api.getDataSources(user.organizationId);
          setDataSources(sources.filter((s: any) => s.isActive));
        } catch {
          setDataSources([]);
        }
      } else {
        setIdentityFieldsConfig({});
        setDataSources([]);
      }
    } catch (err) {
      console.error('Failed to load customer data:', err);
      setCustomerIdentityData({});
    } finally {
      setIsLoadingIdentity(false);
    }
  };

  const handleSaveIdentityData = async () => {
    if (!selectedCustomer?.user?.id) return;
    
    setIsSavingIdentity(true);
    try {
      await api.updateUserIdentity(selectedCustomer.user.id, customerIdentityData);
      setShowCustomerModal(false);
      await refreshQueue();
    } catch (err) {
      console.error('Failed to save identity data:', err);
      alert('Failed to save customer data');
    } finally {
      setIsSavingIdentity(false);
    }
  };

  const handleFetchFromDataSource = async (sourceId: string) => {
    if (!selectedCustomer?.user?.phone) {
      alert('Customer phone number is required to fetch data');
      return;
    }
    
    setIsFetchingFromSource(true);
    try {
      const result = await api.fetchFromDataSource(sourceId, {
        identifier: selectedCustomer.user.phone,
        identifierType: 'phone',
      });
      
      if (result.mapped) {
        // Merge fetched data with existing data
        setCustomerIdentityData(prev => ({
          ...prev,
          ...result.mapped,
        }));
      }
    } catch (err: any) {
      console.error('Failed to fetch from data source:', err);
      alert(err.response?.data?.error || 'Failed to fetch data');
    } finally {
      setIsFetchingFromSource(false);
    }
  };

  if (loading && !operatorData) {
    return (
      <Layout>
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading queue...</p>
        </div>
        <style jsx>{`
          .loading-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            color: var(--text-secondary);
          }
          .loading-spinner {
            width: 48px;
            height: 48px;
            border: 4px solid var(--border);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </Layout>
    );
  }

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
      <div className="queue-management">
        {/* Header */}
        <div className="header">
          <div className="header-content">
            <div className="header-left">
              <div className="header-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <h1>Queue Management</h1>
                <p>Manage queues and serve customers</p>
              </div>
            </div>

            <div className="selectors">
              <div className="selector">
                <label>Location</label>
                <select 
                  value={selectedLocation} 
                  onChange={(e) => setSelectedLocation(e.target.value)}
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
              <div className="selector">
                <label>Service</label>
                <select 
                  value={selectedService} 
                  onChange={(e) => setSelectedService(e.target.value)}
                >
                  {services.length === 0 && <option value="">No services</option>}
                  {services.map(svc => (
                    <option key={svc.id} value={svc.id}>{svc.name}</option>
                  ))}
                </select>
              </div>
              <div className="selector service-desk-selector">
                <label>Your Service Desk</label>
                <div className="service-desk-controls">
                  <select 
                    value={selectedInstanceId || selectedServicePoint} 
                    onChange={(e) => {
                      const value = e.target.value;
                      // Check if this is an instance ID
                      const isInstance = servicePointInstances.some(i => i.id === value);
                      if (isInstance) {
                        handleActivateInstance(value);
                      } else {
                        handleActivateDesk(value);
                      }
                    }}
                    className={(selectedInstanceId || selectedServicePoint) ? 'active-desk' : 'no-desk'}
                    disabled={isActivating}
                  >
                    <option value="">Select desk...</option>
                    {/* Prefer database-backed instances */}
                    {servicePointInstances.length > 0 ? (
                      servicePointInstances.map(inst => (
                        <option 
                          key={inst.id} 
                          value={inst.id}
                          disabled={inst.isOccupied && inst.id !== selectedInstanceId}
                        >
                          {inst.displayName || `${inst.servicePointName} ${inst.instanceNumber}`}
                          {inst.isOccupied && inst.id !== selectedInstanceId ? ' (Occupied)' : ''}
                        </option>
                      ))
                    ) : (
                      /* Legacy fallback: use expanded service points */
                      servicePoints.map(sp => (
                        <option 
                          key={sp.id} 
                          value={sp.id}
                          disabled={sp.isOccupied && sp.id !== selectedServicePoint}
                        >
                          {sp.displayName || sp.name}
                          {sp.isOccupied && sp.id !== selectedServicePoint ? ' (Occupied)' : ''}
                        </option>
                      ))
                    )}
                  </select>
                  {(selectedInstanceId || selectedServicePoint) && (
                    <button 
                      className="vacate-btn"
                      onClick={handleVacateDesk}
                      title="Vacate this desk"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Vacate
                    </button>
                  )}
                </div>
                {servicePointInstances.length === 0 && servicePoints.length === 0 && (
                  <span className="desk-hint">No service desks linked to this service</span>
                )}
                {(servicePointInstances.length > 0 || servicePoints.length > 0) && !selectedInstanceId && !selectedServicePoint && (
                  <span className="desk-hint">Select a desk to start serving</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="error-alert">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
            <button onClick={() => setError('')} className="close-btn">×</button>
          </div>
        )}

        {operatorData && (
          <div className="main-content">
            {/* Stats Bar */}
            <div className="stats-bar">
              <div className="stat">
                <span className="stat-value">{operatorData.stats.waiting}</span>
                <span className="stat-label">Waiting</span>
              </div>
              <div className="stat serving">
                <span className="stat-value">{operatorData.stats.serving}</span>
                <span className="stat-label">Serving</span>
              </div>
              <div className="stat">
                <span className="stat-value">{operatorData.stats.total}</span>
                <span className="stat-label">Total Today</span>
              </div>
              <div className="stat-spacer" />
              
              {/* Active Desk Indicator */}
              {(selectedInstanceId || selectedServicePoint) && (
                <div className="active-desk-indicator">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                      <span>{
                        selectedInstanceId 
                          ? (servicePointInstances.find(i => i.id === selectedInstanceId)?.displayName || 
                             `${servicePointInstances.find(i => i.id === selectedInstanceId)?.servicePointName} ${servicePointInstances.find(i => i.id === selectedInstanceId)?.instanceNumber}`)
                          : (servicePoints.find(sp => sp.id === selectedServicePoint)?.displayName || 
                             servicePoints.find(sp => sp.id === selectedServicePoint)?.name || 'Desk')
                      }</span>
                </div>
              )}
              
              <button 
                className={`call-next-btn ${!(selectedInstanceId || selectedServicePoint) ? 'disabled-no-desk' : ''}`}
                onClick={handleCallNext}
                disabled={operatorData.stats.waiting === 0 || !(selectedInstanceId || selectedServicePoint)}
                title={!(selectedInstanceId || selectedServicePoint) ? 'Select a service desk first' : 
                       operatorData.stats.waiting === 0 ? 'No customers waiting' : 'Call next customer'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                Call Next
              </button>
            </div>

            {/* No Desk Warning */}
            {!(selectedInstanceId || selectedServicePoint) && (
              <div className="no-desk-warning">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>Please select a service desk above to start calling customers</span>
              </div>
            )}

            {/* Currently Serving */}
            {operatorData.serving.length > 0 && (
              <div className="section">
                <h2 className="section-title">
                  <span className="pulse-dot" />
                  Now Serving
                </h2>
                <div className="serving-list">
                  {operatorData.serving.map(entry => (
                    <div key={entry.id} className="serving-card">
                      <div className="ticket-number serving-ticket">{entry.ticketNumber}</div>
                      <div className="entry-info">
                        <div className="entry-name">
                          {entry.user?.firstName} {entry.user?.lastName}
                        </div>
                        <div className="entry-details">
                          Called at {entry.calledAt ? new Date(entry.calledAt).toLocaleTimeString() : '-'}
                          {entry.servicePoint && (
                            <span className="service-point-badge">
                              @ {entry.servicePoint.displayName || entry.servicePoint.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="entry-actions">
                        <button 
                          className="action-btn info"
                          onClick={() => handleViewCustomer(entry)}
                          title="View customer details"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                        </button>
                        <button 
                          className="action-btn complete"
                          onClick={() => handleComplete(entry)}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Complete
                        </button>
                        <button 
                          className="action-btn no-show"
                          onClick={() => handleNoShow(entry)}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
                          No-Show
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Waiting Queue */}
            <div className="section">
              <h2 className="section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Waiting Queue
                <span className="drag-hint">Drag to reorder</span>
              </h2>
              
              {operatorData.waiting.length === 0 ? (
                <div className="empty-queue">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                  <p>No one is waiting in the queue</p>
                </div>
              ) : (
                <div className="waiting-list">
                  {operatorData.waiting.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={`waiting-card ${draggedEntry?.id === entry.id ? 'dragging' : ''}`}
                      draggable
                      onDragStart={() => handleDragStart(entry)}
                      onDragOver={(e) => handleDragOver(e)}
                      onDrop={(e) => handleDrop(e, entry)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="drag-handle">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="9" cy="5" r="1" />
                          <circle cx="9" cy="12" r="1" />
                          <circle cx="9" cy="19" r="1" />
                          <circle cx="15" cy="5" r="1" />
                          <circle cx="15" cy="12" r="1" />
                          <circle cx="15" cy="19" r="1" />
                        </svg>
                      </div>
                      <div className="position-badge">{index + 1}</div>
                      <div className="ticket-number">{entry.ticketNumber}</div>
                      <div className="entry-info">
                        <div className="entry-name">
                          {entry.user?.firstName} {entry.user?.lastName}
                        </div>
                        <div className="entry-details">
                          Joined at {new Date(entry.joinedAt).toLocaleTimeString()}
                          {entry.notes && <span className="notes"> • {entry.notes}</span>}
                        </div>
                      </div>
                      {entry.priority > 0 && (
                        <div className="priority-badge">Priority</div>
                      )}
                      <button 
                        className="view-details-btn"
                        onClick={(e) => { e.stopPropagation(); handleViewCustomer(entry); }}
                        title="View customer details"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Next Services */}
            {operatorData.nextServices.length > 0 && (
              <div className="section">
                <h2 className="section-title">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14" />
                    <path d="M12 5l7 7-7 7" />
                  </svg>
                  Patient Flow - Next Services
                </h2>
                <div className="next-services">
                  {operatorData.nextServices.map(ns => (
                    <div key={ns.serviceId} className={`next-service-card ${ns.isRequired ? 'required' : ''}`}>
                      <span className="service-name">{ns.displayName}</span>
                      {ns.isRequired && <span className="required-badge">Required</span>}
                      {ns.autoTransfer && <span className="auto-badge">Auto</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Complete with Next Service Modal */}
        {showCompleteModal && completedEntry && (
          <div className="modal-overlay" onClick={() => setShowCompleteModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h3>Service Completed</h3>
              <p>Patient {completedEntry.user?.firstName} has been served.</p>
              
              {nextServiceSuggestions.length > 0 && (
                <>
                  <p className="modal-subtitle">Would you like to send them to another service?</p>
                  <div className="next-service-options">
                    {nextServiceSuggestions.map(ns => (
                      <button 
                        key={ns.serviceId} 
                        className="next-service-option"
                        onClick={async () => {
                          // TODO: Implement sending to next service
                          setShowCompleteModal(false);
                        }}
                      >
                        <span className="service-name">{ns.displayName}</span>
                        {ns.queueInfo && (
                          <span className="queue-info">
                            {ns.queueInfo.waitingCount} waiting • ~{ns.queueInfo.estimatedWait}min
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
              
              <button className="close-modal" onClick={() => setShowCompleteModal(false)}>
                Done
              </button>
            </div>
          </div>
        )}

        {/* Customer Details Modal */}
        {showCustomerModal && selectedCustomer && (
          <div className="modal-overlay" onClick={() => setShowCustomerModal(false)}>
            <div className="customer-modal" onClick={e => e.stopPropagation()}>
              <div className="customer-modal-header">
                <div className="customer-header-info">
                  <div className="customer-ticket">{selectedCustomer.ticketNumber}</div>
                  <div className="customer-name-header">
                    {selectedCustomer.user?.firstName} {selectedCustomer.user?.lastName}
                  </div>
                </div>
                <button className="close-btn" onClick={() => setShowCustomerModal(false)}>×</button>
              </div>

              <div className="customer-modal-content">
                {isLoadingIdentity ? (
                  <div className="loading-identity">Loading customer data...</div>
                ) : (
                  <>
                    {/* Basic Info */}
                    <div className="identity-section">
                      <h4>Basic Information</h4>
                      <div className="identity-grid">
                        <div className="identity-field">
                          <label>Phone</label>
                          <span>{selectedCustomer.user?.phone || '-'}</span>
                        </div>
                        <div className="identity-field">
                          <label>Email</label>
                          <span>{selectedCustomer.user?.email || '-'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Data Sources */}
                    {dataSources.length > 0 && (
                      <div className="identity-section">
                        <h4>Fetch from Data Source</h4>
                        <div className="data-source-buttons">
                          {dataSources.map(source => (
                            <button
                              key={source.id}
                              className="fetch-btn"
                              onClick={() => handleFetchFromDataSource(source.id)}
                              disabled={isFetchingFromSource}
                            >
                              {isFetchingFromSource ? 'Fetching...' : `Fetch from ${source.name}`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Identity Data Form - Dynamically rendered based on org config */}
                    <div className="identity-section">
                      <h4>Identity Data</h4>
                      {Object.keys(identityFieldsConfig).length === 0 ? (
                        <p className="no-fields-message">
                          No identity fields configured. Configure fields in Admin Settings.
                        </p>
                      ) : (
                        <div className="identity-grid">
                          {Object.entries(identityFieldsConfig).map(([fieldKey, fieldConfig]) => {
                            const inputType = fieldConfig.type || 'text';
                            const isFullWidth = ['address', 'allergies', 'medicalConditions', 'notes'].includes(fieldKey);
                            
                            return (
                              <div 
                                key={fieldKey} 
                                className={`identity-field editable${isFullWidth ? ' full-width' : ''}`}
                              >
                                <label>
                                  {fieldConfig.label}
                                  {fieldConfig.required && <span className="required-marker">*</span>}
                                </label>
                                {fieldKey === 'gender' ? (
                                  <select
                                    value={customerIdentityData[fieldKey] || ''}
                                    onChange={e => setCustomerIdentityData({
                                      ...customerIdentityData, 
                                      [fieldKey]: e.target.value
                                    })}
                                  >
                                    <option value="">Select...</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                  </select>
                                ) : (
                                  <input
                                    type={inputType}
                                    value={customerIdentityData[fieldKey] || ''}
                                    onChange={e => setCustomerIdentityData({
                                      ...customerIdentityData, 
                                      [fieldKey]: e.target.value
                                    })}
                                    placeholder={fieldConfig.label}
                                    required={fieldConfig.required}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="customer-modal-footer">
                <button className="cancel-btn" onClick={() => setShowCustomerModal(false)}>
                  Cancel
                </button>
                <button 
                  className="save-btn" 
                  onClick={handleSaveIdentityData}
                  disabled={isSavingIdentity}
                >
                  {isSavingIdentity ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        <style jsx>{`
          .queue-management {
            max-width: 1200px;
            margin: 0 auto;
          }

          .header {
            background: var(--primary);
            border-radius: 16px;
            padding: 1.5rem 2rem;
            margin-bottom: 1.5rem;
            color: white;
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
            width: 48px;
            height: 48px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .header h1 {
            margin: 0;
            font-size: 1.5rem;
            font-weight: 600;
          }

          .header p {
            margin: 0.25rem 0 0;
            opacity: 0.9;
            font-size: 0.9rem;
          }

          .selectors {
            display: flex;
            gap: 1rem;
            flex-wrap: wrap;
          }

          .selector {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
          }

          .selector label {
            font-size: 0.75rem;
            opacity: 0.9;
          }

          .selector select {
            padding: 0.5rem 1rem;
            font-size: 0.9rem;
            border: none;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.95);
            color: var(--text);
            min-width: 160px;
            cursor: pointer;
          }

          .service-desk-selector {
            min-width: 200px;
          }

          .service-desk-controls {
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }

          .service-desk-controls select {
            flex: 1;
          }

          .service-desk-controls select.active-desk {
            border: 2px solid #10b981;
            background: rgba(16, 185, 129, 0.1);
          }

          .service-desk-controls select.no-desk {
            border: 2px solid rgba(255, 255, 255, 0.3);
          }

          .vacate-btn {
            display: flex;
            align-items: center;
            gap: 0.25rem;
            padding: 0.5rem 0.75rem;
            background: rgba(239, 68, 68, 0.9);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 0.8rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
          }

          .vacate-btn:hover {
            background: #dc2626;
          }

          .desk-hint {
            font-size: 0.7rem;
            opacity: 0.8;
            color: #fbbf24;
          }

          .error-alert {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            background: #fef2f2;
            border-width: 1px;
            border-style: solid;
            border-color: #fecaca;
            color: #dc2626;
            padding: 1rem;
            border-radius: 12px;
            margin-bottom: 1.5rem;
          }

          .close-btn {
            margin-left: auto;
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: inherit;
            padding: 0;
            line-height: 1;
          }

          .stats-bar {
            display: flex;
            align-items: center;
            gap: 2rem;
            background: white;
            padding: 1.25rem 1.5rem;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
            margin-bottom: 1.5rem;
          }

          .stat {
            text-align: center;
          }

          .stat-value {
            display: block;
            font-size: 1.75rem;
            font-weight: 700;
            color: var(--text);
          }

          .stat.serving .stat-value {
            color: #059669;
          }

          .stat-label {
            font-size: 0.85rem;
            color: var(--text-secondary);
          }

          .stat-spacer {
            flex: 1;
          }

          .call-next-btn {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.875rem 1.5rem;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .call-next-btn:hover:not(:disabled) {
            background: var(--primary-dark);
            transform: translateY(-1px);
          }

          .call-next-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .call-next-btn.disabled-no-desk {
            background: #9ca3af;
          }

          .active-desk-indicator {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
            border: 1px solid #10b981;
            border-radius: 8px;
            color: #059669;
            font-weight: 600;
            font-size: 0.9rem;
          }

          .active-desk-indicator svg {
            color: #059669;
          }

          .no-desk-warning {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 1rem 1.25rem;
            background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%);
            border: 1px solid #facc15;
            border-radius: 12px;
            margin-bottom: 1.5rem;
            color: #854d0e;
            font-size: 0.95rem;
          }

          .no-desk-warning svg {
            flex-shrink: 0;
            color: #ca8a04;
          }

          .section {
            background: white;
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
          }

          .section-title {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin: 0 0 1.25rem;
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--text);
          }

          .pulse-dot {
            width: 10px;
            height: 10px;
            background: #059669;
            border-radius: 50%;
            animation: pulse 2s ease-in-out infinite;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }

          .drag-hint {
            margin-left: auto;
            font-size: 0.8rem;
            font-weight: 400;
            color: var(--text-secondary);
          }

          .serving-list {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .serving-card {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 1rem 1.25rem;
            background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
            border-width: 1px;
            border-style: solid;
            border-color: #6ee7b7;
            border-radius: 12px;
          }

          .ticket-number {
            font-size: 1.25rem;
            font-weight: 700;
            color: var(--primary);
            min-width: 70px;
          }

          .serving-ticket {
            color: #059669;
          }

          .entry-info {
            flex: 1;
          }

          .entry-name {
            font-weight: 600;
            color: var(--text);
          }

          .entry-details {
            font-size: 0.85rem;
            color: var(--text-secondary);
            margin-top: 0.25rem;
          }

          .service-point-badge {
            display: inline-block;
            margin-left: 0.5rem;
            padding: 0.125rem 0.5rem;
            background: rgba(5, 150, 105, 0.1);
            color: #059669;
            border-radius: 4px;
            font-size: 0.8rem;
          }

          .entry-actions {
            display: flex;
            gap: 0.5rem;
          }

          .action-btn {
            display: flex;
            align-items: center;
            gap: 0.375rem;
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 8px;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }

          .action-btn.complete {
            background: #059669;
            color: white;
          }

          .action-btn.complete:hover {
            background: #047857;
          }

          .action-btn.no-show {
            background: #f3f4f6;
            color: var(--text-secondary);
          }

          .action-btn.no-show:hover {
            background: #fee2e2;
            color: #dc2626;
          }

          .empty-queue {
            text-align: center;
            padding: 3rem 2rem;
            color: var(--text-secondary);
          }

          .empty-queue svg {
            margin-bottom: 1rem;
            opacity: 0.5;
          }

          .waiting-list {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .waiting-card {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.875rem 1rem;
            background: #f8fafc;
            border-width: 1px;
            border-style: solid;
            border-color: var(--border);
            border-radius: 10px;
            cursor: grab;
            transition: all 0.2s;
          }

          .waiting-card:hover {
            background: #f1f5f9;
            border-color: var(--primary);
          }

          .waiting-card.dragging {
            opacity: 0.5;
            background: rgba(20, 184, 166, 0.12);
          }

          .drag-handle {
            color: var(--text-secondary);
            opacity: 0.5;
          }

          .position-badge {
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--primary);
            color: white;
            font-size: 0.85rem;
            font-weight: 600;
            border-radius: 50%;
          }

          .priority-badge {
            padding: 0.25rem 0.5rem;
            background: #fef3c7;
            color: #d97706;
            font-size: 0.75rem;
            font-weight: 600;
            border-radius: 4px;
          }

          .notes {
            font-style: italic;
          }

          .next-services {
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
          }

          .next-service-card {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1rem;
            background: #f8fafc;
            border-width: 1px;
            border-style: solid;
            border-color: var(--border);
            border-radius: 8px;
          }

          .next-service-card.required {
            border-color: #f59e0b;
            background: #fffbeb;
          }

          .service-name {
            font-weight: 500;
          }

          .required-badge,
          .auto-badge {
            font-size: 0.7rem;
            padding: 0.125rem 0.375rem;
            border-radius: 4px;
            font-weight: 600;
          }

          .required-badge {
            background: #fef3c7;
            color: #d97706;
          }

          .auto-badge {
            background: #dbeafe;
            color: #2563eb;
          }

          /* Modal */
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }

          .modal {
            background: white;
            padding: 2rem;
            border-radius: 16px;
            max-width: 400px;
            width: 90%;
          }

          .modal h3 {
            margin: 0 0 0.5rem;
          }

          .modal p {
            color: var(--text-secondary);
            margin: 0 0 1rem;
          }

          .modal-subtitle {
            font-weight: 500;
            color: var(--text) !important;
          }

          .next-service-options {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            margin-bottom: 1.5rem;
          }

          .next-service-option {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            padding: 1rem;
            background: #f8fafc;
            border-width: 1px;
            border-style: solid;
            border-color: var(--border);
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s;
            text-align: left;
          }

          .next-service-option:hover {
            background: var(--primary);
            color: white;
            border-color: var(--primary);
          }

          .queue-info {
            font-size: 0.8rem;
            opacity: 0.8;
            margin-top: 0.25rem;
          }

          .close-modal {
            width: 100%;
            padding: 0.75rem;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
          }

          /* Customer Modal Styles */
          .customer-modal {
            background: white;
            border-radius: 16px;
            width: 100%;
            max-width: 600px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          }

          .customer-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem;
            background: var(--primary);
            color: white;
            border-radius: 16px 16px 0 0;
          }

          .customer-header-info {
            display: flex;
            align-items: center;
            gap: 1rem;
          }

          .customer-ticket {
            font-size: 1.5rem;
            font-weight: 800;
            background: rgba(255, 255, 255, 0.2);
            padding: 0.5rem 1rem;
            border-radius: 8px;
          }

          .customer-name-header {
            font-size: 1.25rem;
            font-weight: 600;
          }

          .close-btn {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            font-size: 1.5rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .customer-modal-content {
            padding: 1.5rem;
          }

          .loading-identity {
            text-align: center;
            padding: 2rem;
            color: var(--text-secondary);
          }

          .identity-section {
            margin-bottom: 1.5rem;
          }

          .identity-section h4 {
            margin: 0 0 1rem;
            font-size: 1rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .identity-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
          }

          .identity-field {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
          }

          .identity-field.full-width {
            grid-column: span 2;
          }

          .identity-field label {
            font-size: 0.85rem;
            color: var(--text-secondary);
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 0.25rem;
          }

          .identity-field span {
            font-size: 1rem;
            color: var(--text);
          }

          .identity-field .required-marker {
            color: #dc2626;
            font-size: 0.9rem;
          }

          .identity-field.editable input,
          .identity-field.editable select {
            padding: 0.5rem 0.75rem;
            border: 1px solid var(--border);
            border-radius: 8px;
            font-size: 0.95rem;
          }

          .identity-field.editable input:focus,
          .identity-field.editable select:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.15);
          }

          .no-fields-message {
            text-align: center;
            color: var(--text-secondary);
            padding: 1rem;
            background: var(--surface);
            border-radius: 8px;
            font-size: 0.9rem;
          }

          .data-source-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
          }

          .fetch-btn {
            padding: 0.5rem 1rem;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.2s;
          }

          .fetch-btn:hover {
            background: var(--primary);
            color: white;
            border-color: var(--primary);
          }

          .fetch-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .customer-modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 1rem;
            padding: 1rem 1.5rem;
            border-top: 1px solid var(--border);
          }

          .cancel-btn {
            padding: 0.75rem 1.5rem;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 8px;
            font-size: 1rem;
            cursor: pointer;
          }

          .save-btn {
            padding: 0.75rem 1.5rem;
            background: var(--primary);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
          }

          .save-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .action-btn.info {
            background: rgba(59, 130, 246, 0.1);
            color: #3b82f6;
          }

          .action-btn.info:hover {
            background: rgba(59, 130, 246, 0.2);
          }

          .view-details-btn {
            padding: 0.5rem;
            background: rgba(20, 184, 166, 0.1);
            border: none;
            border-radius: 8px;
            color: var(--primary);
            cursor: pointer;
            transition: all 0.2s;
            flex-shrink: 0;
          }

          .view-details-btn:hover {
            background: rgba(20, 184, 166, 0.2);
          }

          @media (max-width: 768px) {
            .header-content {
              flex-direction: column;
              align-items: stretch;
            }

            .selectors {
              flex-direction: column;
            }

            .stats-bar {
              flex-wrap: wrap;
              gap: 1rem;
            }

            .stat-spacer {
              display: none;
            }

            .call-next-btn {
              width: 100%;
              justify-content: center;
            }

            .serving-card {
              flex-wrap: wrap;
            }

            .entry-actions {
              width: 100%;
              justify-content: flex-end;
            }
          }
        `}</style>
      </div>
    </Layout>
  );
};

export default QueueManagementPage;
