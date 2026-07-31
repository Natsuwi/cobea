import { UserProfile } from '../types';

export const PROFILES: UserProfile[] = [
  {
    id: 'profile-aria',
    name: 'Aria',
    avatarUrl:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&h=256&fit=crop&crop=face',
  },
  {
    id: 'profile-noah',
    name: 'Noah',
    avatarUrl:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=256&h=256&fit=crop&crop=face',
  },
  {
    id: 'profile-mila',
    name: 'Mila',
    avatarUrl:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=256&h=256&fit=crop&crop=face',
  },
  {
    id: 'profile-leo',
    name: 'Léo',
    avatarUrl:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=256&h=256&fit=crop&crop=face',
  },
];

export const PROFILE_STORAGE_KEY = 'haven_active_profile_v1';
export const ACCOUNT_SWITCHER_BG = '/fond/FondVeille1.png';

export function getStoredProfileId(): string {
  try {
    const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (saved && PROFILES.some((p) => p.id === saved)) return saved;
  } catch {
    /* ignore */
  }
  return PROFILES[0].id;
}
