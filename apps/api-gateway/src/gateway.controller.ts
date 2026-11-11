import * as fs from 'node:fs';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { HttpService } from '@nestjs/axios';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { firstValueFrom, Observable } from 'rxjs';
import { AxiosResponse } from 'axios';
import {
  AllServicesHealthDto,
  createHealthResponse,
  HealthStatusDto,
  MAX_AVATAR_SIZE_BYTES,
  ProfileUpdatedEventDataDto,
  resolveAvatarFilePath,
  saveUploadedAvatar,
  SERVICES,
  UploadedFileLike,
} from '@dexa-wfh/common';
import { loadEnvConfig } from '@dexa-wfh/config';
import { RabbitMqPublisherService } from './rabbitmq-publisher.service';
import { NotificationsGateway } from './notifications.gateway';
import {
  AuthenticatedRequest,
  JwtAuthGuard,
  Roles,
  RolesGuard,
} from './auth.guards';

export interface PingDto {
  message?: string;
}

export function validatePingDto(body?: PingDto): string {
  if (!body || body.message === undefined || body.message === null) {
    return 'Ping event from API Gateway';
  }
  if (typeof body.message !== 'string') {
    throw new BadRequestException('Field "message" must be a string');
  }
  const trimmed = body.message.trim();
  if (!trimmed) {
    throw new BadRequestException('Field "message" cannot be empty');
  }
  if (trimmed.length > 500) {
    throw new BadRequestException('Field "message" cannot exceed 500 characters');
  }
  return trimmed;
}

@ApiTags('Gateway, Auth, Employees, Attendances & Logs')
@Controller()
export class GatewayController {
  private readonly config = loadEnvConfig();

