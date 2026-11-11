import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

test('web-employee App.tsx imports shared @dexa-wfh/ui components and checks /health/all', () => {
  const appSource = fs.readFileSync(
    path.resolve(import.meta.dirname, '../src/App.tsx'),
    'utf-8',
  );
  assert.match(appSource, /@dexa-wfh\/ui/);
  assert.match(appSource, /\/health\/all/);
});
