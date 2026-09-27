const API_BASE = process.env.API_BASE || 'http://localhost:8003/api/v1';

async function run() {
  const suffix = Date.now();
  const res = await fetch(`${API_BASE}/public/register-org`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organizationName: `Smoke Test Org ${suffix}`,
      adminEmail: `smoketest+${suffix}@example.com`,
      adminPassword: 'testpass123',
      adminFirstName: 'Smoke',
      adminLastName: 'Test',
      emailVerified: true,
    }),
  });

  const body = await res.json();
  if (res.status !== 201) {
    throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(body)}`);
  }
  if (!body.organization.slug) {
    throw new Error(`Expected organization.slug to be set, got: ${JSON.stringify(body.organization)}`);
  }
  console.log('Auto-generated slug:', body.organization.slug);

  // Reserved slug should be rejected
  const reservedRes = await fetch(`${API_BASE}/public/register-org`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organizationName: `Reserved Slug Test ${suffix}`,
      slug: 'admin',
      adminEmail: `reserved+${suffix}@example.com`,
      adminPassword: 'testpass123',
      adminFirstName: 'Reserved',
      adminLastName: 'Test',
      emailVerified: true,
    }),
  });
  const reservedBody = await reservedRes.json();
  if (reservedRes.status !== 400) {
    throw new Error(`Expected 400 for reserved slug, got ${reservedRes.status}: ${JSON.stringify(reservedBody)}`);
  }
  console.log('Reserved slug correctly rejected:', reservedBody.error);
  console.log('org-slug-registration smoke test passed');
  process.exit(0);
}

run().catch((err) => {
  console.error('org-slug-registration smoke test failed:', err);
  process.exit(2);
});
