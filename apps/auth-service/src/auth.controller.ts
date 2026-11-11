import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { extractBearerToken } from '@dexa-wfh/common';
import { AuthService, ChangePasswordDto, LoginDto } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Get('validate')
  async validateGet(
    @Headers('authorization') authHeader?: string,
    @Query('token') queryToken?: string,
  ) {
    const token = extractBearerToken(authHeader) ?? queryToken;
    return this.authService.validateToken(token);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  async validatePost(
    @Headers('authorization') authHeader?: string,
    @Body() body?: { token?: string },
  ) {
    const token = body?.token ?? extractBearerToken(authHeader);
    return this.authService.validateToken(token);
  }

  @Get('me')
  async getMe(
    @Headers('x-user-id') userId?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    return this.authService.getMe({ userId, authHeader });
  }

  @Patch('password')
  async updatePassword(
    @Headers('x-user-id') userId: string | undefined,
    @Headers('authorization') authHeader: string | undefined,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.updatePassword({ userId, authHeader }, body);
  }
}
