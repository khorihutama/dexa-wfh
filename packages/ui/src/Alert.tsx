import React from 'react';

export interface AlertProps {
  variant?: 'success' | 'warning' | 'error' | 'info';
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onClose,
  action,
  className = '',
}) => {
  const styles: Record<NonNullable<AlertProps['variant']>, string> = {
    success: 'border-emerald-300 bg-emerald-50 text-emerald-950',
    warning: 'border-amber-300 bg-amber-50 text-amber-950',
    error: 'border-red-300 bg-red-50 text-red-950',
    info: 'border-slate-300 bg-slate-50 text-slate-900',
  };

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border p-4 text-sm ${styles[variant]} ${className}`.trim()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          {title ? <p className="font-semibold">{title}</p> : null}
          <div className="text-xs leading-relaxed opacity-95">{children}</div>
          {action ? <div className="pt-2">{action}</div> : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pesan"
            className="min-h-[32px] min-w-[32px] rounded-md px-2 py-1 text-xs font-semibold hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 cursor-pointer"
          >
            Tutup
          </button>
        ) : null}
      </div>
    </div>
  );
};
