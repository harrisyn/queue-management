import { encrypt, decrypt } from './encryption';

// Credentials inside DataSource.config.auth. Stored encrypted ("enc:" prefix)
// and never returned to the browser - responses carry SECRET_PLACEHOLDER, and
// saving the placeholder back unchanged keeps the stored value.
const SECRET_KEYS = ['token', 'password', 'apiKey'] as const;
const PREFIX = 'enc:';
export const SECRET_PLACEHOLDER = '••••••••';

type Config = Record<string, any>;

const isObject = (v: unknown): v is Config => !!v && typeof v === 'object' && !Array.isArray(v);

/** Encrypts incoming secrets, keeping existing ones where the client sent the placeholder. */
export function sealConfig(incoming: unknown, existing?: unknown): Config {
  if (!isObject(incoming)) return {};
  const next: Config = { ...incoming };
  if (!isObject(incoming.auth)) return next;

  const prevAuth = isObject(existing) && isObject(existing.auth) ? existing.auth : {};
  const auth: Config = { ...incoming.auth };
  for (const key of SECRET_KEYS) {
    const value = auth[key];
    if (value === SECRET_PLACEHOLDER) {
      if (prevAuth[key] !== undefined) auth[key] = prevAuth[key];
      else delete auth[key];
    } else if (typeof value === 'string' && value !== '' && !value.startsWith(PREFIX)) {
      auth[key] = PREFIX + encrypt(value);
    }
  }
  next.auth = auth;
  return next;
}

/** Decrypted config, for making the actual outbound request. */
export function openConfig(config: unknown): Config {
  if (!isObject(config)) return {};
  if (!isObject(config.auth)) return { ...config };
  const auth: Config = { ...config.auth };
  for (const key of SECRET_KEYS) {
    const value = auth[key];
    if (typeof value === 'string' && value.startsWith(PREFIX)) auth[key] = decrypt(value.slice(PREFIX.length));
  }
  return { ...config, auth };
}

/** Config safe to send to the browser. */
export function redactConfig(config: unknown): Config {
  if (!isObject(config)) return {};
  if (!isObject(config.auth)) return { ...config };
  const auth: Config = { ...config.auth };
  for (const key of SECRET_KEYS) {
    if (typeof auth[key] === 'string' && auth[key] !== '') auth[key] = SECRET_PLACEHOLDER;
  }
  return { ...config, auth };
}

export function redactDataSource<T extends { config: unknown }>(dataSource: T): T {
  return { ...dataSource, config: redactConfig(dataSource.config) };
}
