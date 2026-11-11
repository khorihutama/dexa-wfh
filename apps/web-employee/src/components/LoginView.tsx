import React, { useState } from 'react';
import { Alert, Badge, Button, Card, Input } from '@dexa-wfh/ui';

export interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  onClearError: () => void;
}

const DEMO_EMPLOYEES = [
  {
    name: 'Budi Santoso',
    position: 'Senior Backend Engineer',
    email: 'budi.santoso@example.com',
    password: 'REDACTED_EMPLOYEE_PASSWORD',
  },
  {
    name: 'Siti Rahma',
    position: 'Product Designer',
    email: 'siti.rahma@example.com',
    password: 'REDACTED_EMPLOYEE_PASSWORD',
  },
];

export const LoginView: React.FC<LoginViewProps> = ({
  onLogin,
  loading,
  error,
  onClearError,
}) => {
  const [email, setEmail] = useState('budi.santoso@example.com');
  const [password, setPassword] = useState('REDACTED_EMPLOYEE_PASSWORD');
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

  const handleFillDemo = (demoEmail: string, demoPassword: string) => {
    onClearError();
    setValidationError(null);
    setEmail(demoEmail);
    setPassword(demoPassword);
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
                Sistem Kehadiran Work From Home
              </p>
            </div>
          </div>
          <Badge variant="neutral">Zona Waktu WIB</Badge>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid w-full gap-8 lg:grid-cols-12 lg:items-start">
          <section className="space-y-4 lg:col-span-6 lg:pr-4">
            <Badge variant="info">Portal Karyawan WFH</Badge>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Portal Absensi WFH Karyawan
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
              Catat kehadiran masuk dan pulang kerja dari rumah, perbarui nomor handphone dan foto profil, serta tinjau rekap absensi bulanan secara langsung.
            </p>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Ketentuan Absensi Harian
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-700" />
                  <span>
                    Absen Masuk dan Absen Pulang masing-masing tercatat maksimal 1 kali per hari kalender WIB.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-700" />
                  <span>
                    Rekap kehadiran otomatis menampilkan periode awal bulan berjalan hingga hari ini.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-700" />
                  <span>
                    Perubahan foto profil, nomor handphone, atau kata sandi langsung diteruskan ke sistem audit HRD.
                  </span>
                </li>
              </ul>
            </div>
          </section>

          <section className="lg:col-span-6">
            <Card
              title="Masuk ke Akun Karyawan"
              subtitle="Gunakan email perusahaan (@example.com) dan kata sandi Anda"
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
                  id="login-email"
                  name="email"
                  type="email"
                  label="Email Perusahaan"
                  placeholder="nama.karyawan@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />

                <Input
                  id="login-password"
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

                <Button
                  type="submit"
                  variant="primary"
                  loading={loading}
                  className="w-full"
                >
                  {loading ? 'Memverifikasi Akun...' : 'Masuk Portal Karyawan'}
                </Button>
              </form>

              <div className="mt-6 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Akun Demo Pengujian Cepat
                </p>
                <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  {DEMO_EMPLOYEES.map((demo) => (
                    <button
                      key={demo.email}
                      type="button"
                      onClick={() => handleFillDemo(demo.email, demo.password)}
                      disabled={loading}
                      className="flex min-h-[44px] flex-col items-start justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:border-red-300 hover:bg-red-50/40 focus:outline-none focus:ring-2 focus:ring-red-600"
                    >
                      <span className="text-xs font-semibold text-slate-900">
                        {demo.name}
                      </span>
                      <span className="text-[11px] text-slate-600">{demo.position}</span>
                      <span className="mt-0.5 font-mono text-[11px] text-red-700">
                        {demo.email}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          </section>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:px-6">
          <span>Dexa Group Human Resources Information System</span>
          <span>Layanan Mandiri Absensi Karyawan WFH</span>
        </div>
      </footer>
    </div>
  );
};
