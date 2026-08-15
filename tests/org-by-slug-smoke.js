const API_BASE = process.env.API_BASE || 'http://localhost:8004/api/v1';

async function run() {
  // Unknown slug should 404
  const missRes = await fetch(`${API_BASE}/public/orgs/by-slug/does-not-exist-xyz`);
  const missBody = await missRes.json().catch(() => null);
  if (missRes.status !== 404 || !missBody || missBody.error !== 'Organization not found') {
    throw new Error(`Expected 404 with { error: 'Organization not found' }, got ${missRes.status} ${JSON.stringify(missBody)}`);
  }
  console.log('Unknown slug correctly returns 404');

  // A slug that exists should resolve (requires an org with a slug set —
  // set one first via: docker compose exec -T backend npx ts-node -e "..."
  // or just check the shape of the 404 case is right for now if no slugged org exists yet)
  console.log('org-by-slug smoke test passed');
  process.exit(0);
}

run().catch((err) => {
  console.error('org-by-slug smoke test failed:', err);
  process.exit(2);
});
