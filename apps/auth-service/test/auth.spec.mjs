import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword } from '@dexa-wfh/common';
import { AppModule } from '../dist/app.module.js';
import { HealthController } from '../dist/health.controller.js';
import { AuthController } from '../dist/auth.controller.js';
import { AuthService } from '../dist/auth.service.js';

test('Auth Service AppModule, controllers, and service are defined', () => {
  assert.ok(AppModule);
  assert.ok(HealthController);
  assert.ok(AuthController);
  assert.ok(AuthService);
});

test('AuthService login, token validation, and password change logic work with mocked Prisma', async () => {
  const passwordHash = await hashPassword('REDACTED_EMPLOYEE_PASSWORD');
  const now = new Date('2026-11-11T01:00:00.000Z');
  const mockEmployee = {
    id: 'emp-budi',
    name: 'Budi Santoso',
    email: 'budi.santoso@example.com',
    passwordHash,
    photoUrl: '/uploads/avatars/default-budi.png',
    position: 'Senior Software Engineer',
    phone: '081234567890',
    role: 'EMPLOYEE',
    createdAt: now,
    updatedAt: now,
  };

  let updatedHash = passwordHash;
  const mockPrisma = {
    employee: {
      findUnique: async ({ where }) => {
        if (where.email === mockEmployee.email || where.id === mockEmployee.id) {
          return { ...mockEmployee, passwordHash: updatedHash };
        }
        return null;
      },
      update: async ({ data }) => {
        updatedHash = data.passwordHash;
        return { ...mockEmployee, passwordHash: updatedHash };
      },
    },
  };

  const authService = new AuthService(mockPrisma);

  const loginResult = await authService.login({
    email: 'Budi.Santoso@example.com',
    password: 'REDACTED_EMPLOYEE_PASSWORD',
  });
  assert.ok(loginResult.accessToken);
  assert.equal(loginResult.user.email, 'budi.santoso@example.com');
  assert.equal(loginResult.user.role, 'EMPLOYEE');

  const validated = await authService.validateToken(loginResult.accessToken);
  assert.equal(validated.valid, true);
  assert.equal(validated.payload.sub, 'emp-budi');

  const pwdUpdate = await authService.updatePassword(
    { userId: 'emp-budi' },
    { currentPassword: 'REDACTED_EMPLOYEE_PASSWORD', newPassword: 'NewPassword456!' },
  );
  assert.equal(pwdUpdate.updated, true);

  const relogin = await authService.login({
    email: 'budi.santoso@example.com',
    password: 'NewPassword456!',
  });
  assert.ok(relogin.accessToken);
});
