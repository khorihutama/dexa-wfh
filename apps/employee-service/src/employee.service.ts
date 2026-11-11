import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  EmployeeProfileDto,
  extractBearerToken,
  hashPassword,
  ProfileUpdatedEventDataDto,
  saveUploadedAvatar,
  UploadedFileLike,
  UserRole,
  verifyJwtToken,
  verifyPassword,
} from '@dexa-wfh/common';
import { loadEnvConfig } from '@dexa-wfh/config';
import { Prisma, PrismaService, Role, toEmployeeProfileDto } from '@dexa-wfh/database';
import { EmployeeEventsService } from './employee-events.service';

export interface UpdateSelfProfileDto {
  phone?: string;
  photoUrl?: string;
  currentPassword?: string;
  newPassword?: string;
  password?: string;
}

export interface CreateEmployeeDto {
  name?: string;
  email?: string;
  password?: string;
  position?: string;
  phone?: string;
  photoUrl?: string | null;
  role?: UserRole;
}

export interface UpdateEmployeeByAdminDto {
  name?: string;
  email?: string;
  password?: string;
  newPassword?: string;
  position?: string;
  phone?: string;
  photoUrl?: string | null;
  role?: UserRole;
}

export interface ListEmployeesQueryDto {
  search?: string;
  role?: string;
  page?: string | number;
  limit?: string | number;
}

