import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import {
  SERVICES,
  QUEUES,
  EVENTS,
  createHealthResponse,
  hashPassword,
  verifyPassword,
  signJwtToken,
  verifyJwtToken,
  getJakartaDateString,
  formatJakartaDateTime,
  hasValidImageMagicBytes,
  saveUploadedAvatar,
  InternalApiKeyGuard,
} from '../dist/index.js';

test('common constants and createHealthResponse work properly', () => {
  assert.equal(SERVICES.API_GATEWAY, 'api-gateway');
  assert.equal(QUEUES.LOG_QUEUE, 'dexa_wfh_logs_queue');
  assert.equal(EVENTS.PING, 'system.ping');
  assert.equal(EVENTS.PROFILE_UPDATED, 'employee.profile_updated');

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

test('password hashing, JWT signing, and Jakarta date formatting work properly', async () => {
  const hash = await hashPassword('Secret123!');
  assert.equal(await verifyPassword('Secret123!', hash), true);
  assert.equal(await verifyPassword('WrongPass', hash), false);

  const token = signJwtToken(
    {
      sub: 'emp-1',
      email: 'budi@example.com',
      name: 'Budi Santoso',
      role: 'EMPLOYEE',
      position: 'Engineer',
    },
    'test-secret',
    '1h',
  );
  const decoded = verifyJwtToken(token, 'test-secret');
  assert.equal(decoded.sub, 'emp-1');
  assert.equal(decoded.role, 'EMPLOYEE');

  const dateStr = getJakartaDateString(new Date('2026-11-11T01:30:00.000Z'));
  assert.equal(dateStr, '2026-11-11');
  const dtStr = formatJakartaDateTime('2026-11-11T01:30:00.000Z');
  assert.equal(dtStr, '2026-11-11 08:30');
});

test('saveUploadedAvatar validates MIME, extension, and magic bytes, and InternalApiKeyGuard blocks missing key', async () => {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'dexa-avatar-'));
  try {
    const validPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    assert.equal(hasValidImageMagicBytes(validPng, '.png'), true);
    assert.equal(hasValidImageMagicBytes(Buffer.from('not-an-image'), '.png'), false);

    // Reject spoofed extension with valid MIME
    await assert.rejects(
      () =>
        saveUploadedAvatar(
          {
            buffer: validPng,
            originalname: 'exploit.html',
            mimetype: 'image/png',
            size: validPng.length,
          },
          tmpDir,
        ),
      /Unsupported image format or extension/,
    );

    // Reject fake magic bytes
    await assert.rejects(
      () =>
        saveUploadedAvatar(
          {
            buffer: Buffer.from('plain text disguised as png'),
            originalname: 'fake.png',
            mimetype: 'image/png',
            size: 27,
          },
          tmpDir,
        ),
      /Invalid image binary signature/,
    );

    const savedUrl = await saveUploadedAvatar(
      {
        buffer: validPng,
        originalname: 'valid.png',
        mimetype: 'image/png',
        size: validPng.length,
      },
      tmpDir,
    );
    assert.ok(savedUrl.startsWith('/uploads/avatars/'));

    const guard = new InternalApiKeyGuard();
    assert.equal(
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ url: '/health', headers: {} }),
        }),
      }),
      true,
    );
    assert.throws(
      () =>
        guard.canActivate({
          switchToHttp: () => ({
            getRequest: () => ({ url: '/employees', headers: {} }),
          }),
        }),
      /Forbidden/,
    );
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
});
