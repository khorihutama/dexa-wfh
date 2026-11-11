import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import mongoose, { Connection, FilterQuery, Model, Schema } from 'mongoose';
import {
  HealthDependencyStatus,
  LogEventPayloadDto,
  QUEUES,
} from '@dexa-wfh/common';
import { loadEnvConfig } from '@dexa-wfh/config';

export interface ActivityLogDocument {
  event: string;
  source: string;
  timestamp: string;
  data: Record<string, unknown>;
  receivedAt: Date;
}

export interface GetLogsQueryDto {
  limit?: string | number;
  event?: string;
  employeeId?: string;
  search?: string;
}

const ActivityLogSchema = new Schema<ActivityLogDocument>(
  {
    event: { type: String, required: true, index: true },
    source: { type: String, required: true },
    timestamp: { type: String, required: true },
    data: { type: Schema.Types.Mixed, default: {} },
    receivedAt: { type: Date, default: () => new Date(), index: true },
  },
  { collection: 'activity_logs' },
);

const SENSITIVE_KEYS = new Set([
  'password',
  'newpassword',
  'currentpassword',
  'passwordhash',
]);

export function sanitizeLogData(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeLogData(item));
  }
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase()) && typeof val === 'string') {
        out[key] = '[REDACTED]';
      } else {
        out[key] = sanitizeLogData(val);
      }
    }
    return out;
  }
  return input;
}

@Injectable()
export class LogConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly config = loadEnvConfig();
  private mongoConnection: Connection | null = null;
  private logModel: Model<ActivityLogDocument> | null = null;
  private mongoInitPromise: Promise<Model<ActivityLogDocument>> | null = null;
  private rabbitConnection: amqp.ChannelModel | null = null;
  private rabbitChannel: amqp.Channel | null = null;
  private rabbitInitPromise: Promise<amqp.Channel> | null = null;

  async onModuleInit() {
    await this.initMongo().catch((err) => {
      console.warn('Initial MongoDB connection deferred:', err instanceof Error ? err.message : err);
    });
    await this.initRabbitMqConsumer().catch((err) => {
      console.warn('Initial RabbitMQ consumer deferred:', err instanceof Error ? err.message : err);
    });
  }

  private async initMongo(): Promise<Model<ActivityLogDocument>> {
    if (this.logModel && this.mongoConnection?.readyState === 1) {
      return this.logModel;
    }
    if (this.mongoInitPromise) {
      return this.mongoInitPromise;
    }
    this.mongoInitPromise = (async () => {
      try {
        this.mongoConnection = await mongoose
          .createConnection(this.config.MONGODB_URI, {
            serverSelectionTimeoutMS: 3000,
          })
          .asPromise();
        this.logModel =
          (this.mongoConnection.models.ActivityLog as Model<ActivityLogDocument>) ||
          this.mongoConnection.model<ActivityLogDocument>('ActivityLog', ActivityLogSchema);
        return this.logModel;
      } catch (err) {
        this.mongoInitPromise = null;
        throw err;
      }
    })();
    return this.mongoInitPromise;
  }

  private async initRabbitMqConsumer(): Promise<amqp.Channel> {
    if (this.rabbitChannel) {
      return this.rabbitChannel;
    }
    if (this.rabbitInitPromise) {
      return this.rabbitInitPromise;
    }
    this.rabbitInitPromise = (async () => {
      try {
        this.rabbitConnection = await amqp.connect(this.config.RABBITMQ_URL);
        const channel = await this.rabbitConnection.createChannel();
        await channel.assertQueue(QUEUES.LOG_QUEUE, { durable: true });

        await channel.consume(QUEUES.LOG_QUEUE, async (msg) => {
          if (!msg) return;
          try {
            const raw = msg.content.toString('utf-8');
            const parsed = JSON.parse(raw) as LogEventPayloadDto;
            const sanitizedData = sanitizeLogData(parsed.data ?? {}) as Record<
              string,
              unknown
            >;
            const model = await this.initMongo();
            await model.create({
              event: parsed.event ?? 'unknown',
              source: parsed.source ?? 'unknown',
              timestamp: parsed.timestamp ?? new Date().toISOString(),
              data: sanitizedData,
              receivedAt: new Date(),
            });
            channel.ack(msg);
          } catch (err) {
            console.error('Failed to process RabbitMQ log message:', err);
            channel.nack(msg, false, false);
          }
        });

        this.rabbitChannel = channel;
        return channel;
      } catch (err) {
        this.rabbitInitPromise = null;
        throw err;
      }
    })();
    return this.rabbitInitPromise;
  }

  async checkMongoHealth(): Promise<HealthDependencyStatus> {
    try {
      await this.initMongo();
      await this.mongoConnection?.db?.admin().ping();
      return { status: 'up' };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'MongoDB unreachable',
      };
    }
  }

  async checkRabbitMqHealth(): Promise<HealthDependencyStatus> {
    try {
      await this.initRabbitMqConsumer();
      return { status: 'up' };
    } catch (error) {
      this.rabbitChannel = null;
      this.rabbitConnection = null;
      this.rabbitInitPromise = null;
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'RabbitMQ unreachable',
      };
    }
  }

  async getRecentLogs(query: GetLogsQueryDto = {}) {
    const model = await this.initMongo();
    const limit = Math.min(
      200,
      Math.max(1, Number.parseInt(String(query.limit ?? '50'), 10) || 50),
    );

    const filter: FilterQuery<ActivityLogDocument> = {};
    if (typeof query.event === 'string' && query.event.trim()) {
      filter.event = query.event.trim();
    }
    if (typeof query.employeeId === 'string' && query.employeeId.trim()) {
      filter['data.employeeId'] = query.employeeId.trim();
    }
    if (typeof query.search === 'string' && query.search.trim()) {
      const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [
        { event: regex },
        { source: regex },
        { 'data.name': regex },
        { 'data.email': regex },
        { 'data.summary': regex },
      ];
    }

    const docs = await model
      .find(filter)
      .sort({ receivedAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    return {
      count: docs.length,
      data: docs,
    };
  }

  async onModuleDestroy() {
    try {
      await this.rabbitChannel?.close();
      await this.rabbitConnection?.close();
      await this.mongoConnection?.close();
    } catch {
      // ignore close errors
    }
  }
}
