'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '@/api/client';
import Layout from '@/components/Layout';
import { PageHeader } from '@/components/ui';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTerms } from '@/hooks/useTerms';
import AiInsightsPanel from '@/components/ai/AiInsightsPanel';

/**
 * How a location is doing over a period: waits, service times, no-shows,
 * busiest hours and journeys between services.
 */

interface LocationRow { id: string; name: string }

interface ServiceMetric {
  serviceId: string;
  serviceName: string;
  counts: { total: number; served: number; waiting: number; serving: number; noShows: number; cancelled: number };
  waitTime: { average: number; longest: number };
  serviceTime: { average: number };
  turnaroundTime: { average: number };
  completionRate: number;
  noShowRate: number;
}

interface Detailed {
  services: ServiceMetric[];
  totals: { total: number; served: number; waiting: number; serving: number; noShows: number };
}

interface Journeys {
  summary: {
    totalJourneys: number;
    completedJourneys: number;
    multiServiceJourneys: number;
    avgJourneyDuration: number;
    totalTransfers: number;
  };
}

interface HourBucket { hour: number; count: number }

const PERIODS = [
  { id: 'today', label: 'Today', days: 0 },
  { id: '7', label: 'Last 7 days', days: 7 },
  { id: '30', label: 'Last 30 days', days: 30 },
] as const;
type PeriodId = (typeof PERIODS)[number]['id'];

const mins = (n: number) => (!n ? '–' : n >= 60 ? `${Math.floor(n / 60)}h ${Math.round(n % 60)}m` : `${Math.round(n)} min`);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const hourLabel = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' });

