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
