import React, { useState } from 'react';
import { Alert, Badge, Button, Card, Input, Spinner } from '@dexa-wfh/ui';
import {
  DailyAttendanceSummaryItem,
  getJakartaDateString,
  getJakartaMonthStartString,
} from '../api';

export interface SummaryViewProps {
  items: DailyAttendanceSummaryItem[];
  filterFrom: string;
  filterTo: string;
  loading: boolean;
  error: string | null;
  onSearchFilter: (from: string, to: string) => Promise<void>;
}

export const SummaryView: React.FC<SummaryViewProps> = ({
  items,
  filterFrom,
  filterTo,
  loading,
  error,
  onSearchFilter,
}) => {
  const [fromInput, setFromInput] = useState(filterFrom);
  const [toInput, setToInput] = useState(filterTo);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);

    if (!fromInput || !toInput) {
      setValidationError('Tanggal Dari (From) dan Sampai (To) wajib diisi.');
      return;
    }
    if (fromInput > toInput) {
      setValidationError('Tanggal awal (From) tidak boleh melebihi tanggal akhir (To).');
      return;
    }

    await onSearchFilter(fromInput, toInput);
  };

  const handleResetCurrentMonth = async () => {
    setValidationError(null);
    const defaultFrom = getJakartaMonthStartString();
    const defaultTo = getJakartaDateString();
    setFromInput(defaultFrom);
    setToInput(defaultTo);
    await onSearchFilter(defaultFrom, defaultTo);
  };

  const completeDays = items.filter((item) => item.masuk && item.pulang).length;
  const activeError = validationError || error;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Summary Absen Karyawan
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Rekap riwayat kehadiran mulai dari awal bulan berjalan hingga hari ini, dilengkapi pencarian rentang tanggal.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="neutral">Total Hari: {items.length}</Badge>
          <Badge variant="success">Lengkap Masuk &amp; Pulang: {completeDays}</Badge>
        </div>
      </div>

      {activeError ? (
        <Alert
          variant="error"
          title="Kendala Filter Summary Absen"
          onClose={() => setValidationError(null)}
        >
          {activeError}
        </Alert>
      ) : null}

      <Card
        title="Filter Tanggal (From - To)"
        subtitle="Pilih periode tanggal absensi kemudian tekan tombol Cari"
      >
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="grid gap-4 sm:grid-cols-12 sm:items-end"
          noValidate
        >
          <div className="sm:col-span-4">
            <Input
              id="summary-filter-from"
              name="from"
              type="date"
              label="Dari Tanggal (From)"
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="sm:col-span-4">
            <Input
              id="summary-filter-to"
              name="to"
              type="date"
              label="Sampai Tanggal (To)"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="flex gap-2 sm:col-span-4">
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="flex-1"
            >
              Cari
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => void handleResetCurrentMonth()}
            >
              Bulan Ini
            </Button>
          </div>
        </form>
      </Card>

      <Card
        title="Tabel Rekap Kehadiran (Masuk & Pulang)"
        subtitle={`Menampilkan periode ${filterFrom} sampai dengan ${filterTo} (WIB)`}
        noPadding
      >
        {loading ? (
          <div className="p-10">
            <Spinner label="Memuat data summary absensi..." />
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-base font-semibold text-slate-900">
              Belum Ada Data Absensi pada Periode Ini
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Tidak ditemukan catatan kehadiran antara tanggal {filterFrom} hingga {filterTo}.
            </p>
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleResetCurrentMonth()}
              >
                Tampilkan Periode Bulan Berjalan
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Tanggal
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Masuk
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Pulang
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Status Harian
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {items.map((row) => (
                  <tr
                    key={row.date}
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs font-semibold text-slate-800 tabular-nums">
                      {row.date}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-sm font-medium text-slate-900 tabular-nums">
                      {row.masuk ? (
                        row.masuk
                      ) : (
                        <Badge variant="warning">Belum Masuk</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-sm font-medium text-slate-900 tabular-nums">
                      {row.pulang ? (
                        row.pulang
                      ) : (
                        <Badge variant="warning">Belum Absen Pulang</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      {row.masuk && row.pulang ? (
                        <Badge variant="success">MASUK &amp; PULANG</Badge>
                      ) : row.masuk ? (
                        <Badge variant="info">MASUK (Aktif)</Badge>
                      ) : (
                        <Badge variant="neutral">Tidak Lengkap</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
