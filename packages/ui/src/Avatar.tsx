import React, { useEffect, useState } from 'react';

export interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'DX';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [src]);

  const dimensions: Record<
    NonNullable<AvatarProps['size']>,
    { px: number; boxClass: string; textClass: string }
  > = {
    sm: { px: 36, boxClass: 'h-9 w-9', textClass: 'text-xs' },
    md: { px: 48, boxClass: 'h-12 w-12', textClass: 'text-sm' },
    lg: { px: 72, boxClass: 'h-18 w-18', textClass: 'text-lg' },
    xl: { px: 96, boxClass: 'h-24 w-24', textClass: 'text-2xl' },
  };

  const { px, boxClass, textClass } = dimensions[size];
  const showImage = Boolean(src && src.trim() && !imgFailed);

  if (showImage && src) {
    return (
      <img
        src={src}
        alt={`Foto profil ${name}`}
        width={px}
        height={px}
        onError={() => setImgFailed(true)}
        className={`${boxClass} shrink-0 rounded-full border border-slate-200 object-cover bg-slate-100 ${className}`.trim()}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`Inisial profil ${name}`}
      className={`${boxClass} ${textClass} shrink-0 inline-flex items-center justify-center rounded-full border border-red-200 bg-red-50 font-semibold text-red-900 select-none ${className}`.trim()}
    >
      {getInitials(name)}
    </div>
  );
};
