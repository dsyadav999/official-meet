import React from 'react';

interface AvatarProps {
  name: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  online?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  color,
  size = 'md',
  online,
}) => {
  const initials =
    name
      .trim()
      .split(/[\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?';

  const dimensions =
    size === 'sm'
      ? 'w-7 h-7 text-[11px] rounded-lg'
      : size === 'lg'
      ? 'w-10 h-10 text-sm rounded-xl'
      : 'w-9 h-9 text-xs rounded-xl';

  return (
    <div className="relative shrink-0 select-none">
      <div
        className={`${dimensions} flex items-center justify-center font-semibold text-white shadow-2xs`}
        style={{ backgroundColor: color }}
        aria-hidden="true"
      >
        {initials}
      </div>
      {online && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
          aria-hidden="true"
        />
      )}
    </div>
  );
};
