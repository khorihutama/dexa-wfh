import * as path from 'node:path';

export interface AppEnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  API_GATEWAY_PORT: number;
  AUTH_SERVICE_PORT: number;
  EMPLOYEE_SERVICE_PORT: number;
  ATTENDANCE_SERVICE_PORT: number;
  LOG_SERVICE_PORT: number;
  API_GATEWAY_URL: string;
  AUTH_SERVICE_URL: string;
  EMPLOYEE_SERVICE_URL: string;
  ATTENDANCE_SERVICE_URL: string;
  LOG_SERVICE_URL: string;
  DATABASE_URL: string;
  MONGODB_URI: string;
  RABBITMQ_URL: string;
  CORS_ORIGIN: string;
  CORS_ALLOW_LAN: boolean;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  INTERNAL_API_KEY: string;
  UPLOADS_DIR: string;
}

function parsePort(value: string | undefined, fallback: number, name: string): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid port configuration for ${name}: ${value}`);
  }
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean, name: string): boolean {
  if (value === undefined || value.trim() === '') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  throw new Error(`Invalid boolean configuration for ${name}: ${value}`);
}

export function loadEnvConfig(env: NodeJS.ProcessEnv = process.env): AppEnvConfig {
  const nodeEnvRaw = env.NODE_ENV ?? 'development';
  const NODE_ENV =
    nodeEnvRaw === 'production' || nodeEnvRaw === 'test' ? nodeEnvRaw : 'development';

  const API_GATEWAY_PORT = parsePort(env.API_GATEWAY_PORT, 3000, 'API_GATEWAY_PORT');
  const AUTH_SERVICE_PORT = parsePort(env.AUTH_SERVICE_PORT, 3001, 'AUTH_SERVICE_PORT');
  const EMPLOYEE_SERVICE_PORT = parsePort(env.EMPLOYEE_SERVICE_PORT, 3002, 'EMPLOYEE_SERVICE_PORT');
  const ATTENDANCE_SERVICE_PORT = parsePort(
    env.ATTENDANCE_SERVICE_PORT,
    3003,
    'ATTENDANCE_SERVICE_PORT',
  );
  const LOG_SERVICE_PORT = parsePort(env.LOG_SERVICE_PORT, 3004, 'LOG_SERVICE_PORT');
  const CORS_ALLOW_LAN = parseBoolean(env.CORS_ALLOW_LAN, NODE_ENV === 'development', 'CORS_ALLOW_LAN');

  const defaultUploadsDir = path.resolve(__dirname, '../../../uploads');

  return {
    NODE_ENV,
    API_GATEWAY_PORT,
    AUTH_SERVICE_PORT,
    EMPLOYEE_SERVICE_PORT,
    ATTENDANCE_SERVICE_PORT,
    LOG_SERVICE_PORT,
    API_GATEWAY_URL: env.API_GATEWAY_URL ?? `http://localhost:${API_GATEWAY_PORT}`,
    AUTH_SERVICE_URL: env.AUTH_SERVICE_URL ?? `http://localhost:${AUTH_SERVICE_PORT}`,
    EMPLOYEE_SERVICE_URL: env.EMPLOYEE_SERVICE_URL ?? `http://localhost:${EMPLOYEE_SERVICE_PORT}`,
    ATTENDANCE_SERVICE_URL:
      env.ATTENDANCE_SERVICE_URL ?? `http://localhost:${ATTENDANCE_SERVICE_PORT}`,
    LOG_SERVICE_URL: env.LOG_SERVICE_URL ?? `http://localhost:${LOG_SERVICE_PORT}`,
    DATABASE_URL:
      env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/dexa_wfh?schema=public',
    MONGODB_URI: env.MONGODB_URI ?? 'mongodb://localhost:27017/dexa_wfh_logs',
    RABBITMQ_URL: env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
    CORS_ORIGIN: env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:5174',
    CORS_ALLOW_LAN,
    JWT_SECRET: env.JWT_SECRET ?? 'dexa-wfh-dev-jwt-secret-key-2026',
    JWT_EXPIRES_IN: env.JWT_EXPIRES_IN ?? '8h',
    INTERNAL_API_KEY: env.INTERNAL_API_KEY ?? 'dexa-wfh-internal-service-key',
    UPLOADS_DIR: env.UPLOADS_DIR ? path.resolve(env.UPLOADS_DIR) : defaultUploadsDir,
  };
}

export function parseCorsOrigins(corsOrigin: string): string | string[] {
  const trimmed = corsOrigin.trim();
  if (trimmed === '*') {
    return '*';
  }
  const list = trimmed
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length === 1 ? list[0] : list;
}

export type CorsOriginCallback = (error: Error | null, allow?: boolean) => void;
export type CorsOriginValidator = (origin: string | undefined, callback: CorsOriginCallback) => void;

function isPrivateIpv4(hostname: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) return false;
  const [a, b, c, d] = match.slice(1).map(Number);
  if ([a, b, c, d].some((octet) => octet > 255)) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/**
 * True for browser origins that only exist on the developer's machine or local network:
 * loopback hostnames and RFC 1918 IPv4 addresses, on any port and either http/https.
 */
export function isLocalOrPrivateOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  if (url.pathname !== '/' || url.search || url.hash) return false;

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1'
  ) {
    return true;
  }
  return isPrivateIpv4(hostname);
}

/**
 * Builds one CORS origin callback for both the HTTP gateway and the Socket.IO handshake.
 * Allowed origins are reflected (never "*") because credentialed requests are enabled.
 */
export function createCorsOriginValidator(
  corsOrigin: string,
  allowLan: boolean,
): CorsOriginValidator {
  const parsed = parseCorsOrigins(corsOrigin);
  const entries = (Array.isArray(parsed) ? parsed : [parsed]).map(
    (entry) => entry.trim().replace(/\/+$/, '').toLowerCase(),
  );
  const allowAny = entries.includes('*');
  const allowList = new Set(entries.filter((entry) => entry !== '*'));

  return (origin, callback) => {
    if (!origin) {
      // Non-browser clients (curl, health checks, server-to-server) send no Origin.
      callback(null, true);
      return;
    }
    const candidate = origin.trim().replace(/\/+$/, '').toLowerCase();
    const allowed =
      allowAny || allowList.has(candidate) || (allowLan && isLocalOrPrivateOrigin(candidate));
    callback(null, allowed);
  };
}
