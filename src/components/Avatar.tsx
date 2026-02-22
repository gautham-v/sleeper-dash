import { avatarUrl } from '../utils/calculations';

interface AvatarProps {
  avatar: string | null | undefined;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
};

export function Avatar({ avatar, name, size = 'md' }: AvatarProps) {
  const url = avatarUrl(avatar);
  const initials = name.slice(0, 2).toUpperCase();

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`${sizes[size]} rounded-full object-cover flex-shrink-0 border border-white/10 shadow-sm`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} rounded-full bg-brand-cyan/10 flex items-center justify-center text-brand-cyan font-bold flex-shrink-0 border border-brand-cyan/30 shadow-[0_0_10px_rgba(0,229,255,0.2)]`}
    >
      {initials}
    </div>
  );
}
