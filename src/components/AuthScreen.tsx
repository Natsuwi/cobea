import React, { useState } from 'react';
import { api, setToken, type AuthUser } from '../lib/api';
import type { UserProfile } from '../types';
import { CobeaBrand } from './CobeaBrand';
import { ACCOUNT_SWITCHER_BG } from '../data/profiles';

type Mode = 'login' | 'register';

export type AuthSuccess = {
  token: string;
  user: AuthUser;
  profile: UserProfile;
};

interface AuthScreenProps {
  onAuthenticated: (result: AuthSuccess) => void;
  /** When adding another account while already logged in */
  addingAccount?: boolean;
  onCancel?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  addingAccount = false,
  onCancel,
}) => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result =
        mode === 'login'
          ? await api.login(email.trim(), password)
          : await api.register(email.trim(), password, name.trim() || undefined);
      setToken(result.token);
      onAuthenticated({
        token: result.token,
        user: result.user,
        profile: result.profile,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: `url('${ACCOUNT_SWITCHER_BG}')` }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-50/90 via-zinc-100/85 to-accent-soft dark:from-zinc-950/95 dark:via-zinc-900/90 dark:to-zinc-950/95" />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <CobeaBrand
            markClassName="w-9 h-9 text-zinc-900 dark:text-zinc-50"
            textClassName="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md shadow-xl p-6 space-y-4"
        >
          <div className="text-center space-y-1 mb-2">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {addingAccount
                ? mode === 'login'
                  ? 'Ajouter un compte'
                  : 'Créer un autre compte'
                : mode === 'login'
                  ? 'Connexion'
                  : 'Créer un compte'}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {addingAccount
                ? 'Les comptes déjà connectés restent disponibles'
                : 'Un compte = un espace personnel'}
            </p>
          </div>

          {mode === 'register' && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Prénom</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/50"
                placeholder="Aria"
                autoComplete="nickname"
              />
            </label>
          )}

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/50"
              placeholder="toi@example.com"
              autoComplete="email"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Mot de passe
            </span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/50"
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-accent text-accent-fg font-medium py-2.5 text-sm hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading
              ? '…'
              : mode === 'login'
                ? addingAccount
                  ? 'Connecter ce compte'
                  : 'Se connecter'
                : "S'inscrire"}
          </button>

          {addingAccount && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full rounded-xl border border-black/10 dark:border-white/10 py-2.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            >
              Annuler
            </button>
          )}

          <p className="text-center text-sm text-zinc-500">
            {mode === 'login' ? (
              <>
                Pas encore de compte ?{' '}
                <button
                  type="button"
                  className="text-accent-text font-medium"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                >
                  S&apos;inscrire
                </button>
              </>
            ) : (
              <>
                Déjà un compte ?{' '}
                <button
                  type="button"
                  className="text-accent-text font-medium"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                >
                  Se connecter
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
};
