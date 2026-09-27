// The API is served by this same Next app (src/pages/api/v1), so the default
// is same-origin. NEXT_PUBLIC_API_URL only overrides it for split setups.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
