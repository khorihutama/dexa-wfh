import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SERVICES, QUEUES, EVENTS, createHealthResponse } from '../dist/index.js';

test('common constants and createHealthResponse work properly', () => {
  assert.equal(SERVICES.API_GATEWAY, 'api-gateway');
  assert.equal(QUEUES.LOG_QUEUE, 'dexa_wfh_logs_queue');
  assert.equal(EVENTS.PING, 'system.ping');

  const okHealth = createHealthResponse(SERVICES.AUTH_SERVICE, {
    postgres: { status: 'up' },
  });
  assert.equal(okHealth.service, 'auth-service');
  assert.equal(okHealth.status, 'ok');

  const degradedHealth = createHealthResponse(SERVICES.AUTH_SERVICE, {
    postgres: { status: 'down', message: 'Connection refused' },
  });
  assert.equal(degradedHealth.status, 'degraded');
});
