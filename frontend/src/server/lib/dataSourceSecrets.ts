import { encrypt, decrypt } from './encryption';

// Credentials inside DataSource.config.auth, and every custom header value
// (they usually carry API keys). Stored encrypted ("enc:" prefix) and never
// returned to the browser - responses carry SECRET_PLACEHOLDER, and saving
// the placeholder back unchanged keeps the stored value.
const SECRET_KEYS = ['token', 'password', 'apiKey'] as const;
const PREFIX = 'enc:';
export const SECRET_PLACEHOLDER = '••••••••';

type Config = Record<string, any>;

const isObject = (v: unknown): v is Config => !!v && typeof v === 'object' && !Array.isArray(v);

/** Encrypts incoming secrets, keeping existing ones where the client sent the placeholder. */
function sealValues(incoming: Config, previous: Config, keys: string[]): Config {
  const out: Config = { ...incoming };
  for (const key of keys) {
    const value = out[key];
    if (value === SECRET_PLACEHOLDER) {
      if (previous[key] !== undefined) out[key] = previous[key];
      else delete out[key];
    } else if (typeof value === 'string' && value !== '' && !value.startsWith(PREFIX)) {
      out[key] = PREFIX + encrypt(value);
    }
  }
  return out;
}

const openValues = (values: Config, keys: string[]): Config => {
  const out: Config = { ...values };
  for (const key of keys) {
    if (typeof out[key] === 'string' && out[key].startsWith(PREFIX)) out[key] = decrypt(out[key].slice(PREFIX.length));
  }
  return out;
};

const redactValues = (values: Config, keys: string[]): Config => {
  const out: Config = { ...values };
  for (const key of keys) if (typeof out[key] === 'string' && out[key] !== '') out[key] = SECRET_PLACEHOLDER;
  return out;
};

export function sealConfig(incoming: unknown, existing?: unknown): Config {
  if (!isObject(incoming)) return {};
  const next: Config = { ...incoming };
  if (isObject(incoming.headers)) {
    const prevHeaders = isObject(existing) && isObject(existing.headers) ? existing.headers : {};
    next.headers = sealValues(incoming.headers, prevHeaders, Object.keys(incoming.headers));
  }
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
  if (isObject(config.headers)) config = { ...config, headers: openValues(config.headers, Object.keys(config.headers)) };
  if (!isObject((config as Config).auth)) return { ...(config as Config) };
  const c = config as Config;
  return { ...c, auth: openValues(c.auth, [...SECRET_KEYS]) };
}

/** Config safe to send to the browser. */
export function redactConfig(config: unknown): Config {
  if (!isObject(config)) return {};
  const out: Config = { ...config };
  if (isObject(config.headers)) out.headers = redactValues(config.headers, Object.keys(config.headers));
  if (isObject(config.auth)) out.auth = redactValues(config.auth, [...SECRET_KEYS]);
  return out;
}

export function redactDataSource<T extends { config: unknown }>(dataSource: T): T {
  return { ...dataSource, config: redactConfig(dataSource.config) };
}
