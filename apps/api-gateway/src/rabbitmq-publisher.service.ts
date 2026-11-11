import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqplib';
import { EVENTS, HealthDependencyStatus, LogEventPayloadDto, QUEUES, SERVICES } from '@dexa-wfh/common';
import { loadEnvConfig } from '@dexa-wfh/config';

@Injectable()
export class RabbitMqPublisherService implements OnModuleDestroy {
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly config = loadEnvConfig();

  private async ensureChannel(): Promise<amqp.Channel> {
    if (this.channel) {
      return this.channel;
    }
    this.connection = await amqp.connect(this.config.RABBITMQ_URL);
    this.channel = await this.connection.createChannel();
    await this.channel.assertQueue(QUEUES.LOG_QUEUE, { durable: true });
    return this.channel;
  }

  async checkHealth(): Promise<HealthDependencyStatus> {
    try {
      await this.ensureChannel();
      return { status: 'up' };
    } catch (error) {
      this.channel = null;
      this.connection = null;
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'RabbitMQ unreachable',
      };
    }
  }

  async publishPing(message = 'Hello from API Gateway'): Promise<LogEventPayloadDto> {
    const channel = await this.ensureChannel();
    const payload: LogEventPayloadDto = {
      event: EVENTS.PING,
      source: SERVICES.API_GATEWAY,
      timestamp: new Date().toISOString(),
      data: { message },
    };
    channel.sendToQueue(QUEUES.LOG_QUEUE, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
    });
    return payload;
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
