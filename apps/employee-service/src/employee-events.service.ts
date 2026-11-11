import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import {
  EVENTS,
  LogEventPayloadDto,
  ProfileUpdatedEventDataDto,
  QUEUES,
  SERVICES,
} from '@dexa-wfh/common';
import { loadEnvConfig } from '@dexa-wfh/config';

@Injectable()
export class EmployeeEventsService implements OnModuleDestroy {
  private readonly config = loadEnvConfig();
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;

  private async ensureChannel(): Promise<amqp.Channel> {
    if (this.channel) {
      return this.channel;
    }
    this.connection = await amqp.connect(this.config.RABBITMQ_URL);
    this.channel = await this.connection.createChannel();
    await this.channel.assertQueue(QUEUES.LOG_QUEUE, { durable: true });
    return this.channel;
  }

  async publishProfileUpdated(data: ProfileUpdatedEventDataDto): Promise<{
    rabbitMqDispatched: boolean;
    gatewayNotified: boolean;
  }> {
    let rabbitMqDispatched = false;
    let gatewayNotified = false;

    const payload: LogEventPayloadDto = {
      event: EVENTS.PROFILE_UPDATED,
      source: SERVICES.EMPLOYEE_SERVICE,
      timestamp: data.timestamp,
      data: data as unknown as Record<string, unknown>,
    };

    try {
      const channel = await this.ensureChannel();
      channel.sendToQueue(QUEUES.LOG_QUEUE, Buffer.from(JSON.stringify(payload)), {
        persistent: true,
      });
      rabbitMqDispatched = true;
    } catch (err) {
      this.channel = null;
      this.connection = null;
      console.warn(
        'Failed to publish profile update to RabbitMQ:',
        err instanceof Error ? err.message : err,
      );
    }

    try {
      const res = await fetch(
        `${this.config.API_GATEWAY_URL}/internal/notifications/profile-updated`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-key': this.config.INTERNAL_API_KEY,
          },
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(3000),
        },
      );
      gatewayNotified = res.ok;
    } catch (err) {
      console.warn(
        'Failed to notify API Gateway for profile update:',
        err instanceof Error ? err.message : err,
      );
    }

    return { rabbitMqDispatched, gatewayNotified };
  }

  async onModuleDestroy() {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // ignore close errors
    }
  }
}
