import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { InternalApiKeyGuard } from '@dexa-wfh/common';
import { DatabaseModule } from '@dexa-wfh/database';
import { HealthController } from './health.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, AuthController],
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: InternalApiKeyGuard,
    },
  ],
})
export class AppModule {}
