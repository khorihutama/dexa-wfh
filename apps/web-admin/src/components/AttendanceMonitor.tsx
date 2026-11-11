import React, { useState } from 'react';
import { Alert, Avatar, Badge, Button, Card, Input, Spinner } from '@dexa-wfh/ui';
import { AdminAttendancePair, resolvePhotoUrl } from '../api';

export interface AttendanceMonitorProps {
  rows: AdminAttendancePair[];
  loading: boolean;
  error: string | null;
  filterFrom: string;
  filterTo: string;
  filterSearch: string;
  onApplyFilter: (filter: { from: string; to: string; search: string }) => void;
}

export const AttendanceMonitor: React.FC<AttendanceMonitorProps> = ({
  rows,
  loading,
  error,
  filterFrom,
  filterTo,
  filterSearch,
  onApplyFilter,
}) => {
  const [from, setFrom] = useState(filterFrom);
  const [to, setTo] = useState(filterTo);
  const [search, setSearch] = useState(filterSearch);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);
    if (!from || !to) {
      setValidationError('Tanggal awal dan tanggal akhir wajib diisi.');
      return;
    }
    if (from > to) {
      setValidationError('Tanggal awal tidak boleh melewati tanggal akhir.');
      return;
    }
    onApplyFilter({ from, to, search });
  };

  const completeCount = rows.filter((row) => row.status === 'COMPLETE').length;
  const workingCount = rows.length - completeCount;

  return (
    <div className="space-y-4">
      <Card
        title="Filter Tanggal (From - To)"
        subtitle="Rekap kehadiran seluruh karyawan, bersifat baca saja"
        badge={<Badge variant="warning">Read-only</Badge>}
      >
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          {validationError ? <Alert variant="warning" title="Filter belum valid">{validationError}</Alert> : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <Input
              id="filter-from"
              type="date"
              label="Dari Tanggal"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <Input
              id="filter-to"
              type="date"
              label="Sampai Tanggal"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <Input
              id="filter-search"
              label="Cari Nama Karyawan"
              placeholder="Nama, email, atau posisi"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex gap-2">
              <Button type="submit" variant="primary" className="flex-1">
                Cari
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onApplyFilter({ from: filterFrom, to: filterTo, search: '' })}
              >
                Reset
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {error ? (
        <Alert variant="error" title="Gagal memuat rekap absensi">
          {error}
        </Alert>
      ) : null}

      <Card
        title="Rekap Absensi Karyawan"
        subtitle={`Periode ${filterFrom} s/d ${filterTo} (WIB)`}
        badge={
          <div className="flex gap-2">
            <Badge variant="success">{completeCount} lengkap</Badge>
            <Badge variant="warning">{workingCount} belum pulang</Badge>
          </div>
        }
      >
        {loading ? (
          <div className="py-10">
            <Spinner label="Memuat rekap absensi..." />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-600">
            Tidak ada catatan absensi pada periode dan filter ini.
          </p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Karyawan
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Tanggal
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Masuk
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Pulang
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={resolvePhotoUrl(row.employee.photoUrl)}
                          name={row.employee.name}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {row.employee.name}
                          </p>
                          <p className="truncate text-xs text-slate-500">{row.employee.position}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-800">{row.date}</td>
                    <td className="px-3 py-3 text-slate-700">{row.masuk ?? '-'}</td>
                    <td className="px-3 py-3 text-slate-700">
                      {row.pulang ?? <span className="text-xs text-amber-700">Belum pulang</span>}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={row.status === 'COMPLETE' ? 'success' : 'warning'}>
                        {row.status === 'COMPLETE' ? 'LENGKAP' : 'BELUM PULANG'}
                      </Badge>
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
