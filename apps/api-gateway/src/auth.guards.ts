import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  extractBearerToken,
  JwtPayloadDto,
  UserRole,
  verifyJwtToken,
} from '@dexa-wfh/common';
import { loadEnvConfig } from '@dexa-wfh/config';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export interface AuthenticatedRequest extends Request {
  user?: JwtPayloadDto;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly config = loadEnvConfig();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Bearer authentication token is required');
    }
    const payload = verifyJwtToken(token, this.config.JWT_SECRET);
    req.user = payload;
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user;
    if (!user || !user.role) {
      throw new UnauthorizedException('User authentication context is missing');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Access denied: requires role ${requiredRoles.join(' or ')}`,
      );
    }

    return true;
  }
}
