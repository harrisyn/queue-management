'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_BASE } from '@/lib/apiBase';

type LocationItem = {
  id: string;
  name: string;
  publicCode?: string | null;
  organization: { id: string; name: string } | null;
  _count?: { services?: number };
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch(`${API_BASE}/public/locations`);
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        setLocations(data);
      } catch (err) {
        setError('Failed to load locations');
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, []);

  if (loading) return <div style={{ padding: 20 }}>Loading locations…</div>;
  if (error) return <div style={{ padding: 20 }}>{error}</div>;

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Public Locations</h1>
      <p style={{ color: '#6b7280' }}>Find a location and use the public join code to join a queue (no account required)</p>

      <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
        {locations.length === 0 && <div>No public locations configured.</div>}
        {locations.map((loc) => (
          <div key={loc.id} style={{ padding: '1rem', background: '#ffffff', borderRadius: 8, border: '1px solid #eee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{loc.name}</div>
                <div style={{ color: '#6b7280', fontSize: 13 }}>{loc.organization?.name}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {loc.publicCode ? (
                  <Link href={`/join/${loc.publicCode}`} style={{ display: 'inline-block', padding: '0.5rem 1rem', background: '#14b8a6', color: 'white', borderRadius: 8 }}>Join</Link>
                ) : (
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>No join code</span>
                )}
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>{loc._count?.services ?? 0} services</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
