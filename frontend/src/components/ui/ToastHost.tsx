'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { ToastEvent } from '@/lib/toast';

export default function ToastHost() {
  const [items, setItems] = useState<ToastEvent[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const t = (e as CustomEvent<ToastEvent>).detail;
      setItems((list) => [...list.slice(-2), t]);
      setTimeout(() => setItems((list) => list.filter((x) => x.id !== t.id)), t.tone === 'error' ? 7000 : 4000);
    };
    window.addEventListener('qms-toast', onToast);
    return () => window.removeEventListener('qms-toast', onToast);
  }, []);

  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="toast" data-tone={t.tone} role={t.tone === 'error' ? 'alert' : 'status'}>
          <span>{t.message}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setItems((list) => list.filter((x) => x.id !== t.id))}><X size={15} /></button>
        </div>
      ))}
    </div>
  );
}
