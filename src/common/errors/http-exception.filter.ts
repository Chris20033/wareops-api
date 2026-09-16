import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from '../http/request-with-id.js';

type SafeExceptionBody = {
  code?: string;
  message?: string | string[];
  details?: Record<string, unknown>;
};

const defaultCodes: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'AUTHENTICATION_REQUIRED',
  [HttpStatus.FORBIDDEN]: 'PERMISSION_DENIED',
  [HttpStatus.NOT_FOUND]: 'RESOURCE_NOT_FOUND',
  [HttpStatus.CONFLICT]: 'BUSINESS_RULE_VIOLATION',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'BUSINESS_RULE_VIOLATION',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'DEPENDENCY_UNAVAILABLE',
};

const defaultMessages: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'La solicitud contiene datos inválidos.',
  [HttpStatus.UNAUTHORIZED]: 'Se requiere autenticación.',
  [HttpStatus.FORBIDDEN]: 'No cuenta con permiso para esta operación.',
  [HttpStatus.NOT_FOUND]: 'El recurso solicitado no existe.',
  [HttpStatus.CONFLICT]:
    'La operación entra en conflicto con el estado actual.',
  [HttpStatus.UNPROCESSABLE_ENTITY]:
    'La operación incumple una regla de negocio.',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Se excedió el límite de solicitudes.',
  [HttpStatus.SERVICE_UNAVAILABLE]:
    'Una dependencia esencial no está disponible.',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionBody = this.getSafeBody(exception);

    if (!(exception instanceof HttpException)) {
      this.logger.error({
        event: 'http.unhandled_exception',
        requestId: request.requestId,
        errorType:
          exception instanceof Error ? exception.name : 'UnknownException',
      });
    }

    const body = {
      statusCode,
      code:
        exceptionBody.code ??
        defaultCodes[statusCode] ??
        (statusCode >= 500 ? 'INTERNAL_ERROR' : 'HTTP_ERROR'),
      message:
        this.getMessage(exceptionBody.message) ??
        defaultMessages[statusCode] ??
        (statusCode >= 500
          ? 'Ocurrió un error interno.'
          : 'No fue posible completar la solicitud.'),
      ...(exceptionBody.details ? { details: exceptionBody.details } : {}),
      requestId: request.requestId,
    };

    response.status(statusCode).json(body);
  }

  private getSafeBody(exception: unknown): SafeExceptionBody {
    if (!(exception instanceof HttpException)) {
      return {};
    }

    const response = exception.getResponse();
    return typeof response === 'object' && response !== null
      ? response
      : { message: String(response) };
  }

  private getMessage(
    message: string | string[] | undefined,
  ): string | undefined {
    if (Array.isArray(message)) {
      return defaultMessages[HttpStatus.BAD_REQUEST];
    }

    return message;
  }
}
