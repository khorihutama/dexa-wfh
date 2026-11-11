import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const srcDir = path.resolve(import.meta.dirname, '../src');
const htmlPath = path.resolve(import.meta.dirname, '../index.html');

function readSrc(relativePath) {
  return fs.readFileSync(path.join(srcDir, relativePath), 'utf-8');
}

test('index.html sets lang="id", unique title, and contains no em-dash characters', () => {
  const html = fs.readFileSync(htmlPath, 'utf-8');
  assert.match(html, /<html\s+lang="id"/);
  assert.match(html, /<title>Dexa WFH: Portal Absensi Karyawan<\/title>/);
  assert.equal(html.includes('\u2014'), false, 'index.html must not contain em-dash');
});

test('index.css imports tailwindcss, scans @dexa-wfh/ui, and respects prefers-reduced-motion', () => {
  const css = readSrc('index.css');
  assert.match(css, /@import\s+"tailwindcss"/);
  assert.match(css, /@source\s+"\.\.\/\.\.\/\.\.\/packages\/ui\/src"/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test('api.ts integrates all required API Gateway endpoints and WIB date helpers', () => {
  const apiSource = readSrc('api.ts');
  assert.match(apiSource, /\/auth\/login/);
  assert.match(apiSource, /\/employees\/me/);
  assert.match(apiSource, /\/employees\/me\/photo/);
  assert.match(apiSource, /\/attendances\/today/);
  assert.match(apiSource, /\/attendances\/check-in/);
  assert.match(apiSource, /\/attendances\/check-out/);
  assert.match(apiSource, /\/attendances\/me/);
  assert.match(apiSource, /new FormData\(\)/);
  assert.match(apiSource, /Asia\/Jakarta/);
});

test('LoginView and PortalLayout provide semantic landmarks and 3 main employee menus', () => {
  const loginSource = readSrc('components/LoginView.tsx');
  const layoutSource = readSrc('components/PortalLayout.tsx');

  assert.match(loginSource, /<header/);
  assert.match(loginSource, /<main/);
  assert.match(loginSource, /<footer/);
  assert.match(loginSource, /<h1/);
  assert.match(loginSource, /budi\.santoso@dexagroup\.com/);
  assert.match(loginSource, /siti\.rahma@dexagroup\.com/);

  assert.match(layoutSource, /Profil Karyawan/);
  assert.match(layoutSource, /Absen Masuk & Pulang/);
  assert.match(layoutSource, /Summary Absen/);
  assert.match(layoutSource, /<nav/);
  assert.match(layoutSource, /Keluar/);
});

test('ProfileView displays employee identity and supports photo upload, phone, and password update', () => {
  const profileSource = readSrc('components/ProfileView.tsx');
  assert.match(profileSource, /Nama Lengkap/);
  assert.match(profileSource, /Email Perusahaan/);
  assert.match(profileSource, /Posisi \/ Jabatan/);
  assert.match(profileSource, /Nomor Handphone/);
  assert.match(profileSource, /image\/jpeg,image\/png,image\/webp/);
  assert.match(profileSource, /currentPassword/);
  assert.match(profileSource, /newPassword/);
  assert.match(profileSource, /confirmPassword/);
});

test('AttendanceView enforces 1x Masuk & 1x Pulang per day with real-time WIB clock', () => {
  const attendanceSource = readSrc('components/AttendanceView.tsx');
  assert.match(attendanceSource, /Absen Masuk/);
  assert.match(attendanceSource, /Absen Pulang/);
  assert.match(attendanceSource, /Sudah Absen Masuk/);
  assert.match(attendanceSource, /Sudah Absen Pulang/);
  assert.match(attendanceSource, /formatWibClock/);
  assert.match(attendanceSource, /MASUK/);
  assert.match(attendanceSource, /PULANG/);
});

test('SummaryView supports From-To date filter, Cari button, and Masuk/Pulang table columns', () => {
  const summarySource = readSrc('components/SummaryView.tsx');
  assert.match(summarySource, /Filter Tanggal \(From - To\)/);
  assert.match(summarySource, /type="date"/);
  assert.match(summarySource, /Cari/);
  assert.match(summarySource, /Masuk/);
  assert.match(summarySource, /Pulang/);
  assert.match(summarySource, /getJakartaMonthStartString/);
  assert.match(summarySource, /getJakartaDateString/);
});

test('App.tsx wires LoginView, PortalLayout, ProfileView, AttendanceView, and SummaryView with zero em-dashes', () => {
  const filesToCheck = [
    'api.ts',
    'App.tsx',
    'components/LoginView.tsx',
    'components/PortalLayout.tsx',
    'components/ProfileView.tsx',
    'components/AttendanceView.tsx',
    'components/SummaryView.tsx',
  ];

  for (const rel of filesToCheck) {
    const content = readSrc(rel);
    assert.equal(
      content.includes('\u2014'),
      false,
      `${rel} must not contain any em-dash character`,
    );
  }

  const appSource = readSrc('App.tsx');
  assert.match(appSource, /LoginView/);
  assert.match(appSource, /PortalLayout/);
  assert.match(appSource, /ProfileView/);
  assert.match(appSource, /AttendanceView/);
  assert.match(appSource, /SummaryView/);
});
