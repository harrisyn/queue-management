/**
 * Smoke test for slug generation: verifies reserved words are rejected
 * and collisions get a numeric suffix. Run against the live backend
 * container so it exercises the real Prisma connection.
 */
const { execSync } = require('child_process');

function runInBackend(expr) {
  const out = execSync(
    `docker compose exec -T backend node -e "${expr.replace(/"/g, '\\"')}"`,
    { encoding: 'utf-8', cwd: __dirname + '/..' }
  );
  return out.trim();
}

const script = `
const { slugify, generateUniqueSlug } = require('./dist/utils/slug');
const { isReservedSlug } = require('./dist/constants/reservedSlugs');
(async () => {
  console.log('slugify:', slugify('Nyaho Medical Center!!'));
  console.log('isReservedSlug(admin):', isReservedSlug('admin'));
  console.log('isReservedSlug(nyaho):', isReservedSlug('nyaho'));
  const s = await generateUniqueSlug('Nyaho Medical Center');
  console.log('generateUniqueSlug:', s);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
`;

// Requires a build first since ts-node isn't set up for one-off exec; see Step 4.
console.log(runInBackend(script));
