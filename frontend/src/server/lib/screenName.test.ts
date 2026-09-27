import { describe, it, expect } from 'vitest';
import { screenName } from './screenName';

describe('screenName', () => {
  it('hides names in ticket-only mode', () => {
    expect(screenName('TICKET_ONLY', 'Kofi', 'Boateng')).toBeNull();
    expect(screenName(undefined, 'Kofi', 'Boateng')).toBeNull();
  });
  it('shortens to first name and initial', () => {
    expect(screenName('NAME_AND_TICKET', 'Kofi', 'boateng')).toBe('Kofi B.');
    expect(screenName('NAME_AND_TICKET', 'Kofi', '')).toBe('Kofi');
  });
  it('shows the full name only in full-info mode', () => {
    expect(screenName('FULL_INFO', 'Kofi', 'Boateng')).toBe('Kofi Boateng');
  });
});