  constructor(
    private readonly httpService: HttpService,
    private readonly rabbitMqPublisher: RabbitMqPublisherService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  private async proxyRequest<T>(obs: Observable<AxiosResponse<T>>): Promise<T> {
    try {
      const response = await firstValueFrom(obs);
      return response.data;
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object'
      ) {
        const axiosRes = err.response as { status?: number; data?: unknown };
        const status = axiosRes.status ?? HttpStatus.BAD_GATEWAY;
        const data = axiosRes.data ?? 'Downstream service error';
        throw new HttpException(data as Record<string, unknown>, status);
      }
      throw new HttpException(
        err instanceof Error ? err.message : 'Downstream service unavailable',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private broadcastAttendanceResult(result: {
    employee?: { id: string; name: string; email: string };
    record: { status: string; formattedTime: string };
  }) {
    const statusLabel = result.record.status === 'MASUK' ? 'masuk' : 'pulang';
    this.notificationsGateway.broadcastNotification(
      `Absen ${result.record.status}`,
      `${result.employee?.name ?? 'Karyawan'} (${result.employee?.email ?? '-'}) tercatat absen ${statusLabel} pukul ${result.record.formattedTime} WIB`,
      {
        event: 'attendance.recorded',
        employeeId: result.employee?.id,
        employeeName: result.employee?.name,
        attendance: result.record,
      },
    );
    return result;
  }

  private buildInternalHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      'x-internal-key': this.config.INTERNAL_API_KEY,
      ...(extra ?? {}),
    };
  }

  private buildUserHeaders(req: AuthenticatedRequest): Record<string, string> {
    const headers: Record<string, string> = {
      'x-internal-key': this.config.INTERNAL_API_KEY,
    };
    if (req.user?.sub) {
      headers['x-user-id'] = req.user.sub;
    }
    if (req.user?.role) {
      headers['x-user-role'] = req.user.role;
    }
    if (typeof req.headers.authorization === 'string') {
      headers.authorization = req.headers.authorization;
    }
    return headers;
  }

  // ==================== HEALTH ====================

  @Get('health')
  @ApiOperation({ summary: 'Check API Gateway health and RabbitMQ producer status' })
  async getHealth(): Promise<HealthStatusDto> {
    const rabbitmq = await this.rabbitMqPublisher.checkHealth();
    return createHealthResponse(SERVICES.API_GATEWAY, { rabbitmq });
  }

  @Get('health/all')
  @ApiOperation({ summary: 'Aggregate health from all downstream microservices via HTTP REST' })
  async getAllHealth(): Promise<AllServicesHealthDto> {
    const gateway = await this.getHealth();

    const targets: Record<string, string> = {
      [SERVICES.AUTH_SERVICE]: `${this.config.AUTH_SERVICE_URL}/health`,
      [SERVICES.EMPLOYEE_SERVICE]: `${this.config.EMPLOYEE_SERVICE_URL}/health`,
      [SERVICES.ATTENDANCE_SERVICE]: `${this.config.ATTENDANCE_SERVICE_URL}/health`,
      [SERVICES.LOG_SERVICE]: `${this.config.LOG_SERVICE_URL}/health`,
    };

    const entries = await Promise.all(
      Object.entries(targets).map(async ([serviceName, url]) => {
        try {
          const response = await firstValueFrom(
            this.httpService.get<HealthStatusDto>(url, { timeout: 3000 }),
          );
          return [serviceName, response.data] as const;
        } catch (error) {
          return [
            serviceName,
            {
              service: serviceName,
              status: 'down' as const,
              error: error instanceof Error ? error.message : 'Service unreachable',
            },
          ] as const;
        }
      }),
    );

    const services: AllServicesHealthDto['services'] = Object.fromEntries(entries);
    const anyDown =
      gateway.status !== 'ok' ||
      Object.values(services).some((svc) => svc.status !== 'ok');

    return {
      gateway,
      services,
      overallStatus: anyDown ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  // ==================== STATIC AVATARS ====================

  @Get('uploads/avatars/:filename')
  @ApiOperation({ summary: 'Serve uploaded employee avatar image' })
  async serveAvatar(@Param('filename') filename: string, @Res() res: Response) {
    const { filePath, contentType } = resolveAvatarFilePath(
      filename,
      this.config.UPLOADS_DIR,
    );
    if (fs.existsSync(filePath)) {
      const buffer = await fs.promises.readFile(filePath);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.status(HttpStatus.OK).send(buffer);
      return;
    }

    try {
      const downstream = await firstValueFrom(
        this.httpService.get<ArrayBuffer>(
          `${this.config.EMPLOYEE_SERVICE_URL}/uploads/avatars/${encodeURIComponent(filename)}`,
          { responseType: 'arraybuffer', timeout: 5000 },
        ),
      );
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.status(HttpStatus.OK).send(Buffer.from(downstream.data));
    } catch {
      throw new NotFoundException('Avatar image not found');
    }
  }

  // ==================== AUTH SERVICE PROXY ====================

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user with email & password and issue JWT token' })
  async login(@Body() body: Record<string, unknown>) {
    return this.proxyRequest(
      this.httpService.post(`${this.config.AUTH_SERVICE_URL}/auth/login`, body, {
        headers: this.buildInternalHeaders(),
        timeout: 5000,
      }),
    );
  }

  @Get('auth/validate')
  @ApiOperation({ summary: 'Validate JWT token via GET' })
  async validateGet(
    @Headers('authorization') authHeader?: string,
    @Query('token') token?: string,
  ) {
    return this.proxyRequest(
      this.httpService.get(`${this.config.AUTH_SERVICE_URL}/auth/validate`, {
        headers: this.buildInternalHeaders(
          authHeader ? { authorization: authHeader } : undefined,
        ),
        params: token ? { token } : {},
        timeout: 5000,
      }),
    );
  }

  @Post('auth/validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate JWT token via POST' })
  async validatePost(
    @Headers('authorization') authHeader?: string,
    @Body() body?: Record<string, unknown>,
  ) {
    return this.proxyRequest(
      this.httpService.post(`${this.config.AUTH_SERVICE_URL}/auth/validate`, body ?? {}, {
        headers: this.buildInternalHeaders(
          authHeader ? { authorization: authHeader } : undefined,
        ),
        timeout: 5000,
      }),
    );
  }

  @Get('auth/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get authenticated user profile from auth-service' })
  async getAuthMe(@Req() req: AuthenticatedRequest) {
    return this.proxyRequest(
      this.httpService.get(`${this.config.AUTH_SERVICE_URL}/auth/me`, {
        headers: this.buildUserHeaders(req),
        timeout: 5000,
      }),
    );
  }

  @Patch('auth/password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update authenticated account password' })
  async updatePassword(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.proxyRequest(
      this.httpService.patch(`${this.config.AUTH_SERVICE_URL}/auth/password`, body, {
        headers: this.buildUserHeaders(req),
        timeout: 5000,
      }),
    );
  }

  // ==================== EMPLOYEE PROFILE (SELF) ====================

