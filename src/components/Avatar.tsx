import { avatarUrl } from '../utils/calculations';

interface AvatarProps {
  avatar: string | null | undefined;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

export function Avatar({ avatar, name, size = 'md' }: AvatarProps) {
  const url = avatarUrl(avatar);
  const initials = name.slice(0, 2).toUpperCase();

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`${sizes[size]} rounded-full object-cover flex-shrink-0`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold flex-shrink-0`}
    >
      {initials}
    </div>
  );
}
