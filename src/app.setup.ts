import {
  type INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/errors/http-exception.filter.js';
import { ResponseEnvelopeInterceptor } from './common/http/response-envelope.interceptor.js';
import { RequestLoggingInterceptor } from './common/observability/request-logging.interceptor.js';
import type { AppEnvironment } from './config/environment.validation.js';

export function configureApplication(app: INestApplication): void {
  const configService = app.get(ConfigService<AppEnvironment, true>);

  app.enableShutdownHooks();
  app.enableCors({
    origin: configService.get('WEB_ORIGIN', { infer: true }),
    credentials: true,
  });
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(
    app.get(RequestLoggingInterceptor),
    new ResponseEnvelopeInterceptor(),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('WareOps API')
    .setDescription('Contrato HTTP de la API WareOps.')
    .setVersion('1.0')
    .addBearerAuth(undefined, 'bearer')
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-Organization-Id',
        description: 'UUID de la organización activa.',
      },
      'organizationId',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-Request-Id',
        description: 'UUID opcional para correlación.',
      },
      'requestId',
    )
    .build();
  const documentFactory = () =>
    SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('docs', app, documentFactory, {
    jsonDocumentUrl: 'docs-json',
  });
}
