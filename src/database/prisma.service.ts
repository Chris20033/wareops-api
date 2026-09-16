import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client.js';
import { DatabaseClientFactory } from './database-client.factory.js';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(databaseClientFactory: DatabaseClientFactory) {
    this.client = databaseClientFactory.create();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
