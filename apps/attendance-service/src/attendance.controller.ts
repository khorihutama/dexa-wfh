import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { AttendanceQueryDto, AttendanceService } from './attendance.service';

@Controller('attendances')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @HttpCode(HttpStatus.CREATED)
  async checkIn(
    @Headers('x-user-id') userId?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.attendanceService.checkIn({ userId, authHeader });
  }

  @Post('check-out')
  @HttpCode(HttpStatus.CREATED)
  async checkOut(
    @Headers('x-user-id') userId?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.attendanceService.checkOut({ userId, authHeader });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async recordAttendance(
    @Headers('x-user-id') userId: string | undefined,
    @Headers('authorization') authHeader: string | undefined,
    @Body() body?: { status?: string },
  ) {
    return this.attendanceService.recordByStatus({ userId, authHeader }, body?.status);
  }

  @Get('today')
  async getToday(
    @Headers('x-user-id') userId?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.attendanceService.getTodayStatus({ userId, authHeader });
  }

  @Get('me')
  async getMyAttendances(
    @Headers('x-user-id') userId: string | undefined,
    @Headers('authorization') authHeader: string | undefined,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendanceService.getMyAttendanceSummary({ userId, authHeader }, { from, to });
  }

  @Get()
  async getAllAttendances(@Query() query: AttendanceQueryDto) {
    return this.attendanceService.getAllAttendancesForAdmin(query);
  }
}
