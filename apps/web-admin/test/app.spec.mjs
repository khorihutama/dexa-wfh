import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

test('web-admin App.tsx connects Socket.IO, renders toast notifications, and uses @dexa-wfh/ui', () => {
  const appSource = fs.readFileSync(
    path.resolve(import.meta.dirname, '../src/App.tsx'),
    'utf-8',
  );
  assert.match(appSource, /socket\.io-client/);
  assert.match(appSource, /admin\.notification/);
  assert.match(appSource, /@dexa-wfh\/ui/);
  assert.match(appSource, /\/health\/all/);
});
