import React from 'react';
import { Avatar, Badge, Button } from '@dexa-wfh/ui';
import { EmployeeProfile, resolvePhotoUrl } from '../api';

export type EmployeeMenuTab = 'profile' | 'attendance' | 'summary';

export interface PortalLayoutProps {
  employee: EmployeeProfile;
  activeTab: EmployeeMenuTab;
  onSelectTab: (tab: EmployeeMenuTab) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

interface MenuDefinition {
  id: EmployeeMenuTab;
  label: string;
  shortLabel: string;
  description: string;
}

const MENU_ITEMS: MenuDefinition[] = [
  {
    id: 'profile',
    label: 'Profil Karyawan',
    shortLabel: 'Profil',
    description: 'Data diri, foto, nomor handphone & kata sandi',
  },
  {
    id: 'attendance',
    label: 'Absen Masuk & Pulang',
    shortLabel: 'Absen',
    description: 'Catat kehadiran WFH harian zona waktu WIB',
  },
  {
    id: 'summary',
    label: 'Summary Absen',
    shortLabel: 'Summary',
    description: 'Rekap riwayat kehadiran & filter tanggal',
  },
];

export const PortalLayout: React.FC<PortalLayoutProps> = ({
  employee,
  activeTab,
  onSelectTab,
  onLogout,
  children,
}) => {
  const resolvedAvatar = resolvePhotoUrl(employee.photoUrl);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 pb-20 text-slate-900 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-700 text-sm font-bold tracking-wider text-white">
              DX
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-red-700">
                  Dexa Group WFH
                </span>
                <Badge variant="neutral">Karyawan</Badge>
              </div>
              <p className="text-sm font-bold text-slate-900">
                Portal Absensi &amp; Profil Karyawan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 border-r border-slate-200 pr-3 sm:flex">
              <Avatar
                src={resolvedAvatar}
                name={employee.name}
                size="sm"
              />
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">{employee.name}</p>
                <p className="text-xs text-slate-500">{employee.position}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={onLogout}
              aria-label="Keluar dari akun karyawan"
            >
              Keluar
            </Button>
          </div>
        </div>

        <nav
          aria-label="Menu Utama Karyawan"
          className="hidden border-t border-slate-100 bg-slate-50/70 md:block"
        >
          <div className="mx-auto flex max-w-6xl gap-2 px-4 py-2 sm:px-6">
            {MENU_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-[44px] items-center gap-2.5 rounded-lg px-4 py-2 text-left text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-red-600 ${
                    isActive
                      ? 'bg-red-700 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-200/70 hover:text-slate-900'
                  }`}
                >
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <nav
        aria-label="Navigasi Bawah Mobile"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white md:hidden"
      >
        <div className="grid grid-cols-3 gap-1 px-2 py-1.5">
          {MENU_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-[48px] flex-col items-center justify-center rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-red-600 ${
                  isActive
                    ? 'bg-red-50 text-red-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{item.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <footer className="hidden border-t border-slate-200 bg-white md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 text-xs text-slate-500 sm:px-6">
          <span>Dexa Group WFH Attendance System</span>
          <span>Akun aktif: {employee.email}</span>
        </div>
      </footer>
    </div>
  );
};
