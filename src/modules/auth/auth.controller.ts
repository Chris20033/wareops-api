import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator.js';
import { Public } from '../../common/auth/decorators/public.decorator.js';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard.js';
import {
  clearRefreshTokenCookie,
  setRefreshTokenCookie,
} from '../../common/auth/token-crypto.util.js';
import { ApiErrorResponseDto } from '../../common/errors/api-error-response.dto.js';
import type {
  AuthenticatedUserContext,
  RequestWithId,
} from '../../common/http/request-with-id.js';
import { AuthService } from './auth.service.js';
import {
  AuthenticatedProfileDto,
  AuthenticatedProfileEnvelopeDto,
  AuthSessionDto,
  AuthSessionEnvelopeDto,
  LogoutEnvelopeDto,
  LogoutResultDto,
} from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@ApiTags('Auth')
@ApiSecurity('requestId')
@UseGuards(JwtAuthGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary:
      'Registra un usuario, crea su organización inicial y le asigna membresía OWNER.',
  })
  @ApiCreatedResponse({ type: AuthSessionEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionDto> {
    const result = await this.authService.register(dto, {
      userAgent: request.header('user-agent'),
      ipAddress: request.ip,
    });
    const cookieOptions = this.authService.getCookieOptions();

    setRefreshTokenCookie(response, result.rawRefreshToken, {
      maxAgeMs: result.cookieMaxAgeMs,
      ...cookieOptions,
    });

    return result.session;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Inicia sesión y emite access token JWT + cookie HttpOnly de refresh.',
  })
  @ApiOkResponse({ type: AuthSessionEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionDto> {
    const result = await this.authService.login(dto, {
      requestId: request.requestId,
      userAgent: request.header('user-agent'),
      ipAddress: request.ip,
    });
    const cookieOptions = this.authService.getCookieOptions();

    setRefreshTokenCookie(response, result.rawRefreshToken, {
      maxAgeMs: result.cookieMaxAgeMs,
      ...cookieOptions,
    });

    return result.session;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Rota el refresh token desde la cookie HttpOnly y devuelve un nuevo access token.',
  })
  @ApiOkResponse({ type: AuthSessionEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async refresh(
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionDto> {
    const cookieOptions = this.authService.getCookieOptions();

    try {
      const result = await this.authService.refresh(request);

      setRefreshTokenCookie(response, result.rawRefreshToken, {
        maxAgeMs: result.cookieMaxAgeMs,
        ...cookieOptions,
      });

      return result.session;
    } catch (error) {
      clearRefreshTokenCookie(response, cookieOptions);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Revoca la sesión de refresh actual y elimina la cookie.',
  })
  @ApiOkResponse({ type: LogoutEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async logout(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LogoutResultDto> {
    const result = await this.authService.logout(
      currentUser,
      request.header('cookie'),
    );
    clearRefreshTokenCookie(response, this.authService.getCookieOptions());

    return result;
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary:
      'Obtiene el perfil autenticado, la sesión actual y las organizaciones accesibles.',
  })
  @ApiOkResponse({ type: AuthenticatedProfileEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async getMe(
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ): Promise<AuthenticatedProfileDto> {
    return this.authService.getMe(currentUser);
  }
}
