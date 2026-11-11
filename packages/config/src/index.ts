export interface AppEnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  API_GATEWAY_PORT: number;
  AUTH_SERVICE_PORT: number;
  EMPLOYEE_SERVICE_PORT: number;
  ATTENDANCE_SERVICE_PORT: number;
  LOG_SERVICE_PORT: number;
  AUTH_SERVICE_URL: string;
  EMPLOYEE_SERVICE_URL: string;
  ATTENDANCE_SERVICE_URL: string;
  LOG_SERVICE_URL: string;
  DATABASE_URL: string;
  MONGODB_URI: string;
  RABBITMQ_URL: string;
  CORS_ORIGIN: string;
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

  return {
    NODE_ENV,
    API_GATEWAY_PORT,
    AUTH_SERVICE_PORT,
    EMPLOYEE_SERVICE_PORT,
    ATTENDANCE_SERVICE_PORT,
    LOG_SERVICE_PORT,
    AUTH_SERVICE_URL: env.AUTH_SERVICE_URL ?? `http://localhost:${AUTH_SERVICE_PORT}`,
    EMPLOYEE_SERVICE_URL: env.EMPLOYEE_SERVICE_URL ?? `http://localhost:${EMPLOYEE_SERVICE_PORT}`,
    ATTENDANCE_SERVICE_URL:
      env.ATTENDANCE_SERVICE_URL ?? `http://localhost:${ATTENDANCE_SERVICE_PORT}`,
    LOG_SERVICE_URL: env.LOG_SERVICE_URL ?? `http://localhost:${LOG_SERVICE_PORT}`,
    DATABASE_URL:
      env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/dexa_wfh?schema=public',
    MONGODB_URI: env.MONGODB_URI ?? 'mongodb://localhost:27017/dexa_wfh_logs',
    RABBITMQ_URL: env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
    CORS_ORIGIN: env.CORS_ORIGIN ?? '*',
  };
}
