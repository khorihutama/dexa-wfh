import { Module } from '@nestjs/common';
import { DatabaseModule } from '@dexa-wfh/database';
import { HealthController } from './health.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController, AuthController],
  providers: [AuthService],
})
export class AppModule {}
