import {
  BadRequestException,
  Injectable,
  type NestMiddleware,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import type { RequestWithId } from './request-with-id.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestWithId, response: Response, next: NextFunction): void {
    const suppliedRequestId = request.header('x-request-id');
    const generatedRequestId = randomUUID();

    request.requestId = generatedRequestId;
    response.setHeader('X-Request-Id', generatedRequestId);

    if (suppliedRequestId && !UUID_PATTERN.test(suppliedRequestId)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'La cabecera X-Request-Id debe contener un UUID válido.',
        details: {
          fields: {
            'X-Request-Id': ['INVALID_UUID'],
          },
        },
      });
    }

    if (suppliedRequestId) {
      request.requestId = suppliedRequestId;
      response.setHeader('X-Request-Id', suppliedRequestId);
    }

    next();
  }
}
