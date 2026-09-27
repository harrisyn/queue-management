/**
 * What an organization calls the people in its queues. A hospital has
 * patients, a restaurant has guests, a bank has customers. Shared by the
 * browser and the server (emails, SMS, AI answers) so copy stays consistent.
 */

export const INDUSTRIES = [
  { id: 'HEALTHCARE', label: 'Hospital or clinic', person: 'patient' },
  { id: 'RESTAURANT', label: 'Restaurant or café', person: 'guest' },
  { id: 'RETAIL', label: 'Shop or service centre', person: 'customer' },
  { id: 'BANKING', label: 'Bank or finance', person: 'customer' },
  { id: 'GOVERNMENT', label: 'Government office', person: 'visitor' },
  { id: 'EDUCATION', label: 'School or university', person: 'student' },
  { id: 'SALON', label: 'Salon, spa or studio', person: 'client' },
  { id: 'OTHER', label: 'Something else', person: 'customer' },
] as const;

export type IndustryId = (typeof INDUSTRIES)[number]['id'];

export interface TermSource {
  industry?: string | null;
  customerLabel?: string | null;
  customerLabelPlural?: string | null;
}

export interface Terms {
  /** "patient" */
  person: string;
  /** "patients" */
  people: string;
  /** "Patient" */
  Person: string;
  /** "Patients" */
  People: string;
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function pluralize(word: string): string {
  const w = word.trim();
  if (!w) return w;
  if (/(s|x|z|ch|sh)$/i.test(w)) return `${w}es`;
  if (/[^aeiou]y$/i.test(w)) return `${w.slice(0, -1)}ies`;
  return `${w}s`;
}

export function defaultPersonFor(industry?: string | null): string {
  return INDUSTRIES.find((i) => i.id === industry)?.person ?? 'customer';
}

export function termsFor(org?: TermSource | null): Terms {
  const person = (org?.customerLabel || '').trim().toLowerCase() || defaultPersonFor(org?.industry);
  const people = (org?.customerLabelPlural || '').trim().toLowerCase() || pluralize(person);
  return { person, people, Person: cap(person), People: cap(people) };
}
