'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/api/client';

interface Location {
  id: string;
  name: string;
  address?: string;
  publicCode?: string;
}

interface Organization {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  locations: Location[];
}

export default function OrganizationPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        const data = await api.getPublicOrganization(orgId);
        setOrganization(data);
        
        // If only one location, auto-redirect to services page
        if (data.locations?.length === 1) {
          router.push(`/${orgId}/${data.locations[0].id}/services`);
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Organization not found');
      } finally {
        setLoading(false);
      }
    };

    if (orgId) {
      fetchOrganization();
    }
  }, [orgId, router]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '3rem',
          textAlign: 'center',
        }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading organization...</p>
        </div>
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '3rem',
          textAlign: 'center',
          maxWidth: '400px',
        }}>
          <span style={{ fontSize: '3rem' }}>🔍</span>
          <h2 style={{ color: '#1e293b', marginTop: '1rem' }}>Organization Not Found</h2>
          <p style={{ color: '#64748b' }}>{error || 'This organization does not exist.'}</p>
          <a 
            href="/"
            style={{
              display: 'inline-block',
              marginTop: '1.5rem',
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: '500',
            }}
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2rem',
          textAlign: 'center',
          marginBottom: '2rem',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
        }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#1e293b',
            marginBottom: '0.5rem',
          }}>
            🏥 {organization.name}
          </h1>
          <p style={{ color: '#64748b' }}>
            Select a location to view available services
          </p>
        </div>

        {/* Locations Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1.5rem',
        }}>
          {organization.locations.map((location) => (
            <div
              key={location.id}
              onClick={() => router.push(`/${orgId}/${location.id}/services`)}
              style={{
                background: 'white',
                borderRadius: '16px',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.15)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
              }}
            >
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}>
                <span style={{ fontSize: '1.5rem' }}>📍</span>
              </div>
              
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#1e293b',
                marginBottom: '0.5rem',
              }}>
                {location.name}
              </h3>
              
              {location.address && (
                <p style={{
                  color: '#64748b',
                  fontSize: '0.9rem',
                  marginBottom: '1rem',
                }}>
                  {location.address}
                </p>
              )}
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                color: '#667eea',
                fontWeight: '500',
                fontSize: '0.9rem',
              }}>
                View Services
                <span style={{ marginLeft: '0.5rem' }}>→</span>
              </div>
            </div>
          ))}
        </div>

        {organization.locations.length === 0 && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '3rem',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: '3rem' }}>🏢</span>
            <h3 style={{ color: '#1e293b', marginTop: '1rem' }}>No Locations Available</h3>
            <p style={{ color: '#64748b' }}>
              This organization has not set up any locations yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
