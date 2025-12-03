'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/api/client';

interface Service {
  id: string;
  name: string;
  description?: string;
  type: 'INDIVIDUAL' | 'GENERAL';
  slotDuration: number;
  requiresName: boolean;
  requiresPhone: boolean;
  allowAnonymous: boolean;
  estimatedWait?: number;
  currentQueueLength?: number;
}

interface TicketResult {
  entryId: string;
  queueId: string;
  ticketNumber: string;
  position: number;
  estimatedWait: number;
  serviceName: string;
}

export default function ServicesPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const locationId = params.locationId as string;

  const [services, setServices] = useState<Service[]>([]);
  const [locationName, setLocationName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Join queue modal state
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState<TicketResult | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const data = await api.getPublicLocationServices(orgId, locationId);
        setServices(data.services || []);
        setLocationName(data.locationName || '');
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load services');
      } finally {
        setLoading(false);
      }
    };

    if (orgId && locationId) {
      fetchServices();
    }
  }, [orgId, locationId]);

  const handleServiceClick = (service: Service) => {
    // If anonymous is allowed and nothing required, get ticket immediately
    if (service.allowAnonymous && !service.requiresName && !service.requiresPhone) {
      submitJoinQueue(service, { name: 'Anonymous', phone: '', notes: '' });
    } else {
      setSelectedService(service);
      setFormData({ name: '', phone: '', notes: '' });
    }
  };

  const submitJoinQueue = async (service: Service, data: { name: string; phone: string; notes: string }) => {
    setSubmitting(true);
    try {
      const result = await api.publicJoinQueue({
        serviceId: service.id,
        name: data.name || 'Anonymous',
        phone: data.phone || undefined,
        notes: data.notes || undefined,
      });
      setTicket({
        entryId: result.entryId,
        queueId: result.queueId,
        ticketNumber: result.ticketNumber,
        position: result.position,
        estimatedWait: result.estimatedWait,
        serviceName: service.name,
      });
      setSelectedService(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to join queue');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;

    // Validate required fields
    if (selectedService.requiresName && !formData.name.trim()) {
      alert('Name is required');
      return;
    }
    if (selectedService.requiresPhone && !formData.phone.trim()) {
      alert('Phone number is required');
      return;
    }

    submitJoinQueue(selectedService, formData);
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingCard}>
          <div className="spinner" style={{ margin: '0 auto', width: '48px', height: '48px' }} />
          <p style={{ marginTop: '1rem', color: '#64748b', fontSize: '1.1rem' }}>Loading services...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.errorCard}>
          <span style={{ fontSize: '4rem' }}>⚠️</span>
          <h2 style={{ color: '#1e293b', marginTop: '1rem' }}>Error</h2>
          <p style={{ color: '#64748b' }}>{error}</p>
          <button
            onClick={() => router.push(`/${orgId}`)}
            style={styles.backButton}
          >
            ← Back to Locations
          </button>
        </div>
      </div>
    );
  }

  // Ticket success view
  if (ticket) {
    return (
      <div style={styles.ticketContainer}>
        <div style={styles.ticketCard}>
          <div style={styles.ticketHeader}>
            <span style={{ fontSize: '4rem' }}>🎫</span>
            <h1 style={styles.ticketTitle}>Your Ticket</h1>
          </div>

          <div style={styles.ticketNumber}>
            {ticket.ticketNumber}
          </div>

          <div style={styles.ticketInfo}>
            <div style={styles.ticketInfoRow}>
              <span style={styles.ticketLabel}>Service</span>
              <span style={styles.ticketValue}>{ticket.serviceName}</span>
            </div>
            <div style={styles.ticketInfoRow}>
              <span style={styles.ticketLabel}>Position</span>
              <span style={styles.ticketValue}>#{ticket.position}</span>
            </div>
            <div style={styles.ticketInfoRow}>
              <span style={styles.ticketLabel}>Est. Wait</span>
              <span style={styles.ticketValue}>{ticket.estimatedWait} min</span>
            </div>
          </div>

          <div style={styles.ticketActions}>
            <button
              onClick={() => router.push(`/status/${ticket.queueId}/${ticket.entryId}`)}
              style={styles.trackButton}
            >
              📍 Track My Position
            </button>
            <button
              onClick={() => setTicket(null)}
              style={styles.newTicketButton}
            >
              Get Another Ticket
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button
          onClick={() => router.push(`/${orgId}`)}
          style={styles.backLink}
        >
          ← Back
        </button>
        <h1 style={styles.title}>
          📍 {locationName || 'Select a Service'}
        </h1>
        <p style={styles.subtitle}>
          Tap a service to get your ticket
        </p>
      </div>

      {/* Services Grid */}
      <div style={styles.servicesGrid}>
        {services.map((service) => (
          <button
            key={service.id}
            onClick={() => handleServiceClick(service)}
            style={styles.serviceCard}
            onTouchStart={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)';
            }}
            onTouchEnd={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
            }}
          >
            <div style={styles.serviceIcon}>
              {service.type === 'INDIVIDUAL' ? '👤' : '👥'}
            </div>
            <h3 style={styles.serviceName}>{service.name}</h3>
            {service.description && (
              <p style={styles.serviceDescription}>{service.description}</p>
            )}
            <div style={styles.serviceStats}>
              {service.currentQueueLength !== undefined && (
                <span style={styles.statBadge}>
                  {service.currentQueueLength} in queue
                </span>
              )}
              {service.estimatedWait !== undefined && (
                <span style={styles.statBadge}>
                  ~{service.estimatedWait} min wait
                </span>
              )}
            </div>
            <div style={styles.tapIndicator}>
              Tap to get ticket →
            </div>
          </button>
        ))}
      </div>

      {services.length === 0 && (
        <div style={styles.emptyState}>
          <span style={{ fontSize: '4rem' }}>🏥</span>
          <h3 style={{ color: '#1e293b', marginTop: '1rem' }}>No Services Available</h3>
          <p style={{ color: '#64748b' }}>
            This location has no active services at the moment.
          </p>
        </div>
      )}

      {/* Join Queue Modal */}
      {selectedService && (
        <div style={styles.modalOverlay} onClick={() => setSelectedService(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedService(null)}
              style={styles.modalClose}
            >
              ✕
            </button>
            
            <h2 style={styles.modalTitle}>
              📝 Join Queue
            </h2>
            <p style={styles.modalSubtitle}>
              {selectedService.name}
            </p>

            <form onSubmit={handleSubmit}>
              {(selectedService.requiresName || !selectedService.allowAnonymous) && (
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    Name {selectedService.requiresName && '*'}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter your name"
                    style={styles.formInput}
                    required={selectedService.requiresName}
                  />
                </div>
              )}

              {selectedService.requiresPhone && (
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Enter your phone number"
                    style={styles.formInput}
                    required
                  />
                </div>
              )}

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>
                  Notes (optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional information..."
                  style={{ ...styles.formInput, height: '80px', resize: 'none' } as React.CSSProperties}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={submitting ? styles.submitButtonDisabled : styles.submitButton}
              >
                {submitting ? 'Getting Ticket...' : '🎫 Get Ticket'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)',
    padding: '1rem',
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  loadingCard: {
    background: 'white',
    borderRadius: '24px',
    padding: '3rem',
    textAlign: 'center' as const,
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  errorCard: {
    background: 'white',
    borderRadius: '24px',
    padding: '3rem',
    textAlign: 'center' as const,
    maxWidth: '400px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  backButton: {
    marginTop: '1.5rem',
    padding: '0.75rem 1.5rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '2rem',
    paddingTop: '1rem',
  },
  backLink: {
    background: 'none',
    border: 'none',
    color: '#667eea',
    fontSize: '1rem',
    cursor: 'pointer',
    marginBottom: '1rem',
    display: 'block',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: '#64748b',
    fontSize: '1.1rem',
  },
  servicesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1.5rem',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  serviceCard: {
    background: 'white',
    borderRadius: '20px',
    padding: '1.5rem',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left' as const,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.2s ease',
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: '200px',
  },
  serviceIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.75rem',
    marginBottom: '1rem',
  },
  serviceName: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: '0.5rem',
  },
  serviceDescription: {
    color: '#64748b',
    fontSize: '0.9rem',
    marginBottom: '1rem',
    flex: 1,
  },
  serviceStats: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap' as const,
    marginBottom: '0.75rem',
  },
  statBadge: {
    background: '#f1f5f9',
    color: '#475569',
    padding: '0.25rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.8rem',
  },
  tapIndicator: {
    color: '#667eea',
    fontWeight: '600',
    fontSize: '0.9rem',
    marginTop: 'auto',
  },
  emptyState: {
    textAlign: 'center' as const,
    background: 'white',
    borderRadius: '24px',
    padding: '3rem',
    marginTop: '2rem',
  },
  // Ticket success styles
  ticketContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    padding: '1rem',
  },
  ticketCard: {
    background: 'white',
    borderRadius: '24px',
    padding: '2.5rem',
    textAlign: 'center' as const,
    maxWidth: '400px',
    width: '100%',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  ticketHeader: {
    marginBottom: '1.5rem',
  },
  ticketTitle: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: '0.5rem',
  },
  ticketNumber: {
    fontSize: '4rem',
    fontWeight: 'bold',
    color: '#10b981',
    background: '#ecfdf5',
    borderRadius: '16px',
    padding: '1rem',
    marginBottom: '1.5rem',
    fontFamily: 'monospace',
  },
  ticketInfo: {
    background: '#f8fafc',
    borderRadius: '12px',
    padding: '1rem',
    marginBottom: '1.5rem',
  },
  ticketInfoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.5rem 0',
    borderBottom: '1px solid #e2e8f0',
  },
  ticketLabel: {
    color: '#64748b',
  },
  ticketValue: {
    fontWeight: '600',
    color: '#1e293b',
  },
  ticketActions: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  trackButton: {
    width: '100%',
    padding: '1rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1.1rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  newTicketButton: {
    width: '100%',
    padding: '0.875rem',
    background: '#f1f5f9',
    color: '#475569',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: '500',
    cursor: 'pointer',
  },
  // Modal styles
  modalOverlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    zIndex: 1000,
  },
  modal: {
    background: 'white',
    borderRadius: '24px',
    padding: '2rem',
    maxWidth: '400px',
    width: '100%',
    position: 'relative' as const,
    maxHeight: '90vh',
    overflow: 'auto',
  },
  modalClose: {
    position: 'absolute' as const,
    top: '1rem',
    right: '1rem',
    background: '#f1f5f9',
    border: 'none',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    fontSize: '1rem',
    cursor: 'pointer',
    color: '#64748b',
  },
  modalTitle: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: '0.25rem',
  },
  modalSubtitle: {
    color: '#667eea',
    fontWeight: '500',
    marginBottom: '1.5rem',
  },
  formGroup: {
    marginBottom: '1rem',
  },
  formLabel: {
    display: 'block',
    marginBottom: '0.25rem',
    color: '#374151',
    fontSize: '0.9rem',
    fontWeight: '500',
  },
  formInput: {
    width: '100%',
    padding: '0.875rem',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: '#e2e8f0',
    borderRadius: '12px',
    fontSize: '1rem',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s',
  },
  submitButton: {
    width: '100%',
    padding: '1rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1.1rem',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  submitButtonDisabled: {
    width: '100%',
    padding: '1rem',
    background: '#9ca3af',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1.1rem',
    fontWeight: '600',
    cursor: 'not-allowed',
    marginTop: '0.5rem',
  },
};
