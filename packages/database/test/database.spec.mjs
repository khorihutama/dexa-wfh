import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaService, DatabaseModule } from '../dist/index.js';

test('DatabaseModule and PrismaService are defined', () => {
  assert.ok(DatabaseModule);
  assert.ok(PrismaService);
});
