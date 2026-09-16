import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { AppEnvironment } from '../config/environment.validation.js';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class DatabaseClientFactory {
  constructor(
    private readonly configService: ConfigService<AppEnvironment, true>,
  ) {}

  create(connectionTimeoutMillis = 1_000): PrismaClient {
    const adapter = new PrismaPg({
      connectionString: this.configService.get('DATABASE_URL', { infer: true }),
      connectionTimeoutMillis,
    });

    return new PrismaClient({ adapter });
  }
}
