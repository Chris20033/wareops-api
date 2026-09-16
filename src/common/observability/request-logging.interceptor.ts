import {
  type CallHandler,
  type ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { AppEnvironment } from '../../config/environment.validation.js';
import type { RequestWithId } from '../http/request-with-id.js';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  constructor(
    private readonly configService: ConfigService<AppEnvironment, true>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const startedAt = performance.now();

    return next.handle().pipe(
      tap({
        next: () => this.log(request, response.statusCode, startedAt),
        error: (error: unknown) =>
          this.log(
            request,
            error instanceof HttpException
              ? error.getStatus()
              : HttpStatusCode.INTERNAL_SERVER_ERROR,
            startedAt,
          ),
      }),
    );
  }

  private log(
    request: RequestWithId,
    statusCode: number,
    startedAt: number,
  ): void {
    this.logger.log({
      event: 'http.request.completed',
      service: 'wareops-api',
      environment: this.configService.get('NODE_ENV', { infer: true }),
      requestId: request.requestId,
      method: request.method,
      route: request.originalUrl.split('?')[0],
      statusCode,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    });
  }
}

const HttpStatusCode = {
  INTERNAL_SERVER_ERROR: 500,
} as const;
