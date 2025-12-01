/**
 * Simple smoke test to validate public flow:
 * 1. GET /api/v1/public/locations (backend)
 * 2. For first location with publicCode, fetch frontend /join/:code page
 */

const API_BASE = process.env.API_BASE || 'http://localhost:8004/api/v1';
const FRONTEND_BASE = process.env.FRONTEND_BASE || 'http://localhost:8003';

async function run() {
  try {
    console.log('Checking public locations...');
    const locRes = await fetch(`${API_BASE}/public/locations`);
    if (!locRes.ok) throw new Error(`Public locations failed: ${locRes.status}`);
    const locations = await locRes.json();
    console.log('Found', locations.length, 'public locations');

    if (locations.length === 0) {
      console.log('No public locations - test passed but no location to join');
      return process.exit(0);
    }

    const first = locations[0];
    if (!first.publicCode) {
      console.log('First location has no publicCode - skipping join test');
      return process.exit(0);
    }

    console.log('Checking frontend join page for', first.publicCode);
    const pageRes = await fetch(`${FRONTEND_BASE}/join/${first.publicCode}`);
    if (!pageRes.ok) throw new Error(`Join page returned ${pageRes.status}`);
    console.log('Join page loaded OK (status', pageRes.status, ')');
    console.log('Smoke test passed');
    process.exit(0);
  } catch (err) {
    console.error('Smoke test failed:', err);
    process.exit(2);
  }
}

run();
