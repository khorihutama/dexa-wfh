import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppModule } from '../dist/app.module.js';
import { LogController } from '../dist/log.controller.js';
import { LogConsumerService } from '../dist/log-consumer.service.js';

test('Log Service module, controller, and consumer service are defined', () => {
  assert.ok(AppModule);
  assert.ok(LogController);
  assert.ok(LogConsumerService);
});
