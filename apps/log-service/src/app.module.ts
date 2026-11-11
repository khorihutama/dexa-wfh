import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { InternalApiKeyGuard } from '@dexa-wfh/common';
import { LogController } from './log.controller';
import { LogConsumerService } from './log-consumer.service';

@Module({
  controllers: [LogController],
  providers: [
    LogConsumerService,
    {
      provide: APP_GUARD,
      useClass: InternalApiKeyGuard,
    },
  ],
})
export class AppModule {}
