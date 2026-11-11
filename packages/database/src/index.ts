import { Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { HealthDependencyStatus } from '@dexa-wfh/common';
import { loadEnvConfig } from '@dexa-wfh/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const config = loadEnvConfig();
    super({
      datasources: {
        db: {
          url: config.DATABASE_URL,
        },
      },
    });
  }

  async checkHealth(): Promise<HealthDependencyStatus> {
    try {
      await this.$queryRaw`SELECT 1`;
      return { status: 'up' };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  async onModuleDestroy() {
    await this.$disconnect().catch(() => undefined);
  }
}

@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}

export { PrismaClient };
