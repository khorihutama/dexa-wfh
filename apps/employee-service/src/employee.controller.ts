import * as fs from 'node:fs';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import {
  MAX_AVATAR_SIZE_BYTES,
  resolveAvatarFilePath,
  UploadedFileLike,
} from '@dexa-wfh/common';
import { loadEnvConfig } from '@dexa-wfh/config';
import {
  CreateEmployeeDto,
  EmployeeService,
  ListEmployeesQueryDto,
  UpdateEmployeeByAdminDto,
  UpdateSelfProfileDto,
} from './employee.service';

@Controller()
export class EmployeeController {
  private readonly config = loadEnvConfig();

  constructor(private readonly employeeService: EmployeeService) {}

  @Get('uploads/avatars/:filename')
  async serveAvatar(@Param('filename') filename: string, @Res() res: Response) {
    const { filePath, contentType } = resolveAvatarFilePath(
      filename,
      this.config.UPLOADS_DIR,
    );
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Avatar image not found');
    }
    const buffer = await fs.promises.readFile(filePath);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(HttpStatus.OK).send(buffer);
  }

  @Get('employees/me')
  async getMyProfile(
    @Headers('x-user-id') userId?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.employeeService.getMyProfile({ userId, authHeader });
  }

  @Patch('employees/me')
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
    }),
  )
  async patchMyProfile(
    @Headers('x-user-id') userId: string | undefined,
    @Headers('authorization') authHeader: string | undefined,
    @Body() body: UpdateSelfProfileDto,
    @UploadedFiles() files?: UploadedFileLike[],
  ) {
    return this.employeeService.updateMyProfile({ userId, authHeader }, body, files?.[0]);
  }

  @Put('employees/me')
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
    }),
  )
  async putMyProfile(
    @Headers('x-user-id') userId: string | undefined,
    @Headers('authorization') authHeader: string | undefined,
    @Body() body: UpdateSelfProfileDto,
    @UploadedFiles() files?: UploadedFileLike[],
  ) {
    return this.employeeService.updateMyProfile({ userId, authHeader }, body, files?.[0]);
  }

  @Post('employees/me/photo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
    }),
  )
  async uploadMyPhoto(
    @Headers('x-user-id') userId: string | undefined,
    @Headers('authorization') authHeader: string | undefined,
    @Body() body: { photoUrl?: string },
    @UploadedFiles() files?: UploadedFileLike[],
  ) {
    return this.employeeService.updateMyPhoto({ userId, authHeader }, body, files?.[0]);
  }

  @Get('employees')
  async listEmployees(@Query() query: ListEmployeesQueryDto) {
    return this.employeeService.listEmployees(query);
  }

  @Get('employees/:id')
  async getEmployeeById(@Param('id') id: string) {
    return this.employeeService.getEmployeeById(id);
  }

  @Post('employees')
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
    }),
  )
  async createEmployee(
    @Body() body: CreateEmployeeDto,
    @UploadedFiles() files?: UploadedFileLike[],
  ) {
    return this.employeeService.createEmployee(body, files?.[0]);
  }

  @Patch('employees/:id')
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
    }),
  )
  async patchEmployeeByAdmin(
    @Param('id') id: string,
    @Body() body: UpdateEmployeeByAdminDto,
    @UploadedFiles() files?: UploadedFileLike[],
  ) {
    return this.employeeService.updateEmployeeByAdmin(id, body, files?.[0]);
  }

  @Put('employees/:id')
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: { fileSize: MAX_AVATAR_SIZE_BYTES },
    }),
  )
  async putEmployeeByAdmin(
    @Param('id') id: string,
    @Body() body: UpdateEmployeeByAdminDto,
    @UploadedFiles() files?: UploadedFileLike[],
  ) {
    return this.employeeService.updateEmployeeByAdmin(id, body, files?.[0]);
  }

  @Delete('employees/:id')
  async deleteEmployeeByAdmin(
    @Param('id') id: string,
    @Headers('x-user-id') userId?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.employeeService.deleteEmployeeByAdmin(id, { userId, authHeader });
  }
}
