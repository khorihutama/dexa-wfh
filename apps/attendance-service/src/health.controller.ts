import { Controller, Get } from '@nestjs/common';
import { createHealthResponse, HealthStatusDto, SERVICES } from '@dexa-wfh/common';
import { PrismaService } from '@dexa-wfh/database';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async getHealth(): Promise<HealthStatusDto> {
    const postgres = await this.prisma.checkHealth();
    return createHealthResponse(SERVICES.ATTENDANCE_SERVICE, { postgres });
  }
}
