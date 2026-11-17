import { useState } from 'react';

interface AvatarProps {
  src?: string;
  name: string;
  sizeClass?: string;
}

export function Avatar({ src, name, sizeClass = 'w-12 h-12' }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  if (!src || failed) {
    return (
      <div
        aria-label={name}
        className={`${sizeClass} shrink-0 rounded-lg bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center font-display font-semibold text-sm text-slate-700 dark:text-slate-200 select-none`}
      >
        {initials || 'DV'}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} shrink-0 rounded-lg object-cover border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800`}
    />
  );
}
