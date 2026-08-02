import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeftRight, Plus, X } from 'lucide-react';
import { ACCOUNT_SWITCHER_BG } from '../data/profiles';
import { CobeaBrand } from './CobeaBrand';
import type { SavedAccount } from '../lib/accounts';

interface AccountSwitcherProps {
  accounts: SavedAccount[];
  activeUserId: string | null;
  onSelectAccount: (userId: string) => void;
  onAddAccount: () => void;
  onClose: () => void;
}

export const AccountSwitcher: React.FC<AccountSwitcherProps> = ({
  accounts,
  activeUserId,
  onSelectAccount,
  onAddAccount,
  onClose,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="account-switcher fixed inset-0 z-[80] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Changer de compte"
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
        <div className="flex items-center justify-between max-w-3xl w-full mx-auto">
          <CobeaBrand
            markClassName="w-7 h-7 text-zinc-900 dark:text-zinc-50"
            textClassName="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
          />

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
            transition={{ delay: 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-center max-w-md mb-10 space-y-3"
          >
            <p className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-white/70 dark:bg-zinc-800/70 text-zinc-600 dark:text-zinc-300 border border-black/5 dark:border-white/10 shadow-sm">
              <ArrowLeftRight className="w-3 h-3" />
              Comptes
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Qui utilise Cobea&nbsp;?
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Passe d’un compte à l’autre sans te déconnecter — chaque espace garde ses cartes et dossiers.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="glass-panel rounded-[2rem] px-6 py-7 sm:px-8 sm:py-8 shadow-xl shadow-black/5 max-w-2xl w-full"
          >
            <ul className="flex flex-wrap items-start justify-center gap-5 sm:gap-7">
              {accounts.map((account, index) => {
                const isActive = account.userId === activeUserId;
                const { profile } = account;
                return (
                  <motion.li
                    key={account.userId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.16 + index * 0.05, duration: 0.35 }}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectAccount(account.userId)}
                      className="group flex flex-col items-center gap-2.5 focus:outline-none"
                    >
                      <span
                        className={`relative block w-[72px] h-[72px] sm:w-[84px] sm:h-[84px] rounded-full overflow-hidden transition-all duration-300 ${
                          isActive
                            ? 'ring-2 ring-accent ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 scale-105 shadow-md'
                            : 'ring-1 ring-black/10 dark:ring-white/15 group-hover:ring-accent/50 group-hover:scale-105'
                        }`}
                      >
                        {profile.avatarUrl ? (
                          <img
                            src={profile.avatarUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            draggable={false}
                          />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center avatar-accent-gradient text-white text-xl font-semibold">
                            {profile.name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </span>
                      <span
                        className={`text-sm transition-colors max-w-[6.5rem] truncate ${
                          isActive
                            ? 'text-zinc-900 dark:text-zinc-100 font-medium'
                            : 'text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200'
                        }`}
                      >
                        {profile.name}
                      </span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 max-w-[7rem] truncate -mt-1">
                        {account.email}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-medium text-accent-text -mt-0.5">
                          Actuel
                        </span>
                      )}
                    </button>
                  </motion.li>
                );
              })}

              <motion.li
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 + accounts.length * 0.05, duration: 0.35 }}
              >
                <button
                  type="button"
                  onClick={onAddAccount}
                  className="group flex flex-col items-center gap-2.5 focus:outline-none"
                  title="Ajouter un compte"
                >
                  <span className="flex w-[72px] h-[72px] sm:w-[84px] sm:h-[84px] items-center justify-center rounded-full border border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-400 dark:text-zinc-500 bg-white/40 dark:bg-zinc-900/40 transition-colors group-hover:border-accent/60 group-hover:text-accent-text">
                    <Plus className="w-6 h-6" strokeWidth={1.75} />
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200">
                    Nouveau
                  </span>
                </button>
              </motion.li>
            </ul>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};
