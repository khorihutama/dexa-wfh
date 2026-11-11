import React from 'react';

export interface CardProps {
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
  noPadding?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  badge,
  footer,
  noPadding = false,
  children,
  className = '',
}) => {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white shadow-xs ${className}`.trim()}
    >
      {title || subtitle || badge ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title ? <h2 className="text-base font-semibold text-slate-900">{title}</h2> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-slate-600">{subtitle}</p> : null}
          </div>
          {badge ? <div>{badge}</div> : null}
        </div>
      ) : null}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
      {footer ? (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3">{footer}</div>
      ) : null}
    </section>
  );
};
