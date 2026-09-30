import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { JWT_ISSUER } from '../../common/auth/guards/jwt-auth.guard.js';
import { PasswordHasherService } from '../../common/auth/password-hasher.service.js';
import {
  formatRefreshToken,
  generateOpaqueSecret,
  hashOpaqueToken,
  parseCookieHeader,
  parseDurationToMs,
  parseRefreshToken,
  REFRESH_COOKIE_NAME,
} from '../../common/auth/token-crypto.util.js';
import type {
  AuthenticatedUserContext,
  RequestWithId,
} from '../../common/http/request-with-id.js';
import { slugifyOrganizationName } from '../../common/http/timezone.validator.js';
import type { AppEnvironment } from '../../config/environment.validation.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AuthMapper } from './auth.mapper.js';
import { AuthRepository } from './auth.repository.js';
import type { UserWithAccessibleMembershipsPayload } from './auth.selectors.js';
import type {
  AuthenticatedProfileDto,
  AuthSessionDto,
  LogoutResultDto,
} from './dto/auth-response.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

export type SessionWithCookieResult = {
  session: AuthSessionDto;
  rawRefreshToken: string;
  cookieMaxAgeMs: number;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppEnvironment, true>,
  ) {}

  getCookieOptions(): {
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  } {
    return {
      secure: this.configService.get('COOKIE_SECURE', { infer: true }),
      sameSite: this.configService.get('COOKIE_SAME_SITE', { infer: true }),
    };
  }

  async register(
    dto: RegisterDto,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<SessionWithCookieResult> {
    const email = dto.email.trim().toLowerCase();
    const slug =
      dto.organizationSlug?.trim().toLowerCase() ||
      slugifyOrganizationName(dto.organizationName);

    if (!slug || slug.length < 2) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'No fue posible generar un slug válido para la organización.',
        details: {
          fields: {
            organizationSlug: ['INVALID_SLUG'],
          },
        },
      });
    }

    const [emailExists, slugExists] = await Promise.all([
      this.authRepository.existsUserByEmail(email),
      this.authRepository.existsOrganizationBySlug(slug),
    ]);

    if (emailExists) {
      throw new ConflictException({
        code: 'DUPLICATE_RESOURCE',
        message: 'Ya existe una cuenta registrada con este correo electrónico.',
        details: { field: 'email' },
      });
    }

    if (slugExists) {
      throw new ConflictException({
        code: 'DUPLICATE_RESOURCE',
        message: 'El identificador (slug) de la organización ya está en uso.',
        details: { field: 'organizationSlug' },
      });
    }

    const ownerRoleId = await this.authRepository.ensureOwnerRoleId();
    const passwordHash = await this.passwordHasher.hash(dto.password);
    const sessionId = randomUUID();
    const secret = generateOpaqueSecret();
    const rawRefreshToken = formatRefreshToken(sessionId, secret);
    const tokenHash = hashOpaqueToken(rawRefreshToken);
    const now = new Date();
    const refreshTtlMs = this.getRefreshTtlMs();
    const expiresAt = new Date(now.getTime() + refreshTtlMs);

    try {
      const user =
        await this.authRepository.registerUserWithOrganizationAndSession({
          email,
          passwordHash,
          displayName: dto.displayName.trim(),
          organizationName: dto.organizationName.trim(),
          organizationSlug: slug,
          timezone: dto.timezone?.trim() || 'UTC',
          ownerRoleId,
          sessionId,
          tokenHash,
          expiresAt,
          now,
          userAgent: meta.userAgent,
          ipAddress: meta.ipAddress,
        });

      return this.buildSessionResult({
        user,
        sessionId,
        rawRefreshToken,
        cookieMaxAgeMs: refreshTtlMs,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'DUPLICATE_RESOURCE',
          message: 'El correo o el slug de la organización ya existe.',
        });
      }
      throw error;
    }
  }

  async login(
    dto: LoginDto,
    meta: { requestId: string; userAgent?: string; ipAddress?: string },
  ): Promise<SessionWithCookieResult> {
    const email = dto.email.trim().toLowerCase();
    const userWithCredentials =
      await this.authRepository.findUserByEmailWithCredentials(email);

    if (!userWithCredentials || !userWithCredentials.isActive) {
      this.logFailedLogin(meta.requestId, 'user_not_found_or_inactive');
      this.throwInvalidCredentials();
    }

    const isPasswordValid = await this.passwordHasher.verify(
      userWithCredentials.passwordHash,
      dto.password,
    );

    if (!isPasswordValid) {
      this.logFailedLogin(meta.requestId, 'invalid_password');
      this.throwInvalidCredentials();
    }

    const sessionId = randomUUID();
    const secret = generateOpaqueSecret();
    const rawRefreshToken = formatRefreshToken(sessionId, secret);
    const tokenHash = hashOpaqueToken(rawRefreshToken);
    const now = new Date();
    const refreshTtlMs = this.getRefreshTtlMs();
    const expiresAt = new Date(now.getTime() + refreshTtlMs);

    await this.authRepository.createRefreshSession({
      sessionId,
      userId: userWithCredentials.id,
      tokenHash,
      expiresAt,
      now,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    const { passwordHash: _ignored, ...safeUser } = userWithCredentials;
    void _ignored;

    return this.buildSessionResult({
      user: safeUser,
      sessionId,
      rawRefreshToken,
      cookieMaxAgeMs: refreshTtlMs,
    });
  }

  async refresh(request: RequestWithId): Promise<SessionWithCookieResult> {
    this.validateOriginIfPresent(request.header('origin'));

    const cookies = parseCookieHeader(request.header('cookie'));
    const rawRefreshCookie = cookies[REFRESH_COOKIE_NAME];

    if (!rawRefreshCookie) {
      this.throwRefreshInvalid();
    }

    const { sessionId, tokenHash } = parseRefreshToken(rawRefreshCookie);

    const session = sessionId
      ? await this.authRepository.findRefreshSessionById(sessionId)
      : await this.authRepository.findRefreshSessionByTokenHash(tokenHash);

    if (!session) {
      this.throwRefreshInvalid();
    }

    const now = new Date();

    // Reuse detection: if session was already revoked or tokenHash does not match current rotated hash
    if (session.revokedAt !== null || session.tokenHash !== tokenHash) {
      if (session.revokedAt === null) {
        await this.authRepository.revokeRefreshSessionById(session.id, now);
      }
      this.logger.warn({
        event: 'auth.refresh.reuse_or_revoked',
        requestId: request.requestId,
        sessionId: session.id,
      });
      this.throwRefreshInvalid();
    }

    if (session.expiresAt <= now || !session.user.isActive) {
      await this.authRepository.revokeRefreshSessionById(session.id, now);
      this.throwRefreshInvalid();
    }

    const newSecret = generateOpaqueSecret();
    const newRawRefreshToken = formatRefreshToken(session.id, newSecret);
    const newTokenHash = hashOpaqueToken(newRawRefreshToken);
    const refreshTtlMs = this.getRefreshTtlMs();
    const newExpiresAt = new Date(now.getTime() + refreshTtlMs);

    const rotated = await this.authRepository.rotateRefreshSessionToken({
      sessionId: session.id,
      expectedTokenHash: tokenHash,
      newTokenHash,
      newExpiresAt,
      now,
      userAgent: request.header('user-agent'),
      ipAddress: request.ip,
    });

    if (!rotated) {
      await this.authRepository.revokeRefreshSessionById(session.id, now);
      this.throwRefreshInvalid();
    }

    return this.buildSessionResult({
      user: session.user,
      sessionId: session.id,
      rawRefreshToken: newRawRefreshToken,
      cookieMaxAgeMs: refreshTtlMs,
    });
  }

  async logout(
    currentUser: AuthenticatedUserContext,
    cookieHeader?: string,
  ): Promise<LogoutResultDto> {
    const now = new Date();
    await this.authRepository.revokeRefreshSessionById(
      currentUser.sessionId,
      now,
    );

    const cookies = parseCookieHeader(cookieHeader);
    const rawCookie = cookies[REFRESH_COOKIE_NAME];

    if (rawCookie) {
      const parsed = parseRefreshToken(rawCookie);
      if (parsed.sessionId && parsed.sessionId !== currentUser.sessionId) {
        await this.authRepository.revokeRefreshSessionById(
          parsed.sessionId,
          now,
        );
      }
    }

    return { loggedOut: true };
  }

  async getMe(
    currentUser: AuthenticatedUserContext,
  ): Promise<AuthenticatedProfileDto> {
    const user = await this.authRepository.findUserByIdWithMemberships(
      currentUser.userId,
    );

    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Se requiere autenticación.',
      });
    }

    return AuthMapper.toProfileDto({
      sessionId: currentUser.sessionId,
      user,
    });
  }

  private async buildSessionResult(params: {
    user: UserWithAccessibleMembershipsPayload;
    sessionId: string;
    rawRefreshToken: string;
    cookieMaxAgeMs: number;
  }): Promise<SessionWithCookieResult> {
    const accessTtlMs = this.getAccessTtlMs();
    const expiresInSeconds = Math.floor(accessTtlMs / 1_000);
    const accessToken = await this.jwtService.signAsync(
      {
        sub: params.user.id,
        sessionId: params.sessionId,
      },
      {
        issuer: JWT_ISSUER,
        expiresIn: expiresInSeconds,
      },
    );

    return {
      session: AuthMapper.toAuthSessionDto({
        accessToken,
        expiresIn: expiresInSeconds,
        user: params.user,
      }),
      rawRefreshToken: params.rawRefreshToken,
      cookieMaxAgeMs: params.cookieMaxAgeMs,
    };
  }

  private validateOriginIfPresent(origin: string | undefined): void {
    if (!origin) {
      return;
    }

    const allowedOrigin = this.configService.get('WEB_ORIGIN', { infer: true });

    if (origin !== allowedOrigin) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'El origen de la solicitud no está autorizado.',
      });
    }
  }

  private getAccessTtlMs(): number {
    return parseDurationToMs(
      this.configService.get('ACCESS_TOKEN_TTL', { infer: true }),
    );
  }

  private getRefreshTtlMs(): number {
    return parseDurationToMs(
      this.configService.get('REFRESH_TOKEN_TTL', { infer: true }),
    );
  }

  private logFailedLogin(requestId: string, reason: string): void {
    this.logger.warn({
      event: 'auth.login.failed',
      requestId,
      reason,
    });
  }

  private throwInvalidCredentials(): never {
    throw new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      message: 'Credenciales inválidas.',
    });
  }

  private throwRefreshInvalid(): never {
    throw new UnauthorizedException({
      code: 'REFRESH_SESSION_INVALID',
      message: 'La sesión de renovación es inválida o ha expirado.',
    });
  }
}
