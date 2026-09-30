import {
  Controller,
  Get,
  type INestApplication,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/app.setup.js';
import { RequirePermissions } from '../src/common/auth/decorators/require-permissions.decorator.js';
import { JwtAuthGuard } from '../src/common/auth/guards/jwt-auth.guard.js';
import { OrganizationContextGuard } from '../src/common/auth/guards/organization-context.guard.js';
import { PermissionsGuard } from '../src/common/auth/guards/permissions.guard.js';
import {
  PERMISSION_CODES,
  ROLE_CODES,
} from '../src/common/auth/rbac.constants.js';
import {
  hashOpaqueToken,
  REFRESH_COOKIE_NAME,
} from '../src/common/auth/token-crypto.util.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { DatabaseClientFactory } from '../src/database/database-client.factory.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { runSeed } from '../prisma/seed.js';

@Controller('test-rbac')
@UseGuards(JwtAuthGuard, OrganizationContextGuard, PermissionsGuard)
class TestRbacProbeController {
  @Get('audit')
  @RequirePermissions(PERMISSION_CODES.AUDIT_READ)
  readAudit(): { allowed: boolean } {
    return { allowed: true };
  }

  @Post('mutate-catalog')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  mutateCatalog(): { allowed: boolean } {
    return { allowed: true };
  }

  @Post('mutate-inventory')
  @RequirePermissions(PERMISSION_CODES.INVENTORY_WRITE)
  mutateInventory(): { allowed: boolean } {
    return { allowed: true };
  }
}

function extractRefreshCookie(setCookieHeader: string | string[] | undefined): {
  rawCookieHeader: string;
  tokenValue: string;
} {
  const cookies = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  const refreshLine = cookies.find((c) =>
    c.startsWith(`${REFRESH_COOKIE_NAME}=`),
  );

  if (!refreshLine) {
    throw new Error(
      `Refresh cookie ${REFRESH_COOKIE_NAME} not found in headers`,
    );
  }

  const pair = refreshLine.split(';')[0] ?? '';
  const tokenValue = decodeURIComponent(
    pair.slice(`${REFRESH_COOKIE_NAME}=`.length),
  );

  return {
    rawCookieHeader: pair,
    tokenValue,
  };
}

describe('Sprint 01 — Identity, Organizations, and Multi-tenancy (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const runId = Date.now().toString(36);

  beforeAll(async () => {
    const testDatabaseUrl =
      process.env.TEST_DATABASE_URL ??
      (!process.env.DATABASE_URL ||
      process.env.DATABASE_URL.includes('127.0.0.1:1/')
        ? 'postgresql://wareops:wareops_local@localhost:5432/wareops'
        : process.env.DATABASE_URL);

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestRbacProbeController],
    })
      .overrideProvider(DatabaseClientFactory)
      .useValue({
        create: (connectionTimeoutMillis = 5_000) => {
          const adapter = new PrismaPg({
            connectionString: testDatabaseUrl,
            connectionTimeoutMillis,
          });
          return new PrismaClient({ adapter });
        },
      })
      .compile();

    app = moduleFixture.createNestApplication({ logger: false });
    configureApplication(app);
    await app.init();

    prisma = app.get(PrismaService);
    await runSeed(prisma.client);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('persists passwords as Argon2id hashes and refresh tokens only as SHA-256 hashes', async () => {
    const email = `owner.alpha.${runId}@wareops.local`;
    const plainPassword = 'AlphaPassword!2026';
    const slug = `alpha-org-${runId}`;

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: plainPassword,
        displayName: 'Alpha Owner',
        organizationName: 'Alpha Organization',
        organizationSlug: slug,
        timezone: 'America/Mexico_City',
      });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.data.user.email).toBe(email);
    expect(registerResponse.body.data.organizations).toHaveLength(1);
    expect(registerResponse.body.data.organizations[0]).toMatchObject({
      slug,
      role: { code: ROLE_CODES.OWNER },
    });

    const { tokenValue } = extractRefreshCookie(
      registerResponse.headers['set-cookie'],
    );

    const dbUser = await prisma.client.user.findUniqueOrThrow({
      where: { email },
    });
    expect(dbUser.passwordHash).not.toBe(plainPassword);
    expect(dbUser.passwordHash).toContain('$argon2id$');

    const sessions = await prisma.client.refreshSession.findMany({
      where: { userId: dbUser.id },
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.tokenHash).not.toBe(tokenValue);
    expect(sessions[0]?.tokenHash).toBe(hashOpaqueToken(tokenValue));
  });

  it('rotates refresh tokens, revokes session on reuse of rotated token, and supports logout', async () => {
    const email = `session.test.${runId}@wareops.local`;
    const password = 'SessionPassword!2026';

    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        displayName: 'Session Tester',
        organizationName: `Session Org ${runId}`,
      });

    expect(registerRes.status).toBe(201);
    const cookie1 = extractRefreshCookie(registerRes.headers['set-cookie']);

    // Rotate refresh token
    const refreshRes1 = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie1.rawCookieHeader);

    expect(refreshRes1.status).toBe(200);
    const cookie2 = extractRefreshCookie(refreshRes1.headers['set-cookie']);
    expect(cookie2.tokenValue).not.toBe(cookie1.tokenValue);

    // Reusing the old rotated token (cookie1) must fail AND revoke the entire session
    const reuseRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie1.rawCookieHeader);

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.code).toBe('REFRESH_SESSION_INVALID');

    // Now even cookie2 (the latest token) and the access token for that session are rejected
    const afterReuseRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie2.rawCookieHeader);

    expect(afterReuseRes.status).toBe(401);
    expect(afterReuseRes.body.code).toBe('REFRESH_SESSION_INVALID');

    const meWithRevokedSession = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${refreshRes1.body.data.accessToken}`);

    expect(meWithRevokedSession.status).toBe(401);

    // Login again and test explicit logout
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });

    expect(loginRes.status).toBe(200);
    const loginCookie = extractRefreshCookie(loginRes.headers['set-cookie']);
    const loginAccessToken = loginRes.body.data.accessToken as string;

    const logoutRes = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${loginAccessToken}`)
      .set('Cookie', loginCookie.rawCookieHeader);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.data).toEqual({ loggedOut: true });

    const refreshAfterLogout = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', loginCookie.rawCookieHeader);

    expect(refreshAfterLogout.status).toBe(401);
  });

  it('enforces multi-tenant isolation for resources, counts, filters, and cross-tenant mutations', async () => {
    const tenantARes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `tenant.a.${runId}@wareops.local`,
        password: 'TenantPassword!2026',
        displayName: 'Tenant A Owner',
        organizationName: `Tenant A ${runId}`,
      });
    const tenantBRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `tenant.b.${runId}@wareops.local`,
        password: 'TenantPassword!2026',
        displayName: 'Tenant B Owner',
        organizationName: `Tenant B ${runId}`,
      });

    const tokenA = tenantARes.body.data.accessToken as string;
    const orgAId = tenantARes.body.data.organizations[0]
      .organizationId as string;
    const membershipAId = tenantARes.body.data.organizations[0]
      .membershipId as string;

    const tokenB = tenantBRes.body.data.accessToken as string;
    const orgBId = tenantBRes.body.data.organizations[0]
      .organizationId as string;
    const membershipBId = tenantBRes.body.data.organizations[0]
      .membershipId as string;

    // 1. Accessing Organization B with Token A responds 404 RESOURCE_NOT_FOUND without leaking data
    const crossOrgRead = await request(app.getHttpServer())
      .get('/api/v1/organizations/current')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Organization-Id', orgBId);

    expect(crossOrgRead.status).toBe(404);
    expect(crossOrgRead.body.code).toBe('RESOURCE_NOT_FOUND');

    // 2. Mutating a membership from Organization B while operating in Organization A is rejected (404)
    const crossTenantMemberPatch = await request(app.getHttpServer())
      .patch(`/api/v1/members/${membershipBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Organization-Id', orgAId)
      .send({ roleCode: ROLE_CODES.VIEWER });

    expect(crossTenantMemberPatch.status).toBe(404);
    expect(crossTenantMemberPatch.body.code).toBe('RESOURCE_NOT_FOUND');

    // 3. Create invitations in both tenants and verify list/count isolation
    const invB = await request(app.getHttpServer())
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${tokenB}`)
      .set('X-Organization-Id', orgBId)
      .send({
        email: `exclusive.b.${runId}@wareops.local`,
        roleCode: ROLE_CODES.OPERATOR,
      });
    expect(invB.status).toBe(201);

    const listMembersA = await request(app.getHttpServer())
      .get('/api/v1/members')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Organization-Id', orgAId);

    expect(listMembersA.status).toBe(200);
    expect(listMembersA.body.meta.totalItems).toBe(1);
    expect(listMembersA.body.data).toHaveLength(1);
    expect(listMembersA.body.data[0].id).toBe(membershipAId);

    const listInvitationsA = await request(app.getHttpServer())
      .get('/api/v1/invitations')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Organization-Id', orgAId);

    expect(listInvitationsA.status).toBe(200);
    expect(listInvitationsA.body.meta.totalItems).toBe(0);
    expect(listInvitationsA.body.data).toHaveLength(0);

    // Attempting to revoke Tenant B's invitation from Tenant A fails with 404
    const crossRevoke = await request(app.getHttpServer())
      .post(`/api/v1/invitations/${invB.body.data.id}/revoke`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Organization-Id', orgAId);

    expect(crossRevoke.status).toBe(404);
  });

  it('enforces role permissions: VIEWER cannot mutate, OPERATOR cannot manage members or read audit', async () => {
    const orgNorte = await prisma.client.organization.findUniqueOrThrow({
      where: { slug: 'organizacion-norte' },
    });

    const loginAs = async (email: string): Promise<string> => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'WareOpsDemo!2026' });
      expect(res.status).toBe(200);
      return res.body.data.accessToken as string;
    };

    const viewerToken = await loginAs('viewer@wareops.local');
    const operatorToken = await loginAs('operator@wareops.local');
    const managerToken = await loginAs('manager@wareops.local');

    // VIEWER cannot mutate organization, members, catalog, or inventory
    const viewerPatchOrg = await request(app.getHttpServer())
      .patch('/api/v1/organizations/current')
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('X-Organization-Id', orgNorte.id)
      .send({ name: 'Hacked Name' });
    expect(viewerPatchOrg.status).toBe(403);
    expect(viewerPatchOrg.body.code).toBe('PERMISSION_DENIED');

    const viewerMutateCatalog = await request(app.getHttpServer())
      .post('/api/v1/test-rbac/mutate-catalog')
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('X-Organization-Id', orgNorte.id);
    expect(viewerMutateCatalog.status).toBe(403);

    const viewerMutateInventory = await request(app.getHttpServer())
      .post('/api/v1/test-rbac/mutate-inventory')
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('X-Organization-Id', orgNorte.id);
    expect(viewerMutateInventory.status).toBe(403);

    // OPERATOR cannot manage members or invitations
    const operatorListMembers = await request(app.getHttpServer())
      .get('/api/v1/members')
      .set('Authorization', `Bearer ${operatorToken}`)
      .set('X-Organization-Id', orgNorte.id);
    expect(operatorListMembers.status).toBe(403);
    expect(operatorListMembers.body.code).toBe('PERMISSION_DENIED');

    const operatorCreateInvite = await request(app.getHttpServer())
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${operatorToken}`)
      .set('X-Organization-Id', orgNorte.id)
      .send({
        email: `unauth.invite.${runId}@wareops.local`,
        roleCode: ROLE_CODES.VIEWER,
      });
    expect(operatorCreateInvite.status).toBe(403);

    // OPERATOR cannot read audit logs
    const operatorReadAudit = await request(app.getHttpServer())
      .get('/api/v1/test-rbac/audit')
      .set('Authorization', `Bearer ${operatorToken}`)
      .set('X-Organization-Id', orgNorte.id);
    expect(operatorReadAudit.status).toBe(403);
    expect(operatorReadAudit.body.code).toBe('PERMISSION_DENIED');

    // MANAGER can read audit logs
    const managerReadAudit = await request(app.getHttpServer())
      .get('/api/v1/test-rbac/audit')
      .set('Authorization', `Bearer ${managerToken}`)
      .set('X-Organization-Id', orgNorte.id);
    expect(managerReadAudit.status).toBe(200);
  });

  it('enforces invitation lifecycle: single acceptance, expired rejection, revoked rejection, and email matching', async () => {
    const ownerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `inv.owner.${runId}@wareops.local`,
        password: 'InviteOwnerPassword!2026',
        displayName: 'Invite Org Owner',
        organizationName: `Invite Org ${runId}`,
      });
    const ownerToken = ownerRes.body.data.accessToken as string;
    const orgId = ownerRes.body.data.organizations[0].organizationId as string;

    // 1. Invitation accepted once with new account creation; second acceptance rejected
    const invitedEmail1 = `new.member.${runId}@wareops.local`;
    const createInv1 = await request(app.getHttpServer())
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Organization-Id', orgId)
      .send({ email: invitedEmail1, roleCode: ROLE_CODES.MANAGER });

    expect(createInv1.status).toBe(201);
    const token1 = createInv1.body.data.invitationToken as string;
    expect(token1).toBeDefined();

    // Another authenticated user with a different email cannot accept token1
    const otherUserRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `wrong.user.${runId}@wareops.local`,
        password: 'WrongUserPassword!2026',
        displayName: 'Wrong User',
        organizationName: `Wrong User Org ${runId}`,
      });
    const wrongUserToken = otherUserRes.body.data.accessToken as string;

    const wrongEmailAccept = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${wrongUserToken}`)
      .send({ token: token1 });

    expect(wrongEmailAccept.status).toBe(403);
    expect(wrongEmailAccept.body.code).toBe('PERMISSION_DENIED');

    // First valid acceptance (new user creation) succeeds
    const acceptRes1 = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .send({
        token: token1,
        displayName: 'New Manager Member',
        password: 'NewManagerPassword!2026',
      });

    expect(acceptRes1.status).toBe(200);
    expect(acceptRes1.body.data.invitation.status).toBe('ACCEPTED');
    expect(acceptRes1.body.data.membership.role.code).toBe(ROLE_CODES.MANAGER);

    // Second acceptance of the same invitation is rejected
    const secondAcceptRes = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .send({
        token: token1,
        displayName: 'Duplicate Attempt',
        password: 'NewManagerPassword!2026',
      });

    expect(secondAcceptRes.status).toBe(409);
    expect(secondAcceptRes.body.code).toBe('INVALID_STATE_TRANSITION');

    // 2. Revoked invitation is rejected on acceptance
    const createInvRevoke = await request(app.getHttpServer())
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Organization-Id', orgId)
      .send({
        email: `revoked.invite.${runId}@wareops.local`,
        roleCode: ROLE_CODES.OPERATOR,
      });
    expect(createInvRevoke.status).toBe(201);

    const revokeRes = await request(app.getHttpServer())
      .post(`/api/v1/invitations/${createInvRevoke.body.data.id}/revoke`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Organization-Id', orgId);
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.status).toBe('REVOKED');

    const acceptRevokedRes = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .send({
        token: createInvRevoke.body.data.invitationToken,
        displayName: 'Revoked User',
        password: 'RevokedPassword!2026',
      });
    expect(acceptRevokedRes.status).toBe(409);
    expect(acceptRevokedRes.body.code).toBe('INVALID_STATE_TRANSITION');

    // 3. Expired invitation is rejected on acceptance
    const createInvExpired = await request(app.getHttpServer())
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Organization-Id', orgId)
      .send({
        email: `expired.invite.${runId}@wareops.local`,
        roleCode: ROLE_CODES.VIEWER,
      });
    expect(createInvExpired.status).toBe(201);

    await prisma.client.invitation.update({
      where: { id: createInvExpired.body.data.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const acceptExpiredRes = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .send({
        token: createInvExpired.body.data.invitationToken,
        displayName: 'Expired User',
        password: 'ExpiredPassword!2026',
      });
    expect(acceptExpiredRes.status).toBe(409);
    expect(acceptExpiredRes.body.code).toBe('INVALID_STATE_TRANSITION');

    // 4. Existing authenticated user with matching email can accept invitation
    const existingUserEmail = `existing.accepter.${runId}@wareops.local`;
    const existingUserReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: existingUserEmail,
        password: 'ExistingUserPass!2026',
        displayName: 'Existing Accepter',
        organizationName: `Existing Accepter Org ${runId}`,
      });
    const existingUserToken = existingUserReg.body.data.accessToken as string;

    const createInvExisting = await request(app.getHttpServer())
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Organization-Id', orgId)
      .send({
        email: existingUserEmail,
        roleCode: ROLE_CODES.ADMIN,
      });
    expect(createInvExisting.status).toBe(201);

    const acceptExistingRes = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${existingUserToken}`)
      .send({
        token: createInvExisting.body.data.invitationToken,
      });
    expect(acceptExistingRes.status).toBe(200);
    expect(acceptExistingRes.body.data.membership.role.code).toBe(
      ROLE_CODES.ADMIN,
    );
  });

  it('prevents deactivating or demoting the last active OWNER', async () => {
    const ownerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `sole.owner.${runId}@wareops.local`,
        password: 'SoleOwnerPassword!2026',
        displayName: 'Sole Owner',
        organizationName: `Sole Owner Org ${runId}`,
      });

    const ownerToken = ownerRes.body.data.accessToken as string;
    const orgId = ownerRes.body.data.organizations[0].organizationId as string;
    const ownerMembershipId = ownerRes.body.data.organizations[0]
      .membershipId as string;

    // Trying to deactivate the last active OWNER fails with 422 BUSINESS_RULE_VIOLATION
    const deactivateSoleOwner = await request(app.getHttpServer())
      .patch(`/api/v1/members/${ownerMembershipId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Organization-Id', orgId)
      .send({ status: 'INACTIVE' });

    expect(deactivateSoleOwner.status).toBe(422);
    expect(deactivateSoleOwner.body.code).toBe('BUSINESS_RULE_VIOLATION');

    // Trying to demote the last active OWNER to ADMIN also fails with 422
    const demoteSoleOwner = await request(app.getHttpServer())
      .patch(`/api/v1/members/${ownerMembershipId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('X-Organization-Id', orgId)
      .send({ roleCode: ROLE_CODES.ADMIN });

    expect(demoteSoleOwner.status).toBe(422);
    expect(demoteSoleOwner.body.code).toBe('BUSINESS_RULE_VIOLATION');
  });
});
