import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApplication } from './app.setup.js';
import { createApplicationLogger } from './common/observability/application-logger.js';
import { validateEnvironment } from './config/environment.validation.js';

async function bootstrap(): Promise<void> {
  const environment = validateEnvironment(process.env);
  const app = await NestFactory.create(AppModule, {
    logger: createApplicationLogger(environment.LOG_LEVEL),
  });

  configureApplication(app);
  await app.listen(environment.PORT, '0.0.0.0');
}

await bootstrap();
