import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GatewayController } from './gateway.controller';
import { RabbitMqPublisherService } from './rabbitmq-publisher.service';
import { NotificationsGateway } from './notifications.gateway';
import { JwtAuthGuard, RolesGuard } from './auth.guards';

@Module({
  imports: [HttpModule],
  controllers: [GatewayController],
  providers: [
    RabbitMqPublisherService,
    NotificationsGateway,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AppModule {}
