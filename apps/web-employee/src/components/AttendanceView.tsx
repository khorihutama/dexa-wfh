import React, { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Spinner } from '@dexa-wfh/ui';
import {
  AttendanceActionResponse,
  formatWibClock,
  formatWibLongDate,
  TodayAttendanceStatus,
} from '../api';

export interface AttendanceViewProps {
  todayStatus: TodayAttendanceStatus | null;
  loadingStatus: boolean;
  statusError: string | null;
  onRefreshToday: () => Promise<void>;
  onCheckIn: () => Promise<AttendanceActionResponse>;
  onCheckOut: () => Promise<AttendanceActionResponse>;
  onNavigateSummary: () => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  todayStatus,
  loadingStatus,
  statusError,
  onRefreshToday,
  onCheckIn,
  onCheckOut,
  onNavigateSummary,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());
  const [actionLoading, setActionLoading] = useState<'MASUK' | 'PULANG' | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const hasCheckedIn = Boolean(todayStatus?.hasCheckedIn);
  const hasCheckedOut = Boolean(todayStatus?.hasCheckedOut);

  const handleAction = async (type: 'MASUK' | 'PULANG') => {
    setFeedback(null);
    setActionLoading(type);
    try {
      const response = type === 'MASUK' ? await onCheckIn() : await onCheckOut();
      setFeedback({
        type: 'success',
        title:
          type === 'MASUK'
            ? 'Absen Masuk Berhasil Dicatat'
            : 'Absen Pulang Berhasil Dicatat',
        message: `Tercatat pada tanggal ${response.record.date} pukul ${response.record.formattedTime} WIB dengan status ${response.record.status}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        title:
          type === 'MASUK'
            ? 'Gagal Mencatat Absen Masuk'
            : 'Gagal Mencatat Absen Pulang',
        message:
          err instanceof Error
            ? err.message
            : 'Permintaan pencatatan kehadiran tidak dapat diproses.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Absen Masuk &amp; Pulang Kantor
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Pencatatan kehadiran harian Work From Home (1 kali Masuk dan 1 kali Pulang per hari kalender WIB).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void onRefreshToday()}
            disabled={loadingStatus || actionLoading !== null}
          >
            Muat Ulang Status
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onNavigateSummary}
          >
            Lihat Summary Absen
          </Button>
        </div>
      </div>

      {feedback ? (
        <Alert
          variant={feedback.type}
          title={feedback.title}
          onClose={() => setFeedback(null)}
        >
          {feedback.message}
        </Alert>
      ) : null}

      {statusError ? (
        <Alert
          variant="error"
          title="Gagal Memuat Status Kehadiran Hari Ini"
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void onRefreshToday()}
            >
              Coba Lagi
            </Button>
          }
        >
          {statusError}
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Card
            title="Waktu Server & Zona Waktu WIB"
            subtitle="Asia/Jakarta (UTC+07:00)"
            badge={
              hasCheckedIn && hasCheckedOut ? (
                <Badge variant="success">Selesai Hari Ini</Badge>
              ) : hasCheckedIn ? (
                <Badge variant="info">Sedang Bekerja</Badge>
              ) : (
                <Badge variant="warning">Belum Absen Masuk</Badge>
              )
            }
          >
            <div className="rounded-xl border border-slate-200 bg-slate-900 px-5 py-6 text-center text-white">
              <p className="text-xs font-semibold uppercase tracking-widest text-red-300">
                {formatWibLongDate(now)}
              </p>
              <p
                className="mt-2 font-mono text-3xl font-bold tracking-wider tabular-nums sm:text-4xl"
                aria-label="Jam digital Waktu Indonesia Barat"
              >
                {formatWibClock(now)} <span className="text-base font-medium text-slate-300">WIB</span>
              </p>
              <p className="mt-2 text-xs text-slate-300">
                Tanggal Kalender Absen: <span className="font-mono font-semibold text-white">{todayStatus?.date ?? '-'}</span>
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="success"
                size="lg"
                disabled={loadingStatus || hasCheckedIn || actionLoading !== null}
                loading={actionLoading === 'MASUK'}
                onClick={() => void handleAction('MASUK')}
                className="w-full"
              >
                {hasCheckedIn ? 'Sudah Absen Masuk' : 'Absen Masuk'}
              </Button>

              <Button
                type="button"
                variant="primary"
                size="lg"
                disabled={
                  loadingStatus ||
                  !hasCheckedIn ||
                  hasCheckedOut ||
                  actionLoading !== null
                }
                loading={actionLoading === 'PULANG'}
                onClick={() => void handleAction('PULANG')}
                className="w-full"
              >
                {hasCheckedOut ? 'Sudah Absen Pulang' : 'Absen Pulang'}
              </Button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-600">
              {!hasCheckedIn
                ? 'Silakan tekan tombol Absen Masuk saat memulai jam kerja WFH hari ini.'
                : !hasCheckedOut
                  ? 'Anda telah tercatat Masuk. Tombol Absen Pulang aktif untuk mencatat jam selesai kerja.'
                  : 'Kehadiran Masuk dan Pulang untuk hari ini telah lengkap tercatat.'}
            </p>
          </Card>
        </div>

        <div className="lg:col-span-7">
          <Card
            title="Status Kehadiran Hari Ini"
            subtitle="Data Tanggal, Waktu, dan Status (MASUK / PULANG) yang tersimpan"
          >
            {loadingStatus && !todayStatus ? (
              <div className="py-10">
                <Spinner label="Memuat status absensi hari ini..." />
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Status Masuk
                      </span>
                      <Badge variant={hasCheckedIn ? 'success' : 'neutral'}>
                        {hasCheckedIn ? 'MASUK' : 'BELUM TERCATAT'}
                      </Badge>
                    </div>
                    <p className="mt-3 font-mono text-base font-bold text-slate-900 tabular-nums">
                      {todayStatus?.masuk ?? 'Belum absen masuk'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Tanggal: {todayStatus?.date ?? '-'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Status Pulang
                      </span>
                      <Badge variant={hasCheckedOut ? 'info' : 'neutral'}>
                        {hasCheckedOut ? 'PULANG' : 'BELUM TERCATAT'}
                      </Badge>
                    </div>
                    <p className="mt-3 font-mono text-base font-bold text-slate-900 tabular-nums">
                      {todayStatus?.pulang ?? 'Belum absen pulang'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Tanggal: {todayStatus?.date ?? '-'}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Log Aktivitas Absensi Hari Ini
                  </h3>
                  {todayStatus && todayStatus.records.length > 0 ? (
                    <div className="mt-2.5 overflow-x-auto rounded-lg border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                        <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-600">
                          <tr>
                            <th scope="col" className="px-4 py-2.5">
                              Tanggal
                            </th>
                            <th scope="col" className="px-4 py-2.5">
                              Waktu (WIB)
                            </th>
                            <th scope="col" className="px-4 py-2.5">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {todayStatus.records.map((rec) => (
                            <tr key={rec.id}>
                              <td className="px-4 py-3 font-mono text-xs font-medium text-slate-800 tabular-nums">
                                {rec.date}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900 tabular-nums">
                                {rec.formattedTime}
                              </td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant={rec.status === 'MASUK' ? 'success' : 'info'}
                                >
                                  {rec.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="mt-2.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                      Belum ada catatan kehadiran untuk hari ini ({todayStatus?.date ?? 'hari ini'}). Silakan lakukan Absen Masuk untuk memulai.
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