/** People per hour of the day. One series: one hue, no legend. */
function HoursChart({ buckets }: { buckets: HourBucket[] }) {
  const [hover, setHover] = useState<number | null>(null);
  // Show the day's working span rather than 24 mostly empty hours.
  const active = buckets.filter((b) => b.count > 0);
  if (active.length === 0) return <p className="muted">Not enough visits yet to show busy times.</p>;
  // At least a 9am-5pm span, so a quiet day doesn't become one giant bar.
  const first = Math.max(0, Math.min(9, ...active.map((b) => b.hour)) - 1);
  const last = Math.min(23, Math.max(17, ...active.map((b) => b.hour)) + 1);
  const shown = buckets.filter((b) => b.hour >= first && b.hour <= last);
  const max = Math.max(...shown.map((b) => b.count));
  const peak = shown.reduce((a, b) => (b.count > a.count ? b : a), shown[0]);

  return (
    <figure className="hours">
      <figcaption>Busiest around <strong>{hourLabel(peak.hour)}</strong></figcaption>
      <div className="hours-plot" role="img" aria-label={`Visits by hour, peaking at ${hourLabel(peak.hour)}`}>
        {[0.5, 1].map((f) => <span key={f} className="hours-grid" style={{ bottom: `${f * 100}%` }} aria-hidden="true" />)}
        {shown.map((b) => (
          <div
            key={b.hour}
            className="hours-col"
            onMouseEnter={() => setHover(b.hour)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(b.hour)}
            onBlur={() => setHover(null)}
            tabIndex={0}
          >
            <div className="hours-bar" style={{ height: `${max ? (b.count / max) * 100 : 0}%` }} data-active={hover === b.hour} />
            {hover === b.hour && (
              <div className="hours-tip" role="tooltip">{hourLabel(b.hour)}<b>{b.count}</b></div>
            )}
          </div>
        ))}
      </div>
      <div className="hours-axis" aria-hidden="true">
        {shown.map((b, i) => <span key={b.hour}>{i % 2 === 0 ? hourLabel(b.hour) : ''}</span>)}
      </div>
      <table className="sr-only">
        <caption>Visits by hour</caption>
        <tbody>{shown.map((b) => <tr key={b.hour}><th>{hourLabel(b.hour)}</th><td>{b.count}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

export default function AnalyticsPage() {
  const { user } = useAuthContext();
  const terms = useTerms();
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locationId, setLocationId] = useState('');
  const [period, setPeriod] = useState<PeriodId>('7');
  const [detailed, setDetailed] = useState<Detailed | null>(null);
  const [journeys, setJourneys] = useState<Journeys | null>(null);
  const [hoursService, setHoursService] = useState('');
  const [hours, setHours] = useState<HourBucket[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (!user?.organizationId) return;
    api.getLocations(user.organizationId)
      .then((locs: LocationRow[]) => { setLocations(locs); setLocationId(locs[0]?.id || ''); if (!locs.length) setLoading(false); })
      .catch(() => { setProblem('Couldn’t load your locations.'); setLoading(false); });
  }, [user?.organizationId]);

  const days = PERIODS.find((p) => p.id === period)!.days;
  const range = useMemo(() => {
    const end = new Date();
    const start = new Date();
    if (days) start.setDate(start.getDate() - (days - 1));
    return { start: isoDay(start), end: isoDay(end) };
  }, [days]);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true);
    setProblem('');
    Promise.all([
      api.getDetailedAnalytics(locationId, range.start, range.end),
      api.getJourneyAnalytics(locationId, range.start, range.end).catch(() => null),
    ])
      .then(([d, j]) => {
        setDetailed(d);
        setJourneys(j);
        setHoursService((s) => (d.services.some((x: ServiceMetric) => x.serviceId === s) ? s : d.services[0]?.serviceId || ''));
      })
      .catch(() => setProblem('Couldn’t load the numbers. Try again.'))
      .finally(() => setLoading(false));
  }, [locationId, range]);

  useEffect(() => {
    if (!hoursService) { setHours(null); return; }
    setHours(null);
    api.getPeakHoursAnalysis(hoursService, Math.max(days, 7))
      .then((r: { hourlyDistribution: HourBucket[] }) => setHours(r.hourlyDistribution))
      .catch(() => setHours([]));
  }, [hoursService, days]);

  const services = detailed?.services || [];
  const served = services.reduce((n, s) => n + s.counts.served, 0);
  const weighted = (pick: (s: ServiceMetric) => number) =>
    served ? services.reduce((n, s) => n + pick(s) * s.counts.served, 0) / served : 0;
  const total = detailed?.totals.total || 0;
  const noShowRate = total ? Math.round(((detailed?.totals.noShows || 0) / total) * 100) : 0;

  return (
    <Layout>
      <PageHeader
        title="Analytics"
        subtitle="How long people wait, how long service takes, and where the queue backs up."
        actions={locations.length > 1 ? (
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)} aria-label="Location">
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        ) : undefined}
      />

      <div className="segmented" role="radiogroup" aria-label="Period">
        {PERIODS.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</button>
        ))}
      </div>

      {problem && <div className="inline-alert inline-alert-error" role="alert">{problem}</div>}

      <section className="today-numbers" aria-label="Summary" data-loading={loading}>
        <div><b>{detailed ? served : '–'}</b><span>{terms.people} served</span></div>
        <div><b>{detailed ? mins(weighted((s) => s.waitTime.average)) : '–'}</b><span>average wait</span></div>
        <div><b>{detailed ? mins(weighted((s) => s.serviceTime.average)) : '–'}</b><span>average time at the desk</span></div>
        <div><b>{detailed ? (total ? `${noShowRate}%` : '–') : '–'}</b><span>didn’t come when called</span></div>
      </section>

      <section className="panel analytics-panel analytics-services">
          <h2>By service</h2>
          {!detailed ? <div className="spinner" /> : services.length === 0 ? (
            <p className="muted">No services at this location.</p>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Service</th><th>Joined</th><th>Served</th><th>Average wait</th><th>Longest wait</th><th>At the desk</th><th>Not here</th></tr>
                </thead>
                <tbody>
                  {services.map((s) => (
                    <tr key={s.serviceId}>
                      <td><strong>{s.serviceName}</strong></td>
                      <td>{s.counts.total}</td>
                      <td>{s.counts.served}</td>
                      <td>{mins(s.waitTime.average)}</td>
                      <td>{mins(s.waitTime.longest)}</td>
                      <td>{mins(s.serviceTime.average)}</td>
                      <td>{s.counts.total ? `${s.noShowRate}%` : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>

      <div className="analytics-grid">
        <section className="panel analytics-panel">
          <div className="analytics-head">
            <h2>Busy times</h2>
            {services.length > 1 && (
              <select value={hoursService} onChange={(e) => setHoursService(e.target.value)} aria-label="Service">
                {services.map((s) => <option key={s.serviceId} value={s.serviceId}>{s.serviceName}</option>)}
              </select>
            )}
          </div>
          <p className="analytics-note">When people joined{days < 7 ? ' over the last 7 days' : ''}.</p>
          {hours === null ? <div className="spinner" /> : <HoursChart buckets={hours} />}
        </section>

      {journeys && (
        <section className="panel analytics-panel analytics-journeys">
          <h2>Journeys between services</h2>
          {journeys.summary.totalJourneys === 0 ? (
            <p className="muted">When {terms.people} are sent from one service to the next, their full visit shows here.</p>
          ) : (
            <dl>
              <div><dt>Visits</dt><dd>{journeys.summary.totalJourneys}</dd></div>
              <div><dt>Used more than one service</dt><dd>{journeys.summary.multiServiceJourneys}</dd></div>
              <div><dt>Sent on to another service</dt><dd>{journeys.summary.totalTransfers}</dd></div>
              <div><dt>Average whole visit</dt><dd>{mins(journeys.summary.avgJourneyDuration)}</dd></div>
            </dl>
          )}
        </section>
      )}
      </div>

      <AiInsightsPanel locationId={locationId || undefined} />
    </Layout>
  );
}
