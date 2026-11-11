import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadEnvConfig } from '../dist/index.js';

test('loadEnvConfig provides defaults and validates ports', () => {
  const cfg = loadEnvConfig({});
  assert.equal(cfg.API_GATEWAY_PORT, 3000);
  assert.equal(cfg.AUTH_SERVICE_PORT, 3001);
  assert.equal(cfg.EMPLOYEE_SERVICE_PORT, 3002);
  assert.equal(cfg.ATTENDANCE_SERVICE_PORT, 3003);
  assert.equal(cfg.LOG_SERVICE_PORT, 3004);

  assert.throws(() => {
    loadEnvConfig({ API_GATEWAY_PORT: 'invalid' });
  }, /Invalid port configuration/);
});
