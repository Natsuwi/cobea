import React, { useState } from 'react';
import { Compass } from 'lucide-react';
import { api, setToken } from '../lib/api';
import type { UserProfile } from '../types';

type Mode = 'login' | 'register';

interface AuthScreenProps {
  onAuthenticated: (profile: UserProfile) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
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
      onAuthenticated(result.profile);
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
        style={{ backgroundImage: "url('/fond/FondVeille1.png')" }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-50/90 via-zinc-100/85 to-amber-50/80 dark:from-zinc-950/95 dark:via-zinc-900/90 dark:to-zinc-950/95" />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-rose-400 flex items-center justify-center text-white shadow-sm">
            <Compass className="w-4 h-4" />
          </div>
          <span className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Haven
          </span>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md shadow-xl p-6 space-y-4"
        >
          <div className="text-center space-y-1 mb-2">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {mode === 'login' ? 'Connexion' : 'Créer un compte'}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Un compte = un espace personnel
            </p>
          </div>

          {mode === 'register' && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Prénom</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400/50"
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
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400/50"
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
              className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-400/50"
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
            className="w-full rounded-xl bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 font-medium py-2.5 text-sm hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading ? '…' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
          </button>

          <p className="text-center text-sm text-zinc-500">
            {mode === 'login' ? (
              <>
                Pas encore de compte ?{' '}
                <button
                  type="button"
                  className="text-amber-700 dark:text-amber-400 font-medium"
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
                  className="text-amber-700 dark:text-amber-400 font-medium"
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
