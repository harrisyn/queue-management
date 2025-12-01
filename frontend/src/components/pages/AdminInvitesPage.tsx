'use client';

import React, { useEffect, useState } from 'react';
import api from '@/api/client';
import { useAuthContext } from '@/contexts/AuthContext';

type Invite = {
  id: string;
  code: string;
  role: string;
  organizationId?: string | null;
  used: boolean;
  expiresAt?: string | null;
  createdAt: string;
  createdBy?: string | null;
};

const AdminInvitesPage: React.FC = () => {
  const { isAdmin } = useAuthContext();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('SERVICE_STAFF');
  const [expiresAt, setExpiresAt] = useState('');

  useEffect(() => { if (isAdmin) loadInvites(); else setLoading(false); }, [isAdmin]);

  const loadInvites = async () => {
    setLoading(true);
    try { const data = await api.getInvites(); setInvites(data); } catch { /*ignore*/ } finally { setLoading(false); }
  };

  const handleCreate = async () => {
    try {
      const payload: any = { role };
      if (expiresAt) payload.expiresAt = expiresAt;
      const res = await api.createInvite(payload);
      setInvites(prev => [res.invite, ...prev]);
    } catch (err) { alert('Failed to create invite'); }
  };

  if (!isAdmin) return <div style={{ padding: 20 }}>Admins only</div>;

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1 style={{ fontWeight: 700 }}>Invites</h1>
      <p style={{ color: '#6b7280' }}>Create invite codes for operator accounts.</p>

      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <select value={role} onChange={(e) => setRole(e.target.value)} style={{ padding: 8 }}>
          <option value="SERVICE_STAFF">Service Staff</option>
          <option value="RECEPTIONIST">Receptionist</option>
          <option value="LOCATION_ADMIN">Location Admin</option>
          <option value="ORG_ADMIN">Organization Admin</option>
        </select>
        <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        <button onClick={handleCreate} style={{ background: '#6366f1', color: 'white', padding: '0.5rem 1rem', borderRadius: 8 }}>Create Invite</button>
      </div>

      <div style={{ marginTop: 18 }}>
        {loading ? <div>Loading invites…</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
                <th>Code</th><th>Role</th><th>Used</th><th>Expires</th><th>Created</th>
              </tr>
            </thead>
            <tbody>
              {invites.map(i => (
                <tr key={i.id} style={{ borderBottom: '1px solid #fafafa' }}>
                  <td style={{ padding: '0.5rem 0' }}><code>{i.code}</code></td>
                  <td>{i.role}</td>
                  <td>{i.used ? 'Yes' : 'No'}</td>
                  <td>{i.expiresAt ? new Date(i.expiresAt).toLocaleString() : '-'}</td>
                  <td>{new Date(i.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminInvitesPage;
