import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { InternalApiKeyGuard } from '@dexa-wfh/common';
import { DatabaseModule } from '@dexa-wfh/database';
import { HealthController } from './health.controller';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, AttendanceController],
  providers: [
    AttendanceService,
    {
      provide: APP_GUARD,
      useClass: InternalApiKeyGuard,
    },
  ],
})
export class AppModule {}
