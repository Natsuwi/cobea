import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { UserProfile } from '../types';

interface ProfileAvatarButtonProps {
  profile: UserProfile;
  onClick: () => void;
  onSwitchAccounts?: () => void;
  className?: string;
}

export const ProfileAvatarButton: React.FC<ProfileAvatarButtonProps> = ({
  profile,
  onClick,
  onSwitchAccounts,
  className = '',
}) => {
  return (
    <div
      className={`fixed top-4 right-4 md:top-6 md:right-8 z-[45] flex flex-col items-center gap-2 ${className}`}
    >
      <button
        type="button"
        onClick={onClick}
        title={`${profile.name} — paramètres`}
        className="group focus:outline-none"
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
            <span className="w-full h-full flex items-center justify-center avatar-accent-gradient text-white text-sm font-semibold">
              {profile.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
      </button>

      {onSwitchAccounts && (
        <button
          type="button"
          onClick={onSwitchAccounts}
          title="Changer de compte"
          className="flex items-center justify-center p-1.5 text-zinc-400/70 dark:text-zinc-500/70 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors focus:outline-none"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 stroke-[1.5]" />
        </button>
      )}
    </div>
  );
};
