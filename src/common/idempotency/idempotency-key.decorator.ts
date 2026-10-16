import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const headerValue = request.headers['idempotency-key'];

    if (
      !headerValue ||
      typeof headerValue !== 'string' ||
      !headerValue.trim()
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'La cabecera Idempotency-Key es obligatoria para este comando.',
        details: {
          fields: {
            'idempotency-key': ['REQUIRED'],
          },
        },
      });
    }

    const trimmed = headerValue.trim();
    if (trimmed.length > 128) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'La cabecera Idempotency-Key no debe exceder 128 caracteres.',
        details: {
          fields: {
            'idempotency-key': ['MAX_LENGTH_EXCEEDED'],
          },
        },
      });
    }

    return trimmed;
  },
);
