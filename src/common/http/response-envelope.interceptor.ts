import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { PaginationMetaDto } from './pagination.dto.js';
import type { RequestWithId } from './request-with-id.js';

export type ApiSuccessResponse<T> = {
  data: T;
  meta?: PaginationMetaDto;
  requestId: string;
};

function isPaginatedPayload(
  value: unknown,
): value is { data: unknown; meta: PaginationMetaDto } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    'data' in candidate &&
    'meta' in candidate &&
    Array.isArray(candidate.data) &&
    typeof candidate.meta === 'object' &&
    candidate.meta !== null
  );
}

@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<unknown>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<unknown>> {
    const request = context.switchToHttp().getRequest<RequestWithId>();

    return next.handle().pipe(
      map((payload) => {
        if (isPaginatedPayload(payload)) {
          return {
            data: payload.data,
            meta: payload.meta,
            requestId: request.requestId,
          };
        }

        return {
          data: payload,
          requestId: request.requestId,
        };
      }),
    );
  }
}
