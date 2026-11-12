import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const appRoot = path.resolve(import.meta.dirname, '..');
const srcDir = path.join(appRoot, 'src');
const repoRoot = path.resolve(appRoot, '../..');

function readSrc(relativePath) {
  return fs.readFileSync(path.join(srcDir, relativePath), 'utf-8');
}

test('index.html sets lang="id", admin title, and contains no em-dash characters', () => {
  const html = fs.readFileSync(path.join(appRoot, 'index.html'), 'utf-8');
  assert.match(html, /<html\s+lang="id"/);
  assert.match(html, /<title>Dexa WFH: Portal Monitoring Admin HRD<\/title>/);
  assert.equal(html.includes('\u2014'), false, 'index.html must not contain em-dash');
});

test('index.css imports tailwindcss, scans @dexa-wfh/ui, and respects prefers-reduced-motion', () => {
  const css = readSrc('index.css');
  assert.match(css, /@import\s+"tailwindcss"/);
  assert.match(css, /@source\s+"\.\.\/\.\.\/\.\.\/packages\/ui\/src"/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test('api.ts covers admin login, employee CRUD, and attendance monitoring endpoints', () => {
  const apiSource = readSrc('api.ts');
  assert.match(apiSource, /\/auth\/login/);
  assert.match(apiSource, /\/employees\/me/);
  assert.match(apiSource, /\/employees\?\$\{params\.toString\(\)\}/);
  assert.match(apiSource, /method: 'POST'[\s\S]*?\/employees`/);
  assert.match(apiSource, /method: 'PATCH'/);
  assert.match(apiSource, /method: 'DELETE'/);
  assert.match(apiSource, /\/attendances\?/);
  assert.match(apiSource, /new FormData\(\)/);
  assert.match(apiSource, /Asia\/Jakarta/);
  assert.match(apiSource, /dexa_wfh_admin_token/);
});

test('LoginView renders admin login landmarks without hardcoded demo credentials', () => {
  const loginSource = readSrc('components/LoginView.tsx');
  assert.match(loginSource, /<header/);
  assert.match(loginSource, /<main/);
  assert.match(loginSource, /<footer/);
  assert.match(loginSource, /<h1/);
  assert.match(loginSource, /admin@example\.com/);
  assert.doesNotMatch(loginSource, /DEMO_ADMIN/);
  assert.doesNotMatch(loginSource, /Akun demo/);
});

test('AdminLayout exposes the two admin menus plus logout and socket status', () => {
  const layoutSource = readSrc('components/AdminLayout.tsx');
  assert.match(layoutSource, /Data Karyawan/);
  assert.match(layoutSource, /Monitoring Absensi/);
  assert.match(layoutSource, /<nav/);
  assert.match(layoutSource, /Keluar/);
  assert.match(layoutSource, /socketConnected/);
});

test('EmployeeManager provides create, edit, delete flows with photo upload and search', () => {
  const managerSource = readSrc('components/EmployeeManager.tsx');
  assert.match(managerSource, /Nama Lengkap/);
  assert.match(managerSource, /Email Perusahaan/);
  assert.match(managerSource, /Posisi \/ Jabatan/);
  assert.match(managerSource, /Nomor Handphone/);
  assert.match(managerSource, /image\/jpeg,image\/png,image\/webp/);
  assert.match(managerSource, /Tambah Karyawan/);
  assert.match(managerSource, /Ubah/);
  assert.match(managerSource, /Hapus Permanen/);
  assert.match(managerSource, /onSearch/);
});

test('AttendanceMonitor is read-only with From-To filter, search, and Masuk/Pulang columns', () => {
  const monitorSource = readSrc('components/AttendanceMonitor.tsx');
  assert.match(monitorSource, /Filter Tanggal \(From - To\)/);
  assert.match(monitorSource, /Dari Tanggal/);
  assert.match(monitorSource, /Sampai Tanggal/);
  assert.match(monitorSource, />\s*Cari\s*</);
  assert.match(monitorSource, /Read-only/);
  assert.match(monitorSource, /Masuk/);
  assert.match(monitorSource, /Pulang/);
  assert.equal(/check-in|check-out/.test(monitorSource), false, 'admin monitoring must not record attendance');
});

test('App.tsx gates ADMIN role, subscribes to admin.notification, and renders toasts', () => {
  const appSource = readSrc('App.tsx');
  assert.match(appSource, /socket\.io-client/);
  assert.match(appSource, /admin\.notification/);
  assert.match(appSource, /@dexa-wfh\/ui/);
  assert.match(appSource, /role !== 'ADMIN'/);
  assert.match(appSource, /auth: \{ token \}/, 'socket handshake must carry the admin JWT');
  assert.match(appSource, /NotificationToasts/);
  assert.match(appSource, /EmployeeManager/);
  assert.match(appSource, /AttendanceMonitor/);
});

test('api-gateway broadcasts a Socket.IO notification for every check-in and check-out', () => {
  const gatewaySource = fs.readFileSync(
    path.join(repoRoot, 'apps/api-gateway/src/gateway.controller.ts'),
    'utf-8',
  );
  const checkInBlock = gatewaySource.slice(
    gatewaySource.indexOf('async checkIn('),
    gatewaySource.indexOf('async checkOut('),
  );
  const checkOutBlock = gatewaySource.slice(
    gatewaySource.indexOf('async checkOut('),
    gatewaySource.indexOf('async recordAttendance('),
  );
  assert.match(checkInBlock, /broadcastAttendanceResult/);
  assert.match(checkOutBlock, /broadcastAttendanceResult/);
  assert.match(gatewaySource, /attendance\.recorded/);
});

test('no source file contains em-dash characters', () => {
  for (const file of fs.readdirSync(srcDir, { recursive: true })) {
    const full = path.join(srcDir, String(file));
    if (!fs.statSync(full).isFile()) continue;
    const content = fs.readFileSync(full, 'utf-8');
    assert.equal(content.includes('\u2014'), false, `${file} must not contain em-dash`);
  }
});
