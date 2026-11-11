import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { InternalApiKeyGuard } from '@dexa-wfh/common';
import { DatabaseModule } from '@dexa-wfh/database';
import { HealthController } from './health.controller';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { EmployeeEventsService } from './employee-events.service';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, EmployeeController],
  providers: [
    EmployeeService,
    EmployeeEventsService,
    {
      provide: APP_GUARD,
      useClass: InternalApiKeyGuard,
    },
  ],
})
export class AppModule {}
