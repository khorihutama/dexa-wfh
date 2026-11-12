import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createCorsOriginValidator,
  isLocalOrPrivateOrigin,
  loadEnvConfig,
  parseCorsOrigins,
} from '../dist/index.js';

function evaluate(validator, origin) {
  let outcome;
  validator(origin, (error, allow) => {
    outcome = { error, allow };
  });
  return outcome;
}

test('loadEnvConfig provides defaults and validates ports', () => {
  const cfg = loadEnvConfig({});
  assert.equal(cfg.API_GATEWAY_PORT, 3000);
  assert.equal(cfg.AUTH_SERVICE_PORT, 3001);
  assert.equal(cfg.EMPLOYEE_SERVICE_PORT, 3002);
  assert.equal(cfg.ATTENDANCE_SERVICE_PORT, 3003);
  assert.equal(cfg.LOG_SERVICE_PORT, 3004);
  assert.equal(cfg.CORS_ORIGIN, 'http://localhost:5173,http://localhost:5174');
  assert.deepEqual(parseCorsOrigins(cfg.CORS_ORIGIN), [
    'http://localhost:5173',
    'http://localhost:5174',
  ]);

  assert.throws(() => {
    loadEnvConfig({ API_GATEWAY_PORT: 'invalid' });
  }, /Invalid port configuration/);
});

test('CORS_ALLOW_LAN defaults to development only and validates booleans', () => {
  assert.equal(loadEnvConfig({}).CORS_ALLOW_LAN, true);
  assert.equal(loadEnvConfig({ NODE_ENV: 'production' }).CORS_ALLOW_LAN, false);
  assert.equal(loadEnvConfig({ NODE_ENV: 'test' }).CORS_ALLOW_LAN, false);
  assert.equal(loadEnvConfig({ CORS_ALLOW_LAN: 'true', NODE_ENV: 'production' }).CORS_ALLOW_LAN, true);
  assert.equal(loadEnvConfig({ CORS_ALLOW_LAN: 'false' }).CORS_ALLOW_LAN, false);

  assert.throws(() => {
    loadEnvConfig({ CORS_ALLOW_LAN: 'sometimes' });
  }, /Invalid boolean configuration for CORS_ALLOW_LAN/);
});

test('isLocalOrPrivateOrigin accepts loopback and private IPv4 origins only', () => {
  for (const origin of [
    'http://localhost:5173',
    'https://localhost',
    'http://127.0.0.1:5174',
    'http://0.0.0.0:5173',
    'http://[::1]:5173',
    'http://10.1.2.3:5173',
    'http://172.16.0.10:5173',
    'http://172.31.255.1:5174',
    'https://192.168.10.172:5173',
  ]) {
    assert.equal(isLocalOrPrivateOrigin(origin), true, origin);
  }

  for (const origin of [
    'https://evil.example',
    'http://8.8.8.8:5173',
    'http://172.32.0.1:5173',
    'http://192.169.1.1:5173',
    'http://localhost.evil.example:5173',
    'ftp://192.168.1.1',
    'http://192.168.1.1/not-an-origin',
    'not-a-url',
  ]) {
    assert.equal(isLocalOrPrivateOrigin(origin), false, origin);
  }
});

test('createCorsOriginValidator reflects LAN origins and keeps the exact allowlist', () => {
  const lanValidator = createCorsOriginValidator('http://localhost:5173,http://localhost:5174', true);
  for (const origin of [
    'http://0.0.0.0:5173',
    'http://192.168.10.172:5174',
    'http://localhost:5174',
  ]) {
    assert.deepEqual(evaluate(lanValidator, origin), { error: null, allow: true }, origin);
  }
  for (const origin of ['https://evil.example', 'http://8.8.8.8:5173']) {
    assert.deepEqual(evaluate(lanValidator, origin), { error: null, allow: false }, origin);
  }
  assert.deepEqual(evaluate(lanValidator, undefined), { error: null, allow: true });

  const strictValidator = createCorsOriginValidator('http://localhost:5173', false);
  assert.equal(evaluate(strictValidator, 'http://localhost:5173').allow, true);
  assert.equal(evaluate(strictValidator, 'http://192.168.10.172:5173').allow, false);
});

test('createCorsOriginValidator keeps an explicit wildcard reflected instead of returning "*"', () => {
  const validator = createCorsOriginValidator('*', false);
  assert.deepEqual(evaluate(validator, 'https://anything.example'), { error: null, allow: true });
  assert.equal(typeof validator, 'function');
});
