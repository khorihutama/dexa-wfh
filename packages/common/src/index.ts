import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

export const SERVICES = {
  API_GATEWAY: 'api-gateway',
  AUTH_SERVICE: 'auth-service',
  EMPLOYEE_SERVICE: 'employee-service',
  ATTENDANCE_SERVICE: 'attendance-service',
  LOG_SERVICE: 'log-service',
} as const;

export const QUEUES = {
  LOG_QUEUE: 'dexa_wfh_logs_queue',
} as const;

export const EVENTS = {
  PING: 'system.ping',
  ACTIVITY_LOG: 'system.activity_log',
  PROFILE_UPDATED: 'employee.profile_updated',
  ADMIN_NOTIFICATION: 'admin.notification',
} as const;

export type UserRole = 'EMPLOYEE' | 'ADMIN';
export type AttendanceStatusType = 'MASUK' | 'PULANG';

export interface JwtPayloadDto {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  position: string;
  iat?: number;
  exp?: number;
}

export interface EmployeeProfileDto {
  id: string;
  name: string;
  email: string;
  photoUrl: string | null;
  position: string;
  phone: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileUpdatedEventDataDto {
  employeeId: string;
  email: string;
  name: string;
  changedFields: string[];
  summary: string;
  changes: Record<string, { before?: string | null; after?: string | null }>;
  timestamp: string;
}

export interface DailyAttendanceSummaryDto {
  date: string;
  masuk: string | null;
  pulang: string | null;
  masukTimestamp: string | null;
  pulangTimestamp: string | null;
  status: 'COMPLETE' | 'WORKING';
}

export interface HealthDependencyStatus {
  status: 'up' | 'down';
  message?: string;
}

export interface HealthStatusDto {
  service: string;
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
  dependencies?: Record<string, HealthDependencyStatus>;
}

export interface AllServicesHealthDto {
  gateway: HealthStatusDto;
  services: Record<string, HealthStatusDto | { service: string; status: 'down'; error: string }>;
  overallStatus: 'ok' | 'degraded' | 'down';
  timestamp: string;
}

export interface LogEventPayloadDto {
  event: string;
  source: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export function createHealthResponse(
  service: string,
  dependencies?: Record<string, HealthDependencyStatus>,
): HealthStatusDto {
  const hasDown =
    dependencies &&
    Object.values(dependencies).some((dep) => dep.status === 'down');

  return {
    service,
    status: hasDown ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    ...(dependencies ? { dependencies } : {}),
  };
}

export async function hashPassword(plain: string, saltRounds = 10): Promise<string> {
  return bcrypt.hash(plain, saltRounds);
}

export async function verifyPassword(plain: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plain, passwordHash);
}

export function signJwtToken(
  payload: Omit<JwtPayloadDto, 'iat' | 'exp'>,
  secret: string,
  expiresIn = '8h',
): string {
  return jwt.sign(payload, secret, {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyJwtToken(token: string, secret: string): JwtPayloadDto {
  try {
    const decoded = jwt.verify(token, secret);
    if (!decoded || typeof decoded !== 'object' || !('sub' in decoded)) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return decoded as JwtPayloadDto;
  } catch (err) {
    if (err instanceof UnauthorizedException) {
      throw err;
    }
    throw new UnauthorizedException('Invalid or expired authentication token');
  }
}

export function extractBearerToken(authHeader?: string | string[]): string | null {
  if (!authHeader) return null;
  const raw = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!raw) return null;
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }
  return null;
}

const jakartaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const jakartaDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function getJakartaDateString(date: Date = new Date()): string {
  const parts = jakartaDateFormatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function getJakartaMonthStartString(date: Date = new Date()): string {
  const current = getJakartaDateString(date);
  return `${current.slice(0, 7)}-01`;
}

export function formatJakartaDateTime(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const parts = jakartaDateTimeFormatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

export interface UploadedFileLike {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
  fieldname?: string;
}

export async function saveUploadedAvatar(
  file: UploadedFileLike,
  uploadsDir: string,
  prefix = 'avatar',
): Promise<string> {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new BadRequestException('Uploaded image file is empty');
  }
  if (file.size > MAX_AVATAR_SIZE_BYTES || file.buffer.length > MAX_AVATAR_SIZE_BYTES) {
    throw new BadRequestException('Image file size exceeds the 5MB limit');
  }

  const mime = (file.mimetype || '').toLowerCase();
  const origExt = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_IMAGE_MIMES.has(mime) && !EXT_TO_CONTENT_TYPE[origExt]) {
    throw new BadRequestException(
      'Unsupported image format. Allowed formats: jpg, jpeg, png, webp',
    );
  }

  const ext = EXT_TO_CONTENT_TYPE[origExt] ? origExt : (MIME_TO_EXT[mime] ?? '.png');
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'avatar';
  const filename = `${safePrefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;

  const avatarsDir = path.resolve(uploadsDir, 'avatars');
  await fs.promises.mkdir(avatarsDir, { recursive: true });
  const targetPath = path.join(avatarsDir, filename);
  await fs.promises.writeFile(targetPath, file.buffer);

  return `/uploads/avatars/${filename}`;
}

export function resolveAvatarFilePath(
  filename: string,
  uploadsDir: string,
): { filePath: string; contentType: string } {
  const safeName = path.basename(filename);
  if (!safeName || safeName !== filename || safeName.startsWith('.')) {
    throw new BadRequestException('Invalid avatar filename');
  }
  const ext = path.extname(safeName).toLowerCase();
  const contentType = EXT_TO_CONTENT_TYPE[ext];
  if (!contentType) {
    throw new BadRequestException('Unsupported avatar image extension');
  }
  const avatarsDir = path.resolve(uploadsDir, 'avatars');
  const filePath = path.join(avatarsDir, safeName);
  return { filePath, contentType };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const message =
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
        ? (exceptionResponse as Record<string, unknown>).message
        : exceptionResponse;

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request?.url ?? '',
      message,
      error: exceptionResponse,
    });
  }
}
