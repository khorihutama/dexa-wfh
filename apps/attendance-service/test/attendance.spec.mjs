import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getJakartaDateString } from '@dexa-wfh/common';
import { AppModule } from '../dist/app.module.js';
import { HealthController } from '../dist/health.controller.js';
import { AttendanceController } from '../dist/attendance.controller.js';
import { AttendanceService } from '../dist/attendance.service.js';

test('Attendance Service AppModule, controllers, and service are defined', () => {
  assert.ok(AppModule);
  assert.ok(HealthController);
  assert.ok(AttendanceController);
  assert.ok(AttendanceService);
});

test('AttendanceService enforces 1x MASUK and 1x PULANG per Jakarta date and builds paired summary', async () => {
  const records = [];
  const mockPrisma = {
    employee: {
      findUnique: async ({ where }) =>
        where.id === 'emp-1'
          ? { id: 'emp-1', name: 'Budi Santoso', email: 'budi@example.com' }
          : null,
    },
    attendance: {
      findUnique: async ({ where }) => {
        const key = where.employeeId_date_status;
        return (
          records.find(
            (r) =>
              r.employeeId === key.employeeId &&
              r.date === key.date &&
              r.status === key.status,
          ) ?? null
        );
      },
      create: async ({ data }) => {
        const created = {
          id: `att-${records.length + 1}`,
          ...data,
        };
        records.push(created);
        return created;
      },
      findMany: async ({ where }) => {
        return records.filter((r) => {
          if (where.employeeId && r.employeeId !== where.employeeId) return false;
          if (typeof where.date === 'string' && r.date !== where.date) return false;
          if (where.date?.gte && r.date < where.date.gte) return false;
          if (where.date?.lte && r.date > where.date.lte) return false;
          return true;
        });
      },
    },
  };

  const service = new AttendanceService(mockPrisma);

  // Reject PULANG before MASUK
  await assert.rejects(
    () => service.checkOut({ userId: 'emp-1' }),
    /Cannot check out \(PULANG\) before checking in \(MASUK\)/,
  );

  // First MASUK succeeds
  const checkInRes = await service.checkIn({ userId: 'emp-1' });
  assert.equal(checkInRes.record.status, 'MASUK');
  assert.equal(checkInRes.todayStatus.hasCheckedIn, true);
  assert.equal(checkInRes.todayStatus.hasCheckedOut, false);

  // Duplicate MASUK on the same day is rejected
  await assert.rejects(
    () => service.checkIn({ userId: 'emp-1' }),
    /Already checked in \(MASUK\) for today/,
  );

  // First PULANG succeeds
  const checkOutRes = await service.checkOut({ userId: 'emp-1' });
  assert.equal(checkOutRes.record.status, 'PULANG');
  assert.equal(checkOutRes.todayStatus.hasCheckedOut, true);

  // Duplicate PULANG on the same day is rejected
  await assert.rejects(
    () => service.checkOut({ userId: 'emp-1' }),
    /Already checked out \(PULANG\) for today/,
  );

  const summary = await service.getMyAttendanceSummary({ userId: 'emp-1' }, {});
  const today = getJakartaDateString();
  assert.equal(summary.summary.length, 1);
  assert.equal(summary.summary[0].date, today);
  assert.ok(summary.summary[0].masuk);
  assert.ok(summary.summary[0].pulang);
  assert.equal(summary.summary[0].status, 'COMPLETE');
});
