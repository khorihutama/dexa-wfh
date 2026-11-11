import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Button, Input, Card } from '../dist/index.js';

test('UI components Button, Input, and Card are exported functions', () => {
  assert.equal(typeof Button, 'function');
  assert.equal(typeof Input, 'function');
  assert.equal(typeof Card, 'function');
});
