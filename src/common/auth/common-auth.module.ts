import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { AppEnvironment } from '../../config/environment.validation.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { OrganizationContextGuard } from './guards/organization-context.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { PasswordHasherService } from './password-hasher.service.js';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnvironment, true>) => ({
        secret: configService.get('JWT_ACCESS_SECRET', { infer: true }),
      }),
    }),
  ],
  providers: [
    PasswordHasherService,
    JwtAuthGuard,
    OrganizationContextGuard,
    PermissionsGuard,
  ],
  exports: [
    JwtModule,
    PasswordHasherService,
    JwtAuthGuard,
    OrganizationContextGuard,
    PermissionsGuard,
  ],
})
export class CommonAuthModule {}
