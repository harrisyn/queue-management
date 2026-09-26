'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import api, { WaitAlert } from '@/api/client';

const POLL_MS = 60_000;

/** Live wait-spike alerts for a location (statistical, see ai/forecast.ts). */
export default function WaitAlerts({ locationId }: { locationId: string }) {
  const [alerts, setAlerts] = useState<WaitAlert[]>([]);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = () => api.getWaitAlerts(locationId).then((a) => !cancelled && setAlerts(a)).catch(() => {});
    load();
    const timer = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [locationId]);

  if (alerts.length === 0) return null;

  return (
    <div className="stack" style={{ gap: '0.5rem', marginBottom: '1rem' }} role="status">
      {alerts.map((a) => (
        <div key={a.serviceId + a.severity} className={`inline-alert ${a.severity === 'info' ? 'inline-alert-info' : 'inline-alert-error'}`}>
          {a.severity === 'info' ? <Info size={18} /> : <AlertTriangle size={18} />}
          <span><strong>{a.service}:</strong> {a.message}</span>
        </div>
      ))}
    </div>
  );
}
