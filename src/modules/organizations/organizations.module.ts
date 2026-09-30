import { Module } from '@nestjs/common';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';
import { MembersController } from './members.controller.js';
import { MembersService } from './members.service.js';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsRepository } from './organizations.repository.js';
import { OrganizationsService } from './organizations.service.js';

@Module({
  controllers: [
    OrganizationsController,
    MembersController,
    InvitationsController,
  ],
  providers: [
    OrganizationsRepository,
    OrganizationsService,
    MembersService,
    InvitationsService,
  ],
  exports: [
    OrganizationsRepository,
    OrganizationsService,
    MembersService,
    InvitationsService,
  ],
})
export class OrganizationsModule {}
