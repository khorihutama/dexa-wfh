import React from 'react';
import { AdminNotification } from '../api';

export interface NotificationToastsProps {
  notifications: AdminNotification[];
  onDismiss: (id: string) => void;
}

function formatClock(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  })
    .format(date)
    .replace(/\./g, ':');
}

export const NotificationToasts: React.FC<NotificationToastsProps> = ({
  notifications,
  onDismiss,
}) => {
  if (notifications.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifikasi absensi real-time"
      className="pointer-events-none fixed inset-x-3 bottom-24 z-40 flex flex-col gap-2 md:inset-x-auto md:right-4 md:bottom-4 md:w-96"
    >
      {notifications.map((notification) => {
        const isAttendance = notification.event === 'attendance.recorded';
        return (
          <div
            key={notification.id}
            role="status"
            data-testid="admin-notification"
            className={`pointer-events-auto rounded-xl border p-3 shadow-lg ${
              isAttendance
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                : 'border-slate-300 bg-white text-slate-900'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider">
                  {notification.title}
                </p>
                <p className="mt-1 text-sm leading-snug">{notification.message}</p>
                <p className="mt-1 text-xs opacity-70">{formatClock(notification.timestamp)} WIB</p>
              </div>
              <button
                type="button"
                onClick={() => onDismiss(notification.id)}
                aria-label="Tutup notifikasi"
                className="min-h-[28px] min-w-[28px] shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
