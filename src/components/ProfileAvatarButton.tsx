import React from 'react';
import { UserProfile } from '../types';

interface ProfileAvatarButtonProps {
  profile: UserProfile;
  onClick: () => void;
  className?: string;
}

export const ProfileAvatarButton: React.FC<ProfileAvatarButtonProps> = ({
  profile,
  onClick,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${profile.name} — compte`}
      className={`fixed top-4 right-4 md:top-6 md:right-8 z-[45] group focus:outline-none ${className}`}
    >
      <span className="block w-10 h-10 md:w-11 md:h-11 rounded-full overflow-hidden ring-2 ring-white/90 dark:ring-zinc-800 shadow-lg shadow-black/10 border border-black/5 dark:border-white/10 transition-transform duration-300 group-hover:scale-105 group-active:scale-95">
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={profile.name}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-400 to-rose-400 text-white text-sm font-semibold">
            {profile.name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </span>
    </button>
  );
};
