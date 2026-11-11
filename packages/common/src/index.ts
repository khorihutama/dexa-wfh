import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

export const SERVICES = {
  API_GATEWAY: 'api-gateway',
  AUTH_SERVICE: 'auth-service',
  EMPLOYEE_SERVICE: 'employee-service',
  ATTENDANCE_SERVICE: 'attendance-service',
  LOG_SERVICE: 'log-service',
} as const;

export const QUEUES = {
  LOG_QUEUE: 'dexa_wfh_logs_queue',
} as const;

export const EVENTS = {
  PING: 'system.ping',
  ACTIVITY_LOG: 'system.activity_log',
  ADMIN_NOTIFICATION: 'admin.notification',
} as const;

export interface HealthDependencyStatus {
  status: 'up' | 'down';
  message?: string;
}

export interface HealthStatusDto {
  service: string;
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
  dependencies?: Record<string, HealthDependencyStatus>;
}

export interface AllServicesHealthDto {
  gateway: HealthStatusDto;
  services: Record<string, HealthStatusDto | { service: string; status: 'down'; error: string }>;
  overallStatus: 'ok' | 'degraded' | 'down';
  timestamp: string;
}

export interface LogEventPayloadDto {
  event: string;
  source: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export function createHealthResponse(
  service: string,
  dependencies?: Record<string, HealthDependencyStatus>,
): HealthStatusDto {
  const hasDown =
    dependencies &&
    Object.values(dependencies).some((dep) => dep.status === 'down');

  return {
    service,
    status: hasDown ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    ...(dependencies ? { dependencies } : {}),
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request?.url ?? '',
      error: message,
    });
  }
}
