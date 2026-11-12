import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword } from '@dexa-wfh/common';
import { AppModule } from '../dist/app.module.js';
import { HealthController } from '../dist/health.controller.js';
import { EmployeeController } from '../dist/employee.controller.js';
import { EmployeeService } from '../dist/employee.service.js';

test('Employee Service AppModule, controllers, and service are defined', () => {
  assert.ok(AppModule);
  assert.ok(HealthController);
  assert.ok(EmployeeController);
  assert.ok(EmployeeService);
});

test('EmployeeService profile updates emit events and Admin CRUD prevents self-deletion', async () => {
  const now = new Date('2026-11-11T01:00:00.000Z');
  const pwdHash = await hashPassword('TestPassw0rd!');
  const store = new Map();
  store.set('emp-1', {
    id: 'emp-1',
    name: 'Budi Santoso',
    email: 'budi.santoso@example.com',
    passwordHash: pwdHash,
    photoUrl: '/uploads/avatars/default-budi.png',
    position: 'Engineer',
    phone: '081234567890',
    role: 'EMPLOYEE',
    createdAt: now,
    updatedAt: now,
  });

  const publishedEvents = [];
  const mockPrisma = {
    employee: {
      findUnique: async ({ where }) => {
        if (where.id) return store.get(where.id) ?? null;
        if (where.email) {
          for (const emp of store.values()) {
            if (emp.email === where.email) return emp;
          }
        }
        return null;
      },
      update: async ({ where, data }) => {
        const current = store.get(where.id);
        const updated = { ...current, ...data, updatedAt: new Date() };
        store.set(where.id, updated);
        return updated;
      },
      delete: async ({ where }) => {
        const current = store.get(where.id);
        store.delete(where.id);
        return current;
      },
    },
  };

  const mockEvents = {
    publishProfileUpdated: async (payload) => {
      publishedEvents.push(payload);
      return { rabbitMqDispatched: true, gatewayNotified: true };
    },
  };

  const service = new EmployeeService(mockPrisma, mockEvents);

  // Reject password change when currentPassword is missing
  await assert.rejects(
    () =>
      service.updateMyProfile(
        { userId: 'emp-1' },
        { newPassword: 'UpdatedPass123!' },
      ),
    /Current password is required to change password/,
  );

  const updated = await service.updateMyProfile(
    { userId: 'emp-1' },
    {
      phone: '081999888777',
      photoUrl: 'https://example.com/budi-new.png',
      currentPassword: 'TestPassw0rd!',
      newPassword: 'UpdatedPass123!',
    },
  );

  assert.equal(updated.phone, '081999888777');
  assert.equal(updated.photoUrl, 'https://example.com/budi-new.png');
  assert.deepEqual(updated.changedFields, ['photoUrl', 'phone', 'password']);
  assert.equal(publishedEvents.length, 1);
  assert.equal(publishedEvents[0].changes.password.after, '[REDACTED]');

  await assert.rejects(
    () => service.deleteEmployeeByAdmin('emp-1', { userId: 'emp-1' }),
    /Admin cannot delete their own currently logged-in account/,
  );
});
