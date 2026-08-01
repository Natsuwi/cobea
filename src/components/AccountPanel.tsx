import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Compass, Link2, LogOut, Unlink, X } from 'lucide-react';
import { UserProfile } from '../types';
import { ACCOUNT_SWITCHER_BG } from '../data/profiles';
import { api } from '../lib/api';

interface AccountPanelProps {
  profile: UserProfile;
  googleConnected: boolean;
  storageMode: 'standard' | 'google';
  googleConfigured: boolean;
  onClose: () => void;
  onLogout: () => void;
  onGoogleChange: (connected: boolean) => void;
}

export const AccountPanel: React.FC<AccountPanelProps> = ({
  profile,
  googleConnected,
  storageMode,
  googleConfigured,
  onClose,
  onLogout,
  onGoogleChange,
}) => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const connectGoogle = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { url } = await api.googleAuthUrl();
      window.location.href = url;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erreur Google');
      setBusy(false);
    }
  };

  const disconnectGoogle = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await api.disconnectGoogle();
      onGoogleChange(false);
      setMessage('Google Drive déconnecté');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="account-switcher fixed inset-0 z-[80] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Compte"
    >
      <div className="account-switcher-base absolute inset-0" aria-hidden />

      <div className="account-switcher-bg-strip" aria-hidden>
        <img
          src={ACCOUNT_SWITCHER_BG}
          alt=""
          className="account-switcher-bg-image"
          draggable={false}
        />
        <div className="account-switcher-bg-fade" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col px-5 sm:px-8 pt-6 pb-[20vh]">
        <div className="flex items-center justify-between max-w-lg w-full mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-rose-400 flex items-center justify-center text-white shadow-sm">
              <Compass className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Haven
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm space-y-6"
          >
            <div className="text-center space-y-3">
              <div className="mx-auto w-20 h-20 rounded-full overflow-hidden ring-2 ring-white/80 dark:ring-zinc-700 shadow-lg">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center text-2xl font-semibold text-white">
                    {profile.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {profile.name}
                </h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Stockage : {storageMode === 'google' ? 'Google Drive + NAS' : 'NAS Postgres'}
                </p>
              </div>
            </div>

            {storageMode === 'google' && googleConfigured && (
              <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 p-4 space-y-3">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Google Drive
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  {googleConnected
                    ? 'Compte lié — les fichiers restent sur Drive, les aperçus en local.'
                    : 'Connecte Drive pour uploader des fichiers.'}
                </p>
                {googleConnected ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={disconnectGoogle}
                    className="flex items-center justify-center gap-2 w-full rounded-xl border border-black/10 dark:border-white/10 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
                  >
                    <Unlink className="w-4 h-4" />
                    Déconnecter
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={connectGoogle}
                    className="flex items-center justify-center gap-2 w-full rounded-xl bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 py-2.5 text-sm font-medium disabled:opacity-50"
                  >
                    <Link2 className="w-4 h-4" />
                    Connecter Google Drive
                  </button>
                )}
              </div>
            )}

            {message && (
              <p className="text-sm text-center text-zinc-600 dark:text-zinc-300">{message}</p>
            )}

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300 py-2.5 text-sm font-medium hover:bg-rose-500/15"
            >
              <LogOut className="w-4 h-4" />
              Se déconnecter
            </button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};
