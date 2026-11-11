import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  Button,
  Input,
  Card,
  Badge,
  Alert,
  Avatar,
  Modal,
  Spinner,
} from '../dist/index.js';

test('All 8 shared UI components are exported functions', () => {
  assert.equal(typeof Button, 'function');
  assert.equal(typeof Input, 'function');
  assert.equal(typeof Card, 'function');
  assert.equal(typeof Badge, 'function');
  assert.equal(typeof Alert, 'function');
  assert.equal(typeof Avatar, 'function');
  assert.equal(typeof Modal, 'function');
  assert.equal(typeof Spinner, 'function');
});
