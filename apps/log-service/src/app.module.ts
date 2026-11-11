import { Module } from '@nestjs/common';
import { LogController } from './log.controller';
import { LogConsumerService } from './log-consumer.service';

@Module({
  controllers: [LogController],
  providers: [LogConsumerService],
})
export class AppModule {}
