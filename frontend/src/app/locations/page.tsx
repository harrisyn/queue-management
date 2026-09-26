'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { API_BASE } from '@/lib/apiBase';
import styles from '../join/[code]/join.module.css';

/**
 * This organization's locations, for people who arrive without a QR code.
 * With one location there's nothing to choose, so it goes straight there.
 */

type LocationItem = {
  id: string;
  name: string;
  publicCode?: string | null;
  organization: { id: string; name: string } | null;
  _count?: { services?: number };
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<LocationItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/public/locations`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: LocationItem[]) => {
        const joinable = data.filter((l) => l.publicCode);
        if (joinable.length === 1) {
          window.location.replace(`/join/${joinable[0].publicCode}`);
          return;
        }
        setLocations(joinable);
      })
      .catch(() => setFailed(true));
  }, []);

  const orgName = locations?.[0]?.organization?.name;

  return (
    <div className={styles.page}>
      <main className={styles.shell}>
        {orgName && <header className={styles.brand}><strong>{orgName}</strong></header>}
        {failed ? (
          <div className={styles.card}>
            <h1 className={styles.title}>Something went wrong</h1>
            <p className={styles.lede}>Refresh to try again, or scan the QR code at the entrance.</p>
          </div>
        ) : locations === null ? (
          <div className={styles.center}><span className={styles.spinner} aria-label="Loading" /></div>
        ) : locations.length === 0 ? (
          <div className={styles.card}>
            <h1 className={styles.title}>Scan the code where you are</h1>
            <p className={styles.lede}>Each location has its own QR code at the entrance or desk. Scan it to join that queue.</p>
          </div>
        ) : (
          <>
            <div className={styles.intro}>
              <h1 className={styles.title}>Which location?</h1>
              <p className={styles.lede}>Choose where you are to join the queue there.</p>
            </div>
            <ul className={styles.services}>
              {locations.map((loc) => (
                <li key={loc.id}>
                  <Link className={styles.service} href={`/join/${loc.publicCode}`}>
                    <span>
                      <strong>{loc.name}</strong>
                      <small>{loc._count?.services ?? 0} {(loc._count?.services ?? 0) === 1 ? 'service' : 'services'}</small>
                    </span>
                    <ChevronRight size={22} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
