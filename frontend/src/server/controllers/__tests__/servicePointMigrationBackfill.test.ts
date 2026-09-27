import { describe, it, expect } from 'vitest';
import { resolveBackfillLink } from '../../lib/instanceBackfill';

describe('resolveBackfillLink', () => {
  it('returns null when the service point has zero links', () => {
    const result = resolveBackfillLink({ servicePointId: 'sp1', currentServiceId: null }, []);
    expect(result).toBeNull();
  });

  it('picks the single link when there is exactly one', () => {
    const links = [{ id: 'link1', serviceId: 'svc1', createdAt: new Date('2026-01-01') }];
    const result = resolveBackfillLink({ servicePointId: 'sp1', currentServiceId: null }, links);
    expect(result).toBe('link1');
  });

  it('prefers the link matching currentServiceId over an earlier-created one', () => {
    const links = [
      { id: 'link1', serviceId: 'svc1', createdAt: new Date('2026-01-01') },
      { id: 'link2', serviceId: 'svc2', createdAt: new Date('2026-01-02') },
    ];
    const result = resolveBackfillLink({ servicePointId: 'sp1', currentServiceId: 'svc2' }, links);
    expect(result).toBe('link2');
  });

  it('falls back to the earliest-created link when currentServiceId matches nothing', () => {
    const links = [
      { id: 'link1', serviceId: 'svc1', createdAt: new Date('2026-01-02') },
      { id: 'link2', serviceId: 'svc2', createdAt: new Date('2026-01-01') },
    ];
    const result = resolveBackfillLink({ servicePointId: 'sp1', currentServiceId: 'svc-nonexistent' }, links);
    expect(result).toBe('link2');
  });
});