@Injectable()
export class EmployeeService {
  private readonly config = loadEnvConfig();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EmployeeEventsService,
  ) {}

  resolveUserId(input: { userId?: string; authHeader?: string | string[] }): string {
    if (input.userId && typeof input.userId === 'string' && input.userId.trim()) {
      return input.userId.trim();
    }
    const token = extractBearerToken(input.authHeader);
    if (!token) {
      throw new UnauthorizedException('Authentication credentials are required');
    }
    const payload = verifyJwtToken(token, this.config.JWT_SECRET);
    return payload.sub;
  }

  async getMyProfile(auth: {
    userId?: string;
    authHeader?: string | string[];
  }): Promise<EmployeeProfileDto> {
    const employeeId = this.resolveUserId(auth);
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException('Employee profile not found');
    }
    return toEmployeeProfileDto(employee);
  }

  async updateMyProfile(
    auth: { userId?: string; authHeader?: string | string[] },
    dto: UpdateSelfProfileDto,
    uploadedFile?: UploadedFileLike,
  ): Promise<
    EmployeeProfileDto & {
      changedFields: string[];
      notificationDispatched: boolean;
    }
  > {
    const employeeId = this.resolveUserId(auth);
    const existing = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!existing) {
      throw new NotFoundException('Employee profile not found');
    }

    const updateData: Prisma.EmployeeUpdateInput = {};
    const changedFields: string[] = [];
    const changes: Record<string, { before?: string | null; after?: string | null }> = {};

    if (uploadedFile) {
      const savedUrl = await saveUploadedAvatar(
        uploadedFile,
        this.config.UPLOADS_DIR,
        existing.id.slice(0, 8),
      );
      updateData.photoUrl = savedUrl;
      changedFields.push('photoUrl');
      changes.photoUrl = { before: existing.photoUrl, after: savedUrl };
    } else if (typeof dto?.photoUrl === 'string' && dto.photoUrl.trim().length > 0) {
      const nextPhoto = dto.photoUrl.trim();
      if (nextPhoto !== existing.photoUrl) {
        updateData.photoUrl = nextPhoto;
        changedFields.push('photoUrl');
        changes.photoUrl = { before: existing.photoUrl, after: nextPhoto };
      }
    }

    if (typeof dto?.phone === 'string' && dto.phone.trim().length > 0) {
      const nextPhone = dto.phone.trim();
      if (nextPhone !== existing.phone) {
        updateData.phone = nextPhone;
        changedFields.push('phone');
        changes.phone = { before: existing.phone, after: nextPhone };
      }
    }

    const rawNewPassword =
      typeof dto?.newPassword === 'string' && dto.newPassword.length > 0
        ? dto.newPassword
        : typeof dto?.password === 'string' && dto.password.length > 0
          ? dto.password
          : '';

    if (rawNewPassword) {
      if (rawNewPassword.length < 6) {
        throw new BadRequestException('New password must be at least 6 characters');
      }
      if (typeof dto?.currentPassword !== 'string' || dto.currentPassword.length === 0) {
        throw new BadRequestException('Current password is required to change password');
      }
      const isCurrentValid = await verifyPassword(
        dto.currentPassword,
        existing.passwordHash,
      );
      if (!isCurrentValid) {
        throw new BadRequestException('Current password is incorrect');
      }
      updateData.passwordHash = await hashPassword(rawNewPassword);
      changedFields.push('password');
      changes.password = { before: '[REDACTED]', after: '[REDACTED]' };
    }

    if (changedFields.length === 0) {
      throw new BadRequestException(
        'No profile changes provided (provide phone, photo file/photoUrl, or newPassword)',
      );
    }

    const updated = await this.prisma.employee.update({
      where: { id: existing.id },
      data: updateData,
    });

    const timestamp = new Date().toISOString();
    const eventData: ProfileUpdatedEventDataDto = {
      employeeId: updated.id,
      email: updated.email,
      name: updated.name,
      changedFields,
      summary: `${updated.name} (${updated.email}) updated profile fields: ${changedFields.join(', ')}`,
      changes,
      timestamp,
    };

    const dispatchResult = await this.eventsService.publishProfileUpdated(eventData);

    return {
      ...toEmployeeProfileDto(updated),
      changedFields,
      notificationDispatched:
        dispatchResult.rabbitMqDispatched || dispatchResult.gatewayNotified,
    };
  }

  async updateMyPhoto(
    auth: { userId?: string; authHeader?: string | string[] },
    dto?: { photoUrl?: string },
    uploadedFile?: UploadedFileLike,
  ) {
    if (!uploadedFile && (!dto?.photoUrl || !dto.photoUrl.trim())) {
      throw new BadRequestException(
        'Please upload an image file (jpg/jpeg/png/webp, max 5MB) or provide photoUrl',
      );
    }
    return this.updateMyProfile(auth, { photoUrl: dto?.photoUrl }, uploadedFile);
  }

  async listEmployees(query: ListEmployeesQueryDto) {
    const page = Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(String(query.limit ?? '20'), 10) || 20),
    );
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const roleFilter =
      query.role === Role.ADMIN || query.role === Role.EMPLOYEE
        ? (query.role as Role)
        : undefined;

    const where: Prisma.EmployeeWhereInput = {
      ...(roleFilter ? { role: roleFilter } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { position: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      data: rows.map(toEmployeeProfileDto),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getEmployeeById(id: string): Promise<EmployeeProfileDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
    });
    if (!employee) {
      throw new NotFoundException(`Employee with id ${id} not found`);
    }
    return toEmployeeProfileDto(employee);
  }

  async createEmployee(
    dto: CreateEmployeeDto,
    uploadedFile?: UploadedFileLike,
  ): Promise<EmployeeProfileDto> {
    const name = typeof dto?.name === 'string' ? dto.name.trim() : '';
    const email = typeof dto?.email === 'string' ? dto.email.trim().toLowerCase() : '';
    const password = typeof dto?.password === 'string' ? dto.password : '';
    const position = typeof dto?.position === 'string' ? dto.position.trim() : '';
    const phone = typeof dto?.phone === 'string' ? dto.phone.trim() : '';
    const role: Role = dto?.role === 'ADMIN' ? Role.ADMIN : Role.EMPLOYEE;

    if (!name || !email || !password || !position || !phone) {
      throw new BadRequestException(
        'Fields name, email, password, position, and phone are required',
      );
    }
    if (password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    const existing = await this.prisma.employee.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException(`Employee with email ${email} already exists`);
    }

    let photoUrl: string | null =
      typeof dto?.photoUrl === 'string' && dto.photoUrl.trim().length > 0
        ? dto.photoUrl.trim()
        : null;

    if (uploadedFile) {
      photoUrl = await saveUploadedAvatar(uploadedFile, this.config.UPLOADS_DIR, 'emp');
    }

    const passwordHash = await hashPassword(password);
    const created = await this.prisma.employee.create({
      data: {
        name,
        email,
        passwordHash,
        position,
        phone,
        photoUrl,
        role,
      },
    });

    return toEmployeeProfileDto(created);
  }

  async updateEmployeeByAdmin(
    id: string,
    dto: UpdateEmployeeByAdminDto,
    uploadedFile?: UploadedFileLike,
  ): Promise<EmployeeProfileDto> {
    const existing = await this.prisma.employee.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Employee with id ${id} not found`);
    }

    const data: Prisma.EmployeeUpdateInput = {};

    if (typeof dto?.name === 'string' && dto.name.trim()) {
      data.name = dto.name.trim();
    }
    if (typeof dto?.email === 'string' && dto.email.trim()) {
      const nextEmail = dto.email.trim().toLowerCase();
      if (nextEmail !== existing.email) {
        const emailConflict = await this.prisma.employee.findUnique({
          where: { email: nextEmail },
        });
        if (emailConflict) {
          throw new ConflictException(`Employee with email ${nextEmail} already exists`);
        }
        data.email = nextEmail;
      }
    }
    if (typeof dto?.position === 'string' && dto.position.trim()) {
      data.position = dto.position.trim();
    }
    if (typeof dto?.phone === 'string' && dto.phone.trim()) {
      data.phone = dto.phone.trim();
    }
    if (dto?.role === 'ADMIN' || dto?.role === 'EMPLOYEE') {
      data.role = dto.role === 'ADMIN' ? Role.ADMIN : Role.EMPLOYEE;
    }

    if (uploadedFile) {
      data.photoUrl = await saveUploadedAvatar(
        uploadedFile,
        this.config.UPLOADS_DIR,
        existing.id.slice(0, 8),
      );
    } else if (typeof dto?.photoUrl === 'string' && dto.photoUrl.trim().length > 0) {
      data.photoUrl = dto.photoUrl.trim();
    } else if (dto?.photoUrl === null) {
      data.photoUrl = null;
    }

    const rawPassword =
      typeof dto?.newPassword === 'string' && dto.newPassword.length > 0
        ? dto.newPassword
        : typeof dto?.password === 'string' && dto.password.length > 0
          ? dto.password
          : '';

    if (rawPassword) {
      if (rawPassword.length < 6) {
        throw new BadRequestException('Password must be at least 6 characters');
      }
      data.passwordHash = await hashPassword(rawPassword);
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data,
    });

    return toEmployeeProfileDto(updated);
  }

  async deleteEmployeeByAdmin(
    id: string,
    requester?: { userId?: string; authHeader?: string | string[] },
  ): Promise<{ deleted: true; id: string; email: string }> {
    let requesterId = requester?.userId?.trim();
    if (!requesterId && requester?.authHeader) {
      try {
        requesterId = this.resolveUserId(requester);
      } catch {
        // ignore if no valid header
      }
    }

    if (requesterId && requesterId === id) {
      throw new BadRequestException('Admin cannot delete their own currently logged-in account');
    }

    const existing = await this.prisma.employee.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Employee with id ${id} not found`);
    }

    await this.prisma.employee.delete({
      where: { id },
    });

    return {
      deleted: true,
      id: existing.id,
      email: existing.email,
    };
  }
}
