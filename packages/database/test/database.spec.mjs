import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PrismaService,
  DatabaseModule,
  Role,
  AttendanceStatus,
  toEmployeeProfileDto,
} from '../dist/index.js';

test('DatabaseModule, PrismaService, enums, and DTO mapper are defined', () => {
  assert.ok(DatabaseModule);
  assert.ok(PrismaService);
  assert.equal(Role.ADMIN, 'ADMIN');
  assert.equal(Role.EMPLOYEE, 'EMPLOYEE');
  assert.equal(AttendanceStatus.MASUK, 'MASUK');
  assert.equal(AttendanceStatus.PULANG, 'PULANG');

  const now = new Date('2026-11-11T01:00:00.000Z');
  const dto = toEmployeeProfileDto({
    id: 'emp-1',
    name: 'Budi Santoso',
    email: 'budi@example.com',
    passwordHash: 'secret-hash',
    photoUrl: '/uploads/avatars/default-budi.png',
    position: 'Engineer',
    phone: '081234567890',
    role: Role.EMPLOYEE,
    createdAt: now,
    updatedAt: now,
  });
  assert.equal(dto.id, 'emp-1');
  assert.equal(dto.role, 'EMPLOYEE');
  assert.equal('passwordHash' in dto, false);
});
