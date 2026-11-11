import { Body, Controller, Get, Post } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import {
  AllServicesHealthDto,
  createHealthResponse,
  HealthStatusDto,
  SERVICES,
} from '@dexa-wfh/common';
import { loadEnvConfig } from '@dexa-wfh/config';
import { RabbitMqPublisherService } from './rabbitmq-publisher.service';
import { NotificationsGateway } from './notifications.gateway';

@ApiTags('Gateway & Health')
@Controller()
export class GatewayController {
  private readonly config = loadEnvConfig();

  constructor(
    private readonly httpService: HttpService,
    private readonly rabbitMqPublisher: RabbitMqPublisherService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Check API Gateway health and RabbitMQ producer status' })
  async getHealth(): Promise<HealthStatusDto> {
    const rabbitmq = await this.rabbitMqPublisher.checkHealth();
    return createHealthResponse(SERVICES.API_GATEWAY, { rabbitmq });
  }

  @Get('health/all')
  @ApiOperation({ summary: 'Aggregate health from all downstream microservices via HTTP REST' })
  async getAllHealth(): Promise<AllServicesHealthDto> {
    const gateway = await this.getHealth();

    const targets: Record<string, string> = {
      [SERVICES.AUTH_SERVICE]: `${this.config.AUTH_SERVICE_URL}/health`,
      [SERVICES.EMPLOYEE_SERVICE]: `${this.config.EMPLOYEE_SERVICE_URL}/health`,
      [SERVICES.ATTENDANCE_SERVICE]: `${this.config.ATTENDANCE_SERVICE_URL}/health`,
      [SERVICES.LOG_SERVICE]: `${this.config.LOG_SERVICE_URL}/health`,
    };

    const entries = await Promise.all(
      Object.entries(targets).map(async ([serviceName, url]) => {
        try {
          const response = await firstValueFrom(
            this.httpService.get<HealthStatusDto>(url, { timeout: 3000 }),
          );
          return [serviceName, response.data] as const;
        } catch (error) {
          return [
            serviceName,
            {
              service: serviceName,
              status: 'down' as const,
              error: error instanceof Error ? error.message : 'Service unreachable',
            },
          ] as const;
        }
      }),
    );

    const services: AllServicesHealthDto['services'] = Object.fromEntries(entries);
    const anyDown =
      gateway.status !== 'ok' ||
      Object.values(services).some((svc) => svc.status !== 'ok');

    return {
      gateway,
      services,
      overallStatus: anyDown ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('ping')
  @ApiOperation({
    summary: 'Publish a sample ping event to RabbitMQ (consumed by log-service -> MongoDB) and broadcast Socket.IO toast',
  })
  async sendPing(@Body() body?: { message?: string }) {
    const message = body?.message ?? 'Ping event from API Gateway';
    const eventPayload = await this.rabbitMqPublisher.publishPing(message);
    this.notificationsGateway.broadcastNotification(
      'RabbitMQ Ping Dispatched',
      message,
    );
    return {
      dispatched: true,
      queue: 'dexa_wfh_logs_queue',
      payload: eventPayload,
    };
  }

  @Get('logs')
  @ApiOperation({ summary: 'Proxy GET /logs from log-service (MongoDB records)' })
  async getLogs() {
    const response = await firstValueFrom(
      this.httpService.get(`${this.config.LOG_SERVICE_URL}/logs`, { timeout: 3000 }),
    );
    return response.data;
  }
}
