import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AttendanceStatusType,
  DailyAttendanceSummaryDto,
  extractBearerToken,
  formatJakartaDateTime,
  getJakartaDateString,
  getJakartaMonthStartString,
  isValidDateString,
  verifyJwtToken,
} from '@dexa-wfh/common';
import { loadEnvConfig } from '@dexa-wfh/config';
import { Attendance, AttendanceStatus, Prisma, PrismaService } from '@dexa-wfh/database';

export interface AttendanceQueryDto {
  from?: string;
  to?: string;
  employeeId?: string;
  search?: string;
  status?: string;
  page?: string | number;
  limit?: string | number;
}

export interface FormattedAttendanceRecordDto {
  id: string;
  employeeId: string;
  date: string;
  status: AttendanceStatusType;
  timestamp: string;
  formattedTime: string;
}

export interface AdminDailyPairDto {
  id: string;
  employeeId: string;
  employee: {
    id: string;
    name: string;
    email: string;
    position: string;
    phone: string;
    photoUrl: string | null;
    role: string;
  };
  date: string;
  masuk: string | null;
  pulang: string | null;
  masukTimestamp: string | null;
  pulangTimestamp: string | null;
  status: 'COMPLETE' | 'WORKING';
}

@Injectable()
export class AttendanceService {
  private readonly config = loadEnvConfig();

  constructor(private readonly prisma: PrismaService) {}

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

  private formatRecord(record: Attendance): FormattedAttendanceRecordDto {
    return {
      id: record.id,
      employeeId: record.employeeId,
      date: record.date,
      status: record.status as AttendanceStatusType,
      timestamp: record.timestamp.toISOString(),
      formattedTime: formatJakartaDateTime(record.timestamp),
    };
  }

  private resolveDateRange(from?: string, to?: string): { from: string; to: string } {
    const resolvedFrom =
      typeof from === 'string' && from.trim()
        ? from.trim()
        : getJakartaMonthStartString();
    const resolvedTo =
      typeof to === 'string' && to.trim() ? to.trim() : getJakartaDateString();

    if (!isValidDateString(resolvedFrom) || !isValidDateString(resolvedTo)) {
      throw new BadRequestException('Date filter must use YYYY-MM-DD format');
    }
    if (resolvedFrom > resolvedTo) {
      throw new BadRequestException('Filter "from" date cannot be after "to" date');
    }

    return { from: resolvedFrom, to: resolvedTo };
  }

  async checkIn(auth: { userId?: string; authHeader?: string | string[] }) {
    const employeeId = this.resolveUserId(auth);
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException('Employee account not found');
    }

    const now = new Date();
    const today = getJakartaDateString(now);

    const existingCheckIn = await this.prisma.attendance.findUnique({
      where: {
        employeeId_date_status: {
          employeeId,
          date: today,
          status: AttendanceStatus.MASUK,
        },
      },
    });

    if (existingCheckIn) {
      throw new ConflictException(
        `Already checked in (MASUK) for today (${today}) at ${formatJakartaDateTime(existingCheckIn.timestamp)}`,
      );
    }

    const created = await this.prisma.attendance.create({
      data: {
        employeeId,
        date: today,
        status: AttendanceStatus.MASUK,
        timestamp: now,
      },
    });

