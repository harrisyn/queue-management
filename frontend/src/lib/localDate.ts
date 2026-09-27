/** "YYYY-MM-DD" for the browser's own calendar day (toISOString gives UTC's). */
export const localDay = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
