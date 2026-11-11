import { Controller, Get, Query } from '@nestjs/common';
import { createHealthResponse, HealthStatusDto, SERVICES } from '@dexa-wfh/common';
import { GetLogsQueryDto, LogConsumerService } from './log-consumer.service';

@Controller()
export class LogController {
  constructor(private readonly logConsumer: LogConsumerService) {}

  @Get('health')
  async getHealth(): Promise<HealthStatusDto> {
    const [mongodb, rabbitmq] = await Promise.all([
      this.logConsumer.checkMongoHealth(),
      this.logConsumer.checkRabbitMqHealth(),
    ]);
    return createHealthResponse(SERVICES.LOG_SERVICE, { mongodb, rabbitmq });
  }

  @Get('logs')
  async getLogs(@Query() query: GetLogsQueryDto) {
    return this.logConsumer.getRecentLogs(query);
  }
}
