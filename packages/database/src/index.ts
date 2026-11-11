import { Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import {
  PrismaClient,
  Prisma,
  Role,
  AttendanceStatus,
  Employee,
  Attendance,
} from '@prisma/client';
import { EmployeeProfileDto, HealthDependencyStatus, UserRole } from '@dexa-wfh/common';
import { loadEnvConfig } from '@dexa-wfh/config';

export function toEmployeeProfileDto(employee: Employee): EmployeeProfileDto {
  return {
    id: employee.id,
    name: employee.name,
    email: employee.email,
    photoUrl: employee.photoUrl ?? null,
    position: employee.position,
    phone: employee.phone,
    role: employee.role as UserRole,
    createdAt: employee.createdAt.toISOString(),
    updatedAt: employee.updatedAt.toISOString(),
  };
}

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

export { PrismaClient, Prisma, Role, AttendanceStatus, Employee, Attendance };
