import { Module } from '@nestjs/common';
import { DatabaseModule } from '@dexa-wfh/database';
import { HealthController } from './health.controller';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, AttendanceController],
  providers: [AttendanceService],
})
export class AppModule {}
