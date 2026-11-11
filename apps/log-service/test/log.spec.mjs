import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppModule } from '../dist/app.module.js';
import { LogController } from '../dist/log.controller.js';
import { LogConsumerService, sanitizeLogData } from '../dist/log-consumer.service.js';

test('Log Service module, controller, consumer service, and log sanitizer work properly', () => {
  assert.ok(AppModule);
  assert.ok(LogController);
  assert.ok(LogConsumerService);

  const sanitized = sanitizeLogData({
    employeeId: 'emp-1',
    email: 'budi@example.com',
    password: 'PlainPassword123!',
    nested: {
      newPassword: 'Secret',
      phone: '081234567890',
    },
  });

  assert.equal(sanitized.password, '[REDACTED]');
  assert.equal(sanitized.nested.newPassword, '[REDACTED]');
  assert.equal(sanitized.nested.phone, '081234567890');
});
