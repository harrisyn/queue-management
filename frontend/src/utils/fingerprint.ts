/**
 * Generate a browser fingerprint on the client side
 * This creates a unique identifier based on browser characteristics
 */
export async function generateClientFingerprint(): Promise<string> {
  const components: string[] = [];

  // Screen resolution
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);

  // Timezone
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Platform
  components.push(navigator.platform);

  // Language
  components.push(navigator.language);

  // Hardware concurrency (CPU cores)
  components.push(String(navigator.hardwareConcurrency || 'unknown'));

  // Device memory (if available)
  if ('deviceMemory' in navigator) {
    components.push(String((navigator as any).deviceMemory));
  }

  // Canvas fingerprint (basic)
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('QMS', 2, 2);
      components.push(canvas.toDataURL().slice(-50)); // Last 50 chars
    }
  } catch (e) {
    // Canvas may be blocked
  }

  // Combine all components
  const fingerprintString = components.join('|');

  // Create a simple hash (not cryptographic, but sufficient for identification)
  let hash = 0;
  for (let i = 0; i < fingerprintString.length; i++) {
    const char = fingerprintString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(36);
}

/**
 * Get or create a fingerprint and store it in localStorage
 */
export async function getStoredFingerprint(): Promise<string> {
  const STORAGE_KEY = 'qms_browser_fp';
  
  // Try to get existing fingerprint
  let fingerprint = localStorage.getItem(STORAGE_KEY);
  
  if (!fingerprint) {
    // Generate new fingerprint
    fingerprint = await generateClientFingerprint();
    localStorage.setItem(STORAGE_KEY, fingerprint);
  }
  
  return fingerprint;
}

/**
 * Get client data to send with requests for server-side fingerprinting
 */
export function getClientData() {
  return {
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    platform: navigator.platform,
    language: navigator.language,
  };
}
