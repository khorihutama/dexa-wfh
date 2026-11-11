import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppModule } from '../dist/app.module.js';
import { HealthController } from '../dist/health.controller.js';

test('Attendance Service AppModule and HealthController are defined', () => {
  assert.ok(AppModule);
  assert.ok(HealthController);
});
