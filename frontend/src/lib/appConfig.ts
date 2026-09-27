// Single source of truth for the product's display name. Set APP_NAME in
// the repo-root .env - docker-compose forwards it here as
// NEXT_PUBLIC_APP_NAME so it's inlined into the client bundle.
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'BetaPosition';
