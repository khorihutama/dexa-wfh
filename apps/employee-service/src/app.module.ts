import { Module } from '@nestjs/common';
import { DatabaseModule } from '@dexa-wfh/database';
import { HealthController } from './health.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
})
export class AppModule {}
