import {
  PERMISSION_CODES,
  PREDEFINED_PERMISSIONS,
  PREDEFINED_ROLES,
  ROLE_CODES,
  ROLE_PERMISSION_MATRIX,
} from './rbac.constants.js';

describe('RBAC Matrix and Predefined Roles/Permissions', () => {
  it('defines all five predefined roles and nine permissions', () => {
    expect(PREDEFINED_ROLES.map((r) => r.code)).toEqual([
      ROLE_CODES.OWNER,
      ROLE_CODES.ADMIN,
      ROLE_CODES.MANAGER,
      ROLE_CODES.OPERATOR,
      ROLE_CODES.VIEWER,
    ]);
    expect(PREDEFINED_PERMISSIONS).toHaveLength(9);
  });

  it('grants organization:manage exclusively to OWNER', () => {
    expect(ROLE_PERMISSION_MATRIX.OWNER).toContain(
      PERMISSION_CODES.ORGANIZATION_MANAGE,
    );
    expect(ROLE_PERMISSION_MATRIX.ADMIN).not.toContain(
      PERMISSION_CODES.ORGANIZATION_MANAGE,
    );
    expect(ROLE_PERMISSION_MATRIX.MANAGER).not.toContain(
      PERMISSION_CODES.ORGANIZATION_MANAGE,
    );
    expect(ROLE_PERMISSION_MATRIX.OPERATOR).not.toContain(
      PERMISSION_CODES.ORGANIZATION_MANAGE,
    );
    expect(ROLE_PERMISSION_MATRIX.VIEWER).not.toContain(
      PERMISSION_CODES.ORGANIZATION_MANAGE,
    );
  });

  it('prevents VIEWER from having any mutation or administrative permissions', () => {
    const viewerPermissions = ROLE_PERMISSION_MATRIX.VIEWER;

    expect(viewerPermissions).toEqual([
      PERMISSION_CODES.CATALOG_READ,
      PERMISSION_CODES.INVENTORY_READ,
      PERMISSION_CODES.DASHBOARD_READ,
    ]);
    expect(viewerPermissions).not.toContain(PERMISSION_CODES.CATALOG_WRITE);
    expect(viewerPermissions).not.toContain(PERMISSION_CODES.INVENTORY_WRITE);
    expect(viewerPermissions).not.toContain(PERMISSION_CODES.ORDER_WRITE);
    expect(viewerPermissions).not.toContain(PERMISSION_CODES.MEMBER_MANAGE);
    expect(viewerPermissions).not.toContain(PERMISSION_CODES.AUDIT_READ);
  });

  it('prevents OPERATOR from managing members or reading audit logs', () => {
    const operatorPermissions = ROLE_PERMISSION_MATRIX.OPERATOR;

    expect(operatorPermissions).not.toContain(PERMISSION_CODES.MEMBER_MANAGE);
    expect(operatorPermissions).not.toContain(PERMISSION_CODES.AUDIT_READ);
    expect(operatorPermissions).not.toContain(PERMISSION_CODES.CATALOG_WRITE);
    expect(operatorPermissions).toContain(PERMISSION_CODES.INVENTORY_WRITE);
    expect(operatorPermissions).toContain(PERMISSION_CODES.ORDER_WRITE);
  });
});
