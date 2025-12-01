'use client';

import React, { useEffect, useState } from 'react';
import api from '@/api/client';
import { useAuthContext } from '@/contexts/AuthContext';

export default function AdminLocationsPage() {
  const { isAdmin } = useAuthContext();
  const [orgs, setOrgs] = useState<any[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (isAdmin) loadOrgs(); else setLoading(false); }, [isAdmin]);

  const loadOrgs = async () => {
    setLoading(true);
    try {
      const data = await api.getOrganizations();
      setOrgs(data);
      if (data.length) setOrgId(data[0].id);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (orgId) loadLocations(orgId); }, [orgId]);

  const loadLocations = async (orgId: string) => {
    setLoading(true);
    try {
      const data = await api.getLocations(orgId);
      setLocations(data);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  const handleSavePublicCode = async (locId: string, code: string | null) => {
    try {
      await api.updateLocation(locId, { publicCode: code });
      loadLocations(orgId!);
    } catch (err) { alert('Failed to update public code'); }
  };

  if (!isAdmin) return <div style={{ padding: 20 }}>Admins only</div>;

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontWeight: 700 }}>Manage Locations (Admin)</h1>
      <p style={{ color: '#6b7280' }}>Assign public join codes to locations so customers can join by code.</p>

      <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center' }}>
        <label>Organization</label>
        <select value={orgId ?? ''} onChange={(e) => setOrgId(e.target.value)}>
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>

      <div style={{ marginTop: 12 }}>
        {locations.map(loc => (
          <div key={loc.id} style={{ padding: 12, border: '1px solid #eee', borderRadius: 8, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{loc.name}</div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>{loc.address}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input defaultValue={loc.publicCode ?? ''} placeholder="Public code (eg: ABC123)" id={`code-${loc.id}`} />
              <button onClick={() => { const el = document.getElementById(`code-${loc.id}`) as HTMLInputElement; handleSavePublicCode(loc.id, el.value || null); }} style={{ padding: '0.5rem 0.75rem', background: '#6366f1', color: 'white', borderRadius: 6 }}>Save</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
