import type { UserProfile } from '../types';
import { getToken, setToken } from './api';

const ACCOUNTS_KEY = 'cobea_accounts_v1';

export type SavedAccount = {
  userId: string;
  email: string;
  token: string;
  profile: UserProfile;
};

export function listSavedAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedAccount[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a) =>
        a &&
        typeof a.userId === 'string' &&
        typeof a.token === 'string' &&
        a.profile &&
        typeof a.profile.id === 'string'
    );
  } catch {
    return [];
  }
}

function writeAccounts(accounts: SavedAccount[]) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    /* ignore */
  }
}

/** Add or update a logged-in account and make it the active session. */
export function upsertSavedAccount(account: SavedAccount): SavedAccount[] {
  const prev = listSavedAccounts().filter((a) => a.userId !== account.userId);
  const next = [...prev, account];
  writeAccounts(next);
  setToken(account.token);
  return next;
}

/** Refresh profile/email for an existing saved account (keep token). */
export function updateSavedAccountMeta(
  userId: string,
  patch: { email?: string; profile?: UserProfile; token?: string }
): SavedAccount[] {
  const next = listSavedAccounts().map((a) =>
    a.userId === userId
      ? {
          ...a,
          email: patch.email ?? a.email,
          profile: patch.profile ?? a.profile,
          token: patch.token ?? a.token,
        }
      : a
  );
  writeAccounts(next);
  return next;
}

export function removeSavedAccount(userId: string): SavedAccount[] {
  const next = listSavedAccounts().filter((a) => a.userId !== userId);
  writeAccounts(next);
  return next;
}

export function getSavedAccount(userId: string): SavedAccount | undefined {
  return listSavedAccounts().find((a) => a.userId === userId);
}

export function getActiveSavedAccount(): SavedAccount | undefined {
  const token = getToken();
  if (!token) return undefined;
  return listSavedAccounts().find((a) => a.token === token);
}

/** Switch active JWT to another saved account. */
export function switchToSavedAccount(userId: string): SavedAccount | null {
  const account = getSavedAccount(userId);
  if (!account) return null;
  setToken(account.token);
  return account;
}

export { ACCOUNTS_KEY };
