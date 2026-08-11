const API_BASE = process.env.API_BASE || 'http://localhost:8004/api/v1';

// Assumes the seeded tenant admin harrisyn@gmail.com / 12345678 exists,
// belonging to an org with slug 'nyaho' (set one first if it isn't set —
// see the docker exec command in the plan's Task 3 verification step, or
// just PATCH /orgs/:id with {"slug":"nyaho"} while authenticated).
async function run() {
  // Correct slug should work
  const okRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'harrisyn@gmail.com', password: '12345678', slug: 'nyaho' }),
  });
  if (okRes.status !== 200) {
    throw new Error(`Expected 200 for correct slug, got ${okRes.status}: ${JSON.stringify(await okRes.json())}`);
  }
  console.log('Correct-slug login succeeded');

  // Wrong slug should fail
  const wrongRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'harrisyn@gmail.com', password: '12345678', slug: 'some-other-org' }),
  });
  if (wrongRes.status !== 401) {
    throw new Error(`Expected 401 for wrong slug, got ${wrongRes.status}`);
  }
  console.log('Wrong-slug login correctly rejected');

  // adminLogin should reject a non-SUPER_ADMIN user
  const adminRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'harrisyn@gmail.com', password: '12345678', adminLogin: true }),
  });
  if (adminRes.status !== 401) {
    throw new Error(`Expected 401 for non-superadmin adminLogin, got ${adminRes.status}`);
  }
  console.log('Non-superadmin correctly rejected on adminLogin');

  console.log('login-scoping smoke test passed');
  process.exit(0);
}

run().catch((err) => {
  console.error('login-scoping smoke test failed:', err);
  process.exit(2);
});
