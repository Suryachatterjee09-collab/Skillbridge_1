import React, { useState } from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-24 h-24 text-2xl',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  isOnline,
  className = '',
}) => {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'SB';

  const showImg = Boolean(src && !failed);

  return (
    <div className={`relative inline-flex shrink-0 ${SIZE_MAP[size]} ${className}`}>
      {showImg ? (
        <img
          src={src!}
          alt={`${name} profile portrait`}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full rounded-xl object-cover border border-slate-800 bg-slate-900"
        />
      ) : (
        <div
          aria-label={name}
          className="w-full h-full rounded-xl border border-slate-700/80 bg-gradient-to-br from-slate-800 to-slate-900 text-slate-200 font-display font-semibold flex items-center justify-center select-none"
        >
          {initials}
        </div>
      )}
      {isOnline && (
        <span
          title="Online now"
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-[#070B14]"
        />
      )}
    </div>
  );
};