    return {
      message: 'Check-in (MASUK) recorded successfully',
      record: this.formatRecord(created),
      todayStatus: await this.getTodayStatusForEmployee(employeeId),
    };
  }

  async checkOut(auth: { userId?: string; authHeader?: string | string[] }) {
    const employeeId = this.resolveUserId(auth);
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException('Employee account not found');
    }

    const now = new Date();
    const today = getJakartaDateString(now);

    const existingCheckIn = await this.prisma.attendance.findUnique({
      where: {
        employeeId_date_status: {
          employeeId,
          date: today,
          status: AttendanceStatus.MASUK,
        },
      },
    });

    if (!existingCheckIn) {
      throw new BadRequestException(
        `Cannot check out (PULANG) before checking in (MASUK) for today (${today})`,
      );
    }

    const existingCheckOut = await this.prisma.attendance.findUnique({
      where: {
        employeeId_date_status: {
          employeeId,
          date: today,
          status: AttendanceStatus.PULANG,
        },
      },
    });

    if (existingCheckOut) {
      throw new ConflictException(
        `Already checked out (PULANG) for today (${today}) at ${formatJakartaDateTime(existingCheckOut.timestamp)}`,
      );
    }

    const created = await this.prisma.attendance.create({
      data: {
        employeeId,
        date: today,
        status: AttendanceStatus.PULANG,
        timestamp: now,
      },
    });

    return {
      message: 'Check-out (PULANG) recorded successfully',
      record: this.formatRecord(created),
      todayStatus: await this.getTodayStatusForEmployee(employeeId),
    };
  }

  async recordByStatus(
    auth: { userId?: string; authHeader?: string | string[] },
    statusInput?: string,
  ) {
    const normalized = typeof statusInput === 'string' ? statusInput.trim().toUpperCase() : '';
    if (normalized === AttendanceStatus.MASUK) {
      return this.checkIn(auth);
    }
    if (normalized === AttendanceStatus.PULANG) {
      return this.checkOut(auth);
    }
    throw new BadRequestException('Attendance status must be either MASUK or PULANG');
  }

  async getTodayStatus(auth: { userId?: string; authHeader?: string | string[] }) {
    const employeeId = this.resolveUserId(auth);
    return this.getTodayStatusForEmployee(employeeId);
  }

  private async getTodayStatusForEmployee(employeeId: string) {
    const today = getJakartaDateString();
    const records = await this.prisma.attendance.findMany({
      where: {
        employeeId,
        date: today,
      },
      orderBy: { timestamp: 'asc' },
    });

    const masukRecord = records.find((r) => r.status === AttendanceStatus.MASUK);
    const pulangRecord = records.find((r) => r.status === AttendanceStatus.PULANG);

    return {
      date: today,
      timezone: 'Asia/Jakarta',
      hasCheckedIn: Boolean(masukRecord),
      hasCheckedOut: Boolean(pulangRecord),
      masuk: masukRecord ? formatJakartaDateTime(masukRecord.timestamp) : null,
      pulang: pulangRecord ? formatJakartaDateTime(pulangRecord.timestamp) : null,
      masukTimestamp: masukRecord ? masukRecord.timestamp.toISOString() : null,
      pulangTimestamp: pulangRecord ? pulangRecord.timestamp.toISOString() : null,
      records: records.map((r) => this.formatRecord(r)),
    };
  }

  async getMyAttendanceSummary(
    auth: { userId?: string; authHeader?: string | string[] },
    query: { from?: string; to?: string },
  ) {
    const employeeId = this.resolveUserId(auth);
    const range = this.resolveDateRange(query.from, query.to);

    const records = await this.prisma.attendance.findMany({
      where: {
        employeeId,
        date: {
          gte: range.from,
          lte: range.to,
        },
      },
      orderBy: [{ date: 'desc' }, { timestamp: 'asc' }],
    });

    const byDate = new Map<string, DailyAttendanceSummaryDto>();
    for (const rec of records) {
      let entry = byDate.get(rec.date);
      if (!entry) {
        entry = {
          date: rec.date,
          masuk: null,
          pulang: null,
          masukTimestamp: null,
          pulangTimestamp: null,
          status: 'WORKING',
        };
        byDate.set(rec.date, entry);
      }
      if (rec.status === AttendanceStatus.MASUK) {
        entry.masuk = formatJakartaDateTime(rec.timestamp);
        entry.masukTimestamp = rec.timestamp.toISOString();
      } else if (rec.status === AttendanceStatus.PULANG) {
        entry.pulang = formatJakartaDateTime(rec.timestamp);
        entry.pulangTimestamp = rec.timestamp.toISOString();
      }
      entry.status = entry.masuk && entry.pulang ? 'COMPLETE' : 'WORKING';
    }

    const summary = Array.from(byDate.values()).sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    const todayStatus = await this.getTodayStatusForEmployee(employeeId);

    return {
      employeeId,
      filter: {
        from: range.from,
        to: range.to,
        timezone: 'Asia/Jakarta',
      },
      todayStatus,
      summary,
      data: summary,
      records: records.map((r) => this.formatRecord(r)),
    };
  }

  async getAllAttendancesForAdmin(query: AttendanceQueryDto) {
    const range = this.resolveDateRange(query.from, query.to);
    const page = Math.max(1, Number.parseInt(String(query.page ?? '1'), 10) || 1);
    const limit = Math.min(
      200,
      Math.max(1, Number.parseInt(String(query.limit ?? '50'), 10) || 50),
    );
    const employeeId =
      typeof query.employeeId === 'string' && query.employeeId.trim()
        ? query.employeeId.trim()
        : undefined;
    const search = typeof query.search === 'string' ? query.search.trim() : '';
    const statusFilter =
      query.status === AttendanceStatus.MASUK || query.status === AttendanceStatus.PULANG
        ? (query.status as AttendanceStatus)
        : undefined;

    const where: Prisma.AttendanceWhereInput = {
      date: {
        gte: range.from,
        lte: range.to,
      },
      ...(employeeId ? { employeeId } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(search
        ? {
            employee: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { position: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const rows = await this.prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            position: true,
            phone: true,
            photoUrl: true,
            role: true,
          },
        },
      },
      orderBy: [{ date: 'desc' }, { timestamp: 'asc' }],
    });

    const pairMap = new Map<string, AdminDailyPairDto>();
    for (const row of rows) {
      const key = `${row.employeeId}_${row.date}`;
      let pair = pairMap.get(key);
      if (!pair) {
        pair = {
          id: key,
          employeeId: row.employeeId,
          employee: {
            id: row.employee.id,
            name: row.employee.name,
            email: row.employee.email,
            position: row.employee.position,
            phone: row.employee.phone,
            photoUrl: row.employee.photoUrl ?? null,
            role: row.employee.role,
          },
          date: row.date,
          masuk: null,
          pulang: null,
          masukTimestamp: null,
          pulangTimestamp: null,
          status: 'WORKING',
        };
        pairMap.set(key, pair);
      }
      if (row.status === AttendanceStatus.MASUK) {
        pair.masuk = formatJakartaDateTime(row.timestamp);
        pair.masukTimestamp = row.timestamp.toISOString();
      } else if (row.status === AttendanceStatus.PULANG) {
        pair.pulang = formatJakartaDateTime(row.timestamp);
        pair.pulangTimestamp = row.timestamp.toISOString();
      }
      pair.status = pair.masuk && pair.pulang ? 'COMPLETE' : 'WORKING';
    }

    const allPairs = Array.from(pairMap.values()).sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return a.employee.name.localeCompare(b.employee.name);
    });

    const total = allPairs.length;
    const pagedSummary = allPairs.slice((page - 1) * limit, page * limit);

    return {
      filter: {
        from: range.from,
        to: range.to,
        employeeId: employeeId ?? null,
        search: search || null,
        timezone: 'Asia/Jakarta',
      },
      data: pagedSummary,
      summary: pagedSummary,
      records: rows.map((row) => ({
        ...this.formatRecord(row),
        employee: {
          id: row.employee.id,
          name: row.employee.name,
          email: row.employee.email,
          position: row.employee.position,
          phone: row.employee.phone,
          photoUrl: row.employee.photoUrl ?? null,
        },
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        totalRecords: rows.length,
      },
    };
  }
}
