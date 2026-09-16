import { Global, Module } from '@nestjs/common';
import { DatabaseClientFactory } from './database-client.factory.js';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [DatabaseClientFactory, PrismaService],
  exports: [DatabaseClientFactory, PrismaService],
})
export class DatabaseModule {}
