import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  FolderOpen,
  HardDrive,
  Link2,
  LogOut,
  RefreshCw,
  Unlink,
  Upload,
  X,
} from 'lucide-react';
import { UserProfile } from '../types';
import { ACCOUNT_SWITCHER_BG } from '../data/profiles';
import { api, type DriveFolderRef, type StorageState } from '../lib/api';
import { CobeaBrand } from './CobeaBrand';
import { DriveFolderPicker } from './DriveFolderPicker';
import { GoogleOAuthGuide } from './GoogleOAuthGuide';

interface AccountPanelProps {
  profile: UserProfile;
  googleConnected: boolean;
  storageMode: 'standard' | 'google';
  googleConfigured: boolean;
  googleUploadFolderId: string | null;
  googleUploadFolderName: string | null;
  googleSyncFolders: DriveFolderRef[];
  googleLastSyncAt: string | null;
  onClose: () => void;
  onLogout: () => void;
  onGoogleChange: (connected: boolean) => void;
  onStorageChange: (state: Partial<StorageState>) => void;
  onSynced?: () => void;
}

export const AccountPanel: React.FC<AccountPanelProps> = ({
  profile,
  googleConnected,
  storageMode,
  googleConfigured,
  googleUploadFolderId,
  googleUploadFolderName,
  googleSyncFolders,
  googleLastSyncAt,
  onClose,
  onLogout,
  onGoogleChange,
  onStorageChange,
  onSynced,
}) => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [setupOpen, setSetupOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'upload' | 'sync' | null>(null);
  const [redirectUri, setRedirectUri] = useState(
    `${window.location.origin}/api/auth/google/callback`
  );
  const googleOn = storageMode === 'google' || setupOpen;

  useEffect(() => {
    if (storageMode === 'google') setSetupOpen(false);
  }, [storageMode]);

  useEffect(() => {
    void api
      .config()
      .then((c) => {
        if (c.googleRedirectUri) setRedirectUri(c.googleRedirectUri);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pickerMode) setPickerMode(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pickerMode]);

  const applyStorage = (result: StorageState) => {
    onStorageChange(result);
    onGoogleChange(result.googleConnected);
  };

  const persistMode = async (mode: 'standard' | 'google') => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await api.updateStorage({ storageMode: mode });
      applyStorage(result);
      setSetupOpen(false);
      setMessage(
        mode === 'google'
          ? 'Mode Google activé — connecte ton compte Drive (scope élargi : reconnecte si besoin).'
          : 'Stockage local (Postgres) activé.'
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const toggleGoogle = () => {
    if (googleOn) {
      setSetupOpen(false);
      if (storageMode === 'google') void persistMode('standard');
      return;
    }
    if (googleConfigured) {
      void persistMode('google');
    } else {
      setSetupOpen(true);
      setMessage(null);
    }
  };

  const saveCredentials = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setMessage('Client ID et Client Secret requis.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await api.updateStorage({
        storageMode: 'google',
        googleClientId: clientId.trim(),
        googleClientSecret: clientSecret.trim(),
      });
      applyStorage(result);
      setClientSecret('');
      setSetupOpen(false);
      setMessage('Identifiants enregistrés — tu peux connecter Google Drive.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

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
      const result = await api.disconnectGoogle();
      applyStorage(result);
      setMessage('Google Drive déconnecté');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const saveUploadFolder = async (folders: DriveFolderRef[]) => {
    const folder = folders[0];
    if (!folder) return;
    setBusy(true);
    setMessage(null);
    setPickerMode(null);
    try {
      const result = await api.updateStorage({
        googleUploadFolderId: folder.id,
        googleUploadFolderName: folder.name,
      });
      applyStorage(result);
      setMessage(`Dossier d’upload : ${folder.name}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const saveSyncFolders = async (folders: DriveFolderRef[]) => {
    setBusy(true);
    setMessage(null);
    setPickerMode(null);
    try {
      const result = await api.updateStorage({ googleSyncFolders: folders });
      applyStorage(result);
      setMessage(
        folders.length
          ? `${folders.length} dossier${folders.length > 1 ? 's' : ''} à synchroniser`
          : 'Aucun dossier synchronisé'
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  const runSync = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await api.syncGoogleDrive();
      onStorageChange({ googleLastSyncAt: result.googleLastSyncAt });
      onSynced?.();
      setMessage(
        result.imported > 0
          ? `Sync : ${result.imported} importée${result.imported > 1 ? 's' : ''} (${result.scanned} scannées)`
          : `Sync terminée — rien de nouveau (${result.scanned} scannées)`
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Erreur de sync');
    } finally {
      setBusy(false);
    }
  };

  const lastSyncLabel = googleLastSyncAt
    ? new Date(googleLastSyncAt).toLocaleString(undefined, {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="account-switcher fixed inset-0 z-[80] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Paramètres du compte"
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

        <div className="relative z-10 flex flex-1 flex-col min-h-0 px-5 sm:px-8 pt-6 pb-28">
          <div className="flex items-center justify-between max-w-lg w-full mx-auto shrink-0">
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

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-8">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-sm mx-auto space-y-5 pb-6"
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
                  <p className="text-sm text-zinc-500 mt-1">Paramètres du compte</p>
                </div>
              </div>

              <section
                aria-label="Stockage"
                className="rounded-2xl border border-zinc-200 dark:border-white/15 bg-white dark:bg-zinc-900 shadow-sm p-4 space-y-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      Stockage
                    </p>
                    <div className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      <HardDrive className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      Google Drive
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      {googleOn
                        ? 'Fichiers sur Drive, aperçus en local.'
                        : 'Par défaut : fichiers stockés sur le NAS (Postgres).'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={googleOn}
                    aria-label="Activer Google Drive"
                    disabled={busy}
                    onClick={toggleGoogle}
                    className={`relative shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
                      googleOn ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                        googleOn ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {googleOn && (
                  <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-white/10">
                    {!googleConfigured && (
                      <div className="space-y-3">
                        <GoogleOAuthGuide redirectUri={redirectUri} />
                        <p className="text-xs text-zinc-500">
                          Colle ensuite tes identifiants ci-dessous :
                        </p>
                        <input
                          type="text"
                          value={clientId}
                          onChange={(e) => setClientId(e.target.value)}
                          placeholder="Client ID"
                          autoComplete="off"
                          className="w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-950/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400/40"
                        />
                        <input
                          type="password"
                          value={clientSecret}
                          onChange={(e) => setClientSecret(e.target.value)}
                          placeholder="Client Secret"
                          autoComplete="off"
                          className="w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-950/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400/40"
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={saveCredentials}
                          className="w-full rounded-xl border border-zinc-200 dark:border-white/10 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-white/5 disabled:opacity-50"
                        >
                          Enregistrer les identifiants
                        </button>
                      </div>
                    )}

                    {googleConfigured && !googleConnected && (
                      <>
                        <p className="text-sm text-zinc-600 dark:text-zinc-300">
                          Connecte ton compte Google (accès Drive complet pour lister tes
                          dossiers). Si tu étais déjà connecté avant, déconnecte puis
                          reconnecte.
                        </p>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={connectGoogle}
                          className="flex items-center justify-center gap-2 w-full rounded-xl bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 py-2.5 text-sm font-medium disabled:opacity-50"
                        >
                          <Link2 className="w-4 h-4" />
                          Connecter Google Drive
                        </button>
                      </>
                    )}

                    {googleConfigured && googleConnected && (
                      <div className="space-y-3">
                        <p className="text-xs text-amber-700 dark:text-amber-300/90 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2">
                          Nouveau scope Drive : si la liste des dossiers échoue,
                          déconnecte puis reconnecte Google.
                        </p>

                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                            Upload (nouvelles cards)
                          </p>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setPickerMode('upload')}
                            className="flex items-center gap-2 w-full rounded-xl border border-zinc-200 dark:border-white/10 px-3 py-2.5 text-sm text-left hover:bg-zinc-50 dark:hover:bg-white/5 disabled:opacity-50"
                          >
                            <Upload className="w-4 h-4 text-zinc-500 shrink-0" />
                            <span className="flex-1 truncate text-zinc-800 dark:text-zinc-100">
                              {googleUploadFolderName || 'Choisir un dossier…'}
                            </span>
                          </button>
                          {!googleUploadFolderId && (
                            <p className="text-xs text-zinc-500">
                              Sans dossier, les uploads vont à la racine de ton Drive.
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                            Synchroniser
                          </p>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setPickerMode('sync')}
                            className="flex items-center gap-2 w-full rounded-xl border border-zinc-200 dark:border-white/10 px-3 py-2.5 text-sm text-left hover:bg-zinc-50 dark:hover:bg-white/5 disabled:opacity-50"
                          >
                            <FolderOpen className="w-4 h-4 text-zinc-500 shrink-0" />
                            <span className="flex-1 truncate text-zinc-800 dark:text-zinc-100">
                              {googleSyncFolders.length
                                ? `${googleSyncFolders.length} dossier${
                                    googleSyncFolders.length > 1 ? 's' : ''
                                  } — ${googleSyncFolders.map((f) => f.name).join(', ')}`
                                : 'Choisir les dossiers…'}
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={busy || googleSyncFolders.length === 0}
                            onClick={() => void runSync()}
                            className="flex items-center justify-center gap-2 w-full rounded-xl bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-950 py-2.5 text-sm font-medium disabled:opacity-40"
                          >
                            <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
                            Synchroniser maintenant
                          </button>
                          {lastSyncLabel && (
                            <p className="text-xs text-zinc-500 text-center">
                              Dernière sync : {lastSyncLabel}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={disconnectGoogle}
                          className="flex items-center justify-center gap-2 w-full rounded-xl border border-zinc-200 dark:border-white/10 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-white/5 disabled:opacity-50"
                        >
                          <Unlink className="w-4 h-4" />
                          Déconnecter Google
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>

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

      {pickerMode && (
        <DriveFolderPicker
          mode={pickerMode}
          selected={
            pickerMode === 'upload'
              ? googleUploadFolderId && googleUploadFolderName
                ? [{ id: googleUploadFolderId, name: googleUploadFolderName }]
                : []
              : googleSyncFolders
          }
          onClose={() => setPickerMode(null)}
          onConfirm={(folders) => {
            if (pickerMode === 'upload') void saveUploadFolder(folders);
            else void saveSyncFolders(folders);
          }}
        />
      )}
    </>
  );
};
