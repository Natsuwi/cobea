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
      title={`${profile.name} — changer d'espace`}
      className={`fixed top-4 right-4 md:top-6 md:right-8 z-[45] group focus:outline-none ${className}`}
    >
      <span className="block w-10 h-10 md:w-11 md:h-11 rounded-full overflow-hidden ring-2 ring-white/90 dark:ring-zinc-800 shadow-lg shadow-black/10 border border-black/5 dark:border-white/10 transition-transform duration-300 group-hover:scale-105 group-active:scale-95">
        <img
          src={profile.avatarUrl}
          alt={profile.name}
          className="w-full h-full object-cover"
          draggable={false}
        />
      </span>
    </button>
  );
};