  @Get('employees/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get logged-in employee profile' })
  async getMyEmployeeProfile(@Req() req: AuthenticatedRequest) {
    return this.proxyRequest(
      this.httpService.get(`${this.config.EMPLOYEE_SERVICE_URL}/employees/me`, {
        headers: this.buildUserHeaders(req),
        timeout: 5000,
      }),
    );
  }

  @Patch('employees/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
    }),
  )
  @ApiOperation({
    summary: 'Update logged-in employee profile (phone, photo file/URL, password) and notify Admin HRD',
  })
  async patchMyEmployeeProfile(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files?: UploadedFileLike[],
  ) {
    const payload: Record<string, unknown> = { ...(body ?? {}) };
    if (files && files.length > 0) {
      payload.photoUrl = await saveUploadedAvatar(
        files[0],
        this.config.UPLOADS_DIR,
        (req.user?.sub ?? 'emp').slice(0, 8),
      );
    }
    return this.proxyRequest(
      this.httpService.patch(`${this.config.EMPLOYEE_SERVICE_URL}/employees/me`, payload, {
        headers: this.buildUserHeaders(req),
        timeout: 8000,
      }),
    );
  }

  @Put('employees/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
    }),
  )
  @ApiOperation({ summary: 'Update logged-in employee profile via PUT' })
  async putMyEmployeeProfile(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files?: UploadedFileLike[],
  ) {
    return this.patchMyEmployeeProfile(req, body, files);
  }

  @Post('employees/me/photo')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
    }),
  )
  @ApiOperation({ summary: 'Upload or update logged-in employee avatar photo' })
  async uploadMyPhoto(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files?: UploadedFileLike[],
  ) {
    const payload: Record<string, unknown> = { ...(body ?? {}) };
    if (files && files.length > 0) {
      payload.photoUrl = await saveUploadedAvatar(
        files[0],
        this.config.UPLOADS_DIR,
        (req.user?.sub ?? 'emp').slice(0, 8),
      );
    }
    return this.proxyRequest(
      this.httpService.post(
        `${this.config.EMPLOYEE_SERVICE_URL}/employees/me/photo`,
        payload,
        {
          headers: this.buildUserHeaders(req),
          timeout: 8000,
        },
      ),
    );
  }

  // ==================== ADMIN HRD EMPLOYEE CRUD ====================

  @Get('employees')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all employees (Admin HRD only)' })
  async listEmployees(
    @Req() req: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.proxyRequest(
      this.httpService.get(`${this.config.EMPLOYEE_SERVICE_URL}/employees`, {
        headers: this.buildUserHeaders(req),
        params: query,
        timeout: 5000,
      }),
    );
  }

  @Get('employees/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get employee details by ID (Admin HRD only)' })
  async getEmployeeById(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.proxyRequest(
      this.httpService.get(
        `${this.config.EMPLOYEE_SERVICE_URL}/employees/${encodeURIComponent(id)}`,
        {
          headers: this.buildUserHeaders(req),
          timeout: 5000,
        },
      ),
    );
  }

  @Post('employees')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
    }),
  )
  @ApiOperation({ summary: 'Create new employee (Admin HRD only)' })
  async createEmployee(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files?: UploadedFileLike[],
  ) {
    const payload: Record<string, unknown> = { ...(body ?? {}) };
    if (files && files.length > 0) {
      payload.photoUrl = await saveUploadedAvatar(
        files[0],
        this.config.UPLOADS_DIR,
        'emp',
      );
    }
    return this.proxyRequest(
      this.httpService.post(`${this.config.EMPLOYEE_SERVICE_URL}/employees`, payload, {
        headers: this.buildUserHeaders(req),
        timeout: 8000,
      }),
    );
  }

  @Patch('employees/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
    }),
  )
  @ApiOperation({ summary: 'Update employee data by ID (Admin HRD only)' })
  async patchEmployee(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files?: UploadedFileLike[],
  ) {
    const payload: Record<string, unknown> = { ...(body ?? {}) };
    if (files && files.length > 0) {
      payload.photoUrl = await saveUploadedAvatar(
        files[0],
        this.config.UPLOADS_DIR,
        id.slice(0, 8),
      );
    }
    return this.proxyRequest(
      this.httpService.patch(
        `${this.config.EMPLOYEE_SERVICE_URL}/employees/${encodeURIComponent(id)}`,
        payload,
        {
          headers: this.buildUserHeaders(req),
          timeout: 8000,
        },
      ),
    );
  }

  @Put('employees/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
    }),
  )
  @ApiOperation({ summary: 'Update employee data by ID via PUT (Admin HRD only)' })
  async putEmployee(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files?: UploadedFileLike[],
  ) {
    return this.patchEmployee(req, id, body, files);
  }

  @Delete('employees/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete employee by ID (Admin HRD only, prevents self-deletion)' })
  async deleteEmployee(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.proxyRequest(
      this.httpService.delete(
        `${this.config.EMPLOYEE_SERVICE_URL}/employees/${encodeURIComponent(id)}`,
        {
          headers: this.buildUserHeaders(req),
          timeout: 5000,
        },
      ),
    );
  }

  // ==================== ATTENDANCE SERVICE PROXY ====================

  @Post('attendances/check-in')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record WFH check-in (MASUK) for today (Asia/Jakarta)' })
  async checkIn(@Req() req: AuthenticatedRequest) {
    return this.broadcastAttendanceResult(
      await this.proxyRequest<{
        employee?: { id: string; name: string; email: string };
        record: { status: string; formattedTime: string };
      }>(
        this.httpService.post(
          `${this.config.ATTENDANCE_SERVICE_URL}/attendances/check-in`,
          {},
          {
            headers: this.buildUserHeaders(req),
            timeout: 5000,
          },
        ),
      ),
    );
  }

  @Post('attendances/check-out')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record WFH check-out (PULANG) for today (Asia/Jakarta)' })
  async checkOut(@Req() req: AuthenticatedRequest) {
    return this.broadcastAttendanceResult(
      await this.proxyRequest<{
        employee?: { id: string; name: string; email: string };
        record: { status: string; formattedTime: string };
      }>(
        this.httpService.post(
          `${this.config.ATTENDANCE_SERVICE_URL}/attendances/check-out`,
          {},
          {
            headers: this.buildUserHeaders(req),
            timeout: 5000,
          },
        ),
      ),
    );
  }

  @Post('attendances')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record WFH attendance by status (MASUK or PULANG)' })
  async recordAttendance(
    @Req() req: AuthenticatedRequest,
    @Body() body: { status?: string },
  ) {
    return this.proxyRequest(
      this.httpService.post(
        `${this.config.ATTENDANCE_SERVICE_URL}/attendances`,
        body ?? {},
        {
          headers: this.buildUserHeaders(req),
          timeout: 5000,
        },
      ),
    );
  }

  @Get('attendances/today')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get logged-in employee attendance status for today' })
  async getTodayAttendance(@Req() req: AuthenticatedRequest) {
    return this.proxyRequest(
      this.httpService.get(`${this.config.ATTENDANCE_SERVICE_URL}/attendances/today`, {
        headers: this.buildUserHeaders(req),
        timeout: 5000,
      }),
    );
  }

  @Get('attendances/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get logged-in employee paired attendance summary (default: current month to today)',
  })
  async getMyAttendances(
    @Req() req: AuthenticatedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.proxyRequest(
      this.httpService.get(`${this.config.ATTENDANCE_SERVICE_URL}/attendances/me`, {
        headers: this.buildUserHeaders(req),
        params: {
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
        timeout: 5000,
      }),
    );
  }

  @Get('attendances')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Monitor all employees WFH attendance (Admin HRD Read-Only)' })
  async getAllAttendances(
    @Req() req: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.proxyRequest(
      this.httpService.get(`${this.config.ATTENDANCE_SERVICE_URL}/attendances`, {
        headers: this.buildUserHeaders(req),
        params: query,
        timeout: 5000,
      }),
    );
  }

  // ==================== INTERNAL NOTIFICATIONS & LOGS ====================

  @Post('internal/notifications/profile-updated')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Internal webhook for employee-service to emit Socket.IO admin.notification' })
  async handleProfileUpdatedWebhook(
    @Headers('x-internal-key') internalKey: string | undefined,
    @Body() body: ProfileUpdatedEventDataDto,
  ) {
    if (internalKey !== this.config.INTERNAL_API_KEY) {
      throw new UnauthorizedException('Invalid internal service key');
    }
    const notification = this.notificationsGateway.broadcastProfileUpdated(body);
    return {
      broadcasted: true,
      notification,
    };
  }

  @Post('ping')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Publish a sample ping event to RabbitMQ and broadcast Socket.IO toast (Admin HRD only)',
  })
  async sendPing(@Body() body?: PingDto) {
    const message = validatePingDto(body);
    const eventPayload = await this.rabbitMqPublisher.publishPing(message);
    this.notificationsGateway.broadcastNotification(
      'RabbitMQ Ping Dispatched',
      message,
    );
    return {
      dispatched: true,
      queue: 'dexa_wfh_logs_queue',
      payload: eventPayload,
    };
  }

  @Get('logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Proxy GET /logs from log-service (Admin HRD only)' })
  async getLogs(@Query() query: Record<string, unknown>) {
    return this.proxyRequest(
      this.httpService.get(`${this.config.LOG_SERVICE_URL}/logs`, {
        headers: this.buildInternalHeaders(),
        params: query,
        timeout: 5000,
      }),
    );
  }
}
