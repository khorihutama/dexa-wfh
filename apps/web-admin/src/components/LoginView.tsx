import React, { useState } from 'react';
import { Alert, Badge, Button, Card, Input } from '@dexa-wfh/ui';

export interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  onClearError: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLogin,
  loading,
  error,
  onClearError,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onClearError();
    setValidationError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setValidationError('Masukkan alamat email kantor yang valid.');
      return;
    }
    if (!password) {
      setValidationError('Kata sandi wajib diisi.');
      return;
    }
    await onLogin(trimmedEmail, password);
  };

  const activeError = validationError || error;

  return (
    <div className="flex min-h-screen flex-col justify-between bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-700 text-sm font-bold tracking-wider text-white">
              DX
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
                Dexa Group
              </p>
              <p className="text-sm font-semibold text-slate-900">
                Monitoring Kehadiran Work From Home
              </p>
            </div>
          </div>
          <Badge variant="danger">Akses HRD</Badge>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid w-full gap-8 lg:grid-cols-12 lg:items-start">
          <section className="space-y-4 lg:col-span-6 lg:pr-4">
            <Badge variant="info">Portal Admin HRD</Badge>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Kendali Data Karyawan &amp; Monitoring Absensi
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
              Kelola data karyawan Dexa Group, pantau rekap kehadiran WFH seluruh karyawan, dan
              terima pemberitahuan real-time setiap karyawan melakukan absen masuk atau pulang.
            </p>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Kewenangan Akun Admin
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-700" />
                  <span>Tambah, ubah, dan hapus data karyawan beserta foto profil.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-700" />
                  <span>
                    Rekap absensi bersifat baca saja: admin memantau, bukan mencatat kehadiran.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-700" />
                  <span>Notifikasi absensi masuk dan pulang tampil langsung tanpa perlu muat ulang.</span>
                </li>
              </ul>
            </div>
          </section>

          <section className="lg:col-span-6">
            <Card
              title="Masuk ke Akun Admin HRD"
              subtitle="Gunakan email perusahaan dengan peran ADMIN"
            >
              {activeError ? (
                <div className="mb-4">
                  <Alert
                    variant="error"
                    title="Gagal Masuk"
                    onClose={() => {
                      setValidationError(null);
                      onClearError();
                    }}
                  >
                    {activeError}
                  </Alert>
                </div>
              ) : null}
              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
                <Input
                  id="admin-email"
                  name="email"
                  type="email"
                  label="Email Perusahaan"
                  placeholder="admin@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
                <Input
                  id="admin-password"
                  name="password"
                  type="password"
                  label="Kata Sandi"
                  placeholder="Masukkan kata sandi"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <Button type="submit" variant="primary" loading={loading} className="w-full">
                  {loading ? 'Memverifikasi Akun...' : 'Masuk Portal Admin'}
                </Button>
              </form>
            </Card>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 text-xs text-slate-500 sm:px-6">
          Dexa Group WFH Attendance System &middot; Zona waktu Asia/Jakarta (WIB)
        </div>
      </footer>
    </div>
  );
};
