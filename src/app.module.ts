import {
  MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RequestIdMiddleware } from './common/http/request-id.middleware.js';
import { RequestLoggingInterceptor } from './common/observability/request-logging.interceptor.js';
import { validateEnvironment } from './config/environment.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    HealthModule,
  ],
  providers: [RequestLoggingInterceptor],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes({
      path: '{*splat}',
      method: RequestMethod.ALL,
    });
  }
}
