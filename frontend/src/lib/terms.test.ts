import { describe, it, expect } from 'vitest';
import { termsFor, pluralize } from './terms';

describe('termsFor', () => {
  it('uses the industry default', () => {
    expect(termsFor({ industry: 'HEALTHCARE' })).toEqual({ person: 'patient', people: 'patients', Person: 'Patient', People: 'Patients' });
    expect(termsFor({ industry: 'RESTAURANT' }).people).toBe('guests');
    expect(termsFor(null).person).toBe('customer');
  });
  it('prefers the org’s own word, with its own plural if given', () => {
    expect(termsFor({ industry: 'HEALTHCARE', customerLabel: 'Member' }).People).toBe('Members');
    expect(termsFor({ customerLabel: 'person', customerLabelPlural: 'people' }).people).toBe('people');
  });
  it('pluralizes common endings', () => {
    expect(pluralize('class')).toBe('classes');
    expect(pluralize('party')).toBe('parties');
    expect(pluralize('day')).toBe('days');
  });
});
