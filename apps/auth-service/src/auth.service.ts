import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  EmployeeProfileDto,
  extractBearerToken,
  hashPassword,
  JwtPayloadDto,
  signJwtToken,
  verifyJwtToken,
  verifyPassword,
} from '@dexa-wfh/common';
import { loadEnvConfig } from '@dexa-wfh/config';
import { PrismaService, toEmployeeProfileDto } from '@dexa-wfh/database';

export interface LoginDto {
  email?: string;
  password?: string;
}

export interface ChangePasswordDto {
  userId?: string;
  currentPassword?: string;
  newPassword?: string;
  password?: string;
}

export interface LoginResponseDto {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: EmployeeProfileDto;
}

@Injectable()
export class AuthService {
  private readonly config = loadEnvConfig();

  constructor(private readonly prisma: PrismaService) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const email = typeof dto?.email === 'string' ? dto.email.trim().toLowerCase() : '';
    const password = typeof dto?.password === 'string' ? dto.password : '';

    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { email },
    });

    if (!employee) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await verifyPassword(password, employee.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const userProfile = toEmployeeProfileDto(employee);
    const accessToken = signJwtToken(
      {
        sub: userProfile.id,
        email: userProfile.email,
        name: userProfile.name,
        role: userProfile.role,
        position: userProfile.position,
      },
      this.config.JWT_SECRET,
      this.config.JWT_EXPIRES_IN,
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.JWT_EXPIRES_IN,
      user: userProfile,
    };
  }

  async validateToken(token: string | null | undefined): Promise<{
    valid: true;
    payload: JwtPayloadDto;
    user: EmployeeProfileDto;
  }> {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Authentication token is required');
    }

    const decoded = verifyJwtToken(token, this.config.JWT_SECRET);
    const employee = await this.prisma.employee.findUnique({
      where: { id: decoded.sub },
    });

    if (!employee) {
      throw new UnauthorizedException('User account no longer exists');
    }

    const user = toEmployeeProfileDto(employee);
    return {
      valid: true,
      payload: {
        ...decoded,
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        position: user.position,
      },
      user,
    };
  }

  async getMe(userIdOrHeader: {
    userId?: string;
    authHeader?: string | string[];
  }): Promise<EmployeeProfileDto> {
    const resolvedUserId = this.resolveUserId(userIdOrHeader);
    const employee = await this.prisma.employee.findUnique({
      where: { id: resolvedUserId },
    });
    if (!employee) {
      throw new NotFoundException('Employee account not found');
    }
    return toEmployeeProfileDto(employee);
  }

  async updatePassword(
    userIdOrHeader: { userId?: string; authHeader?: string | string[] },
    dto: ChangePasswordDto,
  ): Promise<{ updated: true; message: string }> {
    const resolvedUserId = dto?.userId || this.resolveUserId(userIdOrHeader);
    const nextPassword =
      typeof dto?.newPassword === 'string' && dto.newPassword.length > 0
        ? dto.newPassword
        : typeof dto?.password === 'string'
          ? dto.password
          : '';

    if (!nextPassword || nextPassword.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: resolvedUserId },
    });
    if (!employee) {
      throw new NotFoundException('Employee account not found');
    }

    if (typeof dto?.currentPassword === 'string' && dto.currentPassword.length > 0) {
      const validCurrent = await verifyPassword(dto.currentPassword, employee.passwordHash);
      if (!validCurrent) {
        throw new BadRequestException('Current password is incorrect');
      }
    }

    const passwordHash = await hashPassword(nextPassword);
    await this.prisma.employee.update({
      where: { id: employee.id },
      data: { passwordHash },
    });

    return {
      updated: true,
      message: 'Password updated successfully',
    };
  }

  private resolveUserId(input: { userId?: string; authHeader?: string | string[] }): string {
    if (input.userId && typeof input.userId === 'string' && input.userId.trim()) {
      return input.userId.trim();
    }
    const token = extractBearerToken(input.authHeader);
    if (!token) {
      throw new UnauthorizedException('Missing authentication credentials');
    }
    const payload = verifyJwtToken(token, this.config.JWT_SECRET);
    return payload.sub;
  }
}
