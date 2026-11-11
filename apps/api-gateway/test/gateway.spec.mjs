import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signJwtToken } from '@dexa-wfh/common';
import { loadEnvConfig } from '@dexa-wfh/config';
import { AppModule } from '../dist/app.module.js';
import { GatewayController, validatePingDto } from '../dist/gateway.controller.js';
import { JwtAuthGuard, RolesGuard } from '../dist/auth.guards.js';

test('API Gateway AppModule, GatewayController, and guards are defined', () => {
  assert.ok(AppModule);
  assert.ok(GatewayController);
  assert.ok(JwtAuthGuard);
  assert.ok(RolesGuard);
});

test('JwtAuthGuard and validatePingDto enforce authentication and DTO rules', () => {
  const config = loadEnvConfig();
  const guard = new JwtAuthGuard();

  const token = signJwtToken(
    {
      sub: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin HRD',
      role: 'ADMIN',
      position: 'HRD Manager',
    },
    config.JWT_SECRET,
    '1h',
  );

  const req = {
    headers: {
      authorization: `Bearer ${token}`,
    },
  };

  const mockContext = {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  };

  assert.equal(guard.canActivate(mockContext), true);
  assert.equal(req.user.role, 'ADMIN');

  assert.equal(validatePingDto({ message: 'Valid ping' }), 'Valid ping');
  assert.throws(() => validatePingDto({ message: '   ' }), /cannot be empty/);
});
