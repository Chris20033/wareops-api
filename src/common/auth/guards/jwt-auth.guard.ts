import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { AppEnvironment } from '../../../config/environment.validation.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type {
  AuthenticatedUserContext,
  RequestWithId,
} from '../../http/request-with-id.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

export const JWT_ISSUER = 'wareops-api';

export type AccessTokenPayload = {
  sub: string;
  sessionId: string;
  iat?: number;
  exp?: number;
  iss?: string;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppEnvironment, true>,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithId>();
    request.authContext = await this.authenticateRequest(request);
    return true;
  }

  async authenticateRequest(
    request: RequestWithId,
  ): Promise<AuthenticatedUserContext> {
    const authorization = request.header('authorization');

    if (!authorization) {
      this.throwUnauthenticated();
    }

    const [scheme, token, ...rest] = authorization.trim().split(/\s+/);

    if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) {
      this.throwUnauthenticated();
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.configService.get('JWT_ACCESS_SECRET', { infer: true }),
        issuer: JWT_ISSUER,
      });
    } catch {
      this.throwUnauthenticated();
    }

    if (!payload.sub || !payload.sessionId) {
      this.throwUnauthenticated();
    }

    const session = await this.prismaService.client.refreshSession.findUnique({
      where: { id: payload.sessionId },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            isActive: true,
          },
        },
      },
    });

    const now = new Date();

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt !== null ||
      session.expiresAt <= now ||
      !session.user.isActive
    ) {
      this.throwUnauthenticated();
    }

    return {
      userId: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
      sessionId: session.id,
    };
  }

  private throwUnauthenticated(): never {
    throw new UnauthorizedException({
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Se requiere autenticación.',
    });
  }
}
