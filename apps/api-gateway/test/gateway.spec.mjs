import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppModule } from '../dist/app.module.js';
import { GatewayController } from '../dist/gateway.controller.js';

test('API Gateway AppModule and GatewayController are defined', () => {
  assert.ok(AppModule);
  assert.ok(GatewayController);
});
