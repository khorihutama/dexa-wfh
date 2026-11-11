import React from 'react';
import { Avatar, Badge, Button } from '@dexa-wfh/ui';
import { EmployeeProfile, resolvePhotoUrl } from '../api';

export type AdminMenuTab = 'employees' | 'monitoring';

export interface AdminLayoutProps {
  admin: EmployeeProfile;
  activeTab: AdminMenuTab;
  socketConnected: boolean;
  onSelectTab: (tab: AdminMenuTab) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

interface MenuDefinition {
  id: AdminMenuTab;
  label: string;
  shortLabel: string;
  hint: string;
}

const MENU_ITEMS: MenuDefinition[] = [
  {
    id: 'employees',
    label: 'Data Karyawan',
    shortLabel: 'Karyawan',
    hint: 'Tambah, ubah, dan hapus data karyawan',
  },
  {
    id: 'monitoring',
    label: 'Monitoring Absensi',
    shortLabel: 'Monitoring',
    hint: 'Rekap kehadiran seluruh karyawan (read-only)',
  },
];

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  admin,
  activeTab,
  socketConnected,
  onSelectTab,
  onLogout,
  children,
}) => {
  const activeMenu = MENU_ITEMS.find((item) => item.id === activeTab) ?? MENU_ITEMS[0];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 pb-20 md:flex-row md:pb-0">
      <aside className="sticky top-0 z-20 hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-700 text-sm font-bold tracking-wider text-white">
            DX
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
              Admin HRD
            </p>
            <p className="text-sm font-bold text-slate-900">Dexa WFH</p>
          </div>
        </div>
        <nav aria-label="Menu Admin HRD" className="flex-1 space-y-1 px-3 py-4">
          {MENU_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 ${
                  isActive
                    ? 'bg-red-700 text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="block">{item.label}</span>
                <span
                  className={`mt-0.5 block text-xs font-normal ${
                    isActive ? 'text-red-100' : 'text-slate-500'
                  }`}
                >
                  {item.hint}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 px-3 py-3">
          <div className="mb-2 flex items-center gap-2 px-1">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                socketConnected ? 'bg-emerald-600' : 'bg-amber-500'
              }`}
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-slate-600">
              Notifikasi real-time {socketConnected ? 'aktif' : 'menghubungkan...'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Avatar src={resolvePhotoUrl(admin.photoUrl)} name={admin.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{admin.name}</p>
              <p className="truncate text-xs text-slate-500">{admin.email}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            onClick={onLogout}
            aria-label="Keluar dari akun admin HRD"
          >
            Keluar
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white md:static">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-700 text-xs font-bold tracking-wider text-white md:hidden">
                DX
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-red-700">
                    Dexa Group WFH
                  </span>
                  <Badge variant="danger">Admin HRD</Badge>
                </div>
                <p className="text-sm font-bold text-slate-900">{activeMenu.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <Avatar src={resolvePhotoUrl(admin.photoUrl)} name={admin.name} size="sm" />
              <Button variant="outline" size="sm" onClick={onLogout}>
                Keluar
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>

        <nav
          aria-label="Navigasi Bawah Mobile"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white md:hidden"
        >
          <div className="grid grid-cols-2 gap-1 px-2 py-1.5">
            {MENU_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-[48px] flex-col items-center justify-center rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 ${
                    isActive
                      ? 'bg-red-50 text-red-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {item.shortLabel}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};
