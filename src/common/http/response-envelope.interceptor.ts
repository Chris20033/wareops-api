import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { RequestWithId } from './request-with-id.js';

export type ApiSuccessResponse<T> = {
  data: T;
  requestId: string;
};

@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    const request = context.switchToHttp().getRequest<RequestWithId>();

    return next.handle().pipe(
      map((data) => ({
        data,
        requestId: request.requestId,
      })),
    );
  }
}
