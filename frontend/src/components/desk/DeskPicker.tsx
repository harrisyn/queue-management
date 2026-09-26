'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DoorOpen, Loader2 } from 'lucide-react';
import api from '@/api/client';
import { useAuthContext } from '@/contexts/AuthContext';
import type { Desk, DeskInstance } from './useDesk';
import { deskLabel } from './useDesk';

interface LocationRow { id: string; name: string }

/** "Where are you working today?" Desks grouped by service. */
export default function DeskPicker({ desk, compact = false }: { desk: Desk; compact?: boolean }) {
  const { user, isAdmin } = useAuthContext();
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState('');
  const [instances, setInstances] = useState<DeskInstance[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (!user?.organizationId) return;
    api.getLocations(user.organizationId).then((locs: LocationRow[]) => {
      setLocations(locs);
      const saved = typeof window !== 'undefined' ? localStorage.getItem('qms_operator_location') : null;
      setLocationId((locs.find((l) => l.id === saved) || locs[0])?.id || '');
      if (!locs.length) setInstances([]);
    }).catch(() => setInstances([]));
  }, [user?.organizationId]);

  const load = (id: string) => {
    setInstances(null);
    api.getLocationInstances(id).then(setInstances).catch(() => setInstances([]));
  };

  useEffect(() => {
    if (!locationId) return;
    try { localStorage.setItem('qms_operator_location', locationId); } catch { /* private mode */ }
    load(locationId);
  }, [locationId]);

  const groups = useMemo(() => {
    const byService = new Map<string, { name: string; items: DeskInstance[] }>();
    (instances || []).forEach((inst) => {
      if (!inst.currentService) return;
      const g = byService.get(inst.currentService.id) || { name: inst.currentService.name, items: [] };
      g.items.push(inst);
      byService.set(inst.currentService.id, g);
    });
    return [...byService.values()];
  }, [instances]);

  const choose = async (inst: DeskInstance) => {
    setProblem('');
    const taken = inst.isOccupied && inst.occupiedBy && inst.occupiedBy.id !== user?.id;
    if (taken && !window.confirm(`${inst.occupiedBy!.firstName} ${inst.occupiedBy!.lastName} is signed in to ${deskLabel(inst)}. Take over this desk?`)) return;
    setPending(inst.id);
    try {
      await desk.signIn(inst, locationId, !!taken);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setProblem(e?.response?.data?.error || 'That desk is in use.');
      load(locationId);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="desk-picker" data-compact={compact}>
      <div className="desk-picker-head">
        <h2>Where are you working?</h2>
        {locations.length > 1 && (
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)} aria-label="Location">
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
      </div>

      {instances === null ? (
        <div className="desk-picker-loading"><Loader2 className="qf-spin" size={20} /> Loading desks…</div>
      ) : groups.length === 0 ? (
        <div className="desk-picker-empty">
          <DoorOpen size={22} />
          <p>No desks or rooms are set up here yet.{isAdmin && <> <Link href="/admin/service-points">Add one</Link> to start calling.</>}</p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.name} className="desk-picker-group">
            <h3>{g.name}</h3>
            <div className="desk-picker-grid">
              {g.items.map((inst) => {
                const mineAlready = inst.occupiedBy?.id === user?.id;
                const taken = inst.isOccupied && !mineAlready;
                return (
                  <button key={inst.id} type="button" className="desk-option" data-taken={taken} onClick={() => choose(inst)} disabled={!!pending}>
                    <strong>{deskLabel(inst)}</strong>
                    <small>
                      {pending === inst.id ? 'Signing in…'
                        : mineAlready ? 'You were here'
                        : taken ? `${inst.occupiedBy?.firstName ?? 'Someone'} is here`
                        : 'Free'}
                    </small>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}
      {(problem || desk.error) && <p className="desk-msg desk-msg-bad" role="alert">{problem || desk.error}</p>}
    </div>
  );
}
