// Single source of truth for the product's display name. Set APP_NAME in
// the repo-root .env - docker-compose forwards it to this service as-is.
export const APP_NAME = process.env.APP_NAME || 'BetaPosition';
