import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  Columns3,
  FolderOpen,
  HardDrive,
  Link2,
  LogOut,
  Moon,
  RefreshCw,
  Square,
  Sun,
  Unlink,
  Upload,
  X,
} from 'lucide-react';
import { ThemeMode, UserProfile } from '../types';
import { ACCOUNT_SWITCHER_BG } from '../data/profiles';
import { api, type DriveFolderRef, type StorageState } from '../lib/api';
import { ACCENT_OPTIONS, type AccentId } from '../lib/accent';
import { COLUMN_OPTIONS } from '../lib/columnsPref';
import { CobeaBrand } from './CobeaBrand';
import { DriveFolderPicker } from './DriveFolderPicker';
import { GoogleOAuthGuide } from './GoogleOAuthGuide';

type DriveUsage = {
  day: string;
  requests: number;
  units: number;
  dailyLimitUnits: number;
  percentUsed: number;
};

function formatUnits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

interface AccountPanelProps {
  profile: UserProfile;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  accent: AccentId;
  onAccentChange: (accent: AccentId) => void;
  columnCount: number;
  columnPrefMode: 'mobile' | 'desktop';
  onColumnCountChange: (count: number) => void;
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
  theme,
  onThemeChange,
  accent,
  onAccentChange,
  columnCount,
  columnPrefMode,
  onColumnCountChange,
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
  /** Drive options (folders / sync / disconnect) — collapsed by default */
  const [driveDetailsOpen, setDriveDetailsOpen] = useState(false);
  const [driveUsage, setDriveUsage] = useState<DriveUsage | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    percent: number;
    message: string;
    current?: number;
    total?: number;
  } | null>(null);
  const syncAbortRef = useRef<AbortController | null>(null);
  const [redirectUri, setRedirectUri] = useState(
    `${window.location.origin}/api/auth/google/callback`
  );
  const googleOn = storageMode === 'google' || setupOpen;

  const refreshDriveUsage = useCallback(async () => {
    if (!googleConnected) {
      setDriveUsage(null);
      return;
    }
    try {
      const { usage } = await api.getDriveUsage();
      setDriveUsage(usage);
    } catch {
      /* ignore */
    }
  }, [googleConnected]);

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
    void refreshDriveUsage();
  }, [refreshDriveUsage]);

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
    setSyncProgress({ percent: 0, message: 'Démarrage…' });
    const ac = new AbortController();
    syncAbortRef.current = ac;
    try {
      const result = await api.syncGoogleDriveWithProgress((p) => {
        setSyncProgress({
          percent: p.percent,
          message: p.message,
          current: p.current,
          total: p.total,
        });
      }, ac.signal);
      onStorageChange({ googleLastSyncAt: result.googleLastSyncAt });
      onSynced?.();
      await refreshDriveUsage();
      if (result.cancelled) {
        setMessage(
          result.imported > 0
            ? `Sync interrompue — ${result.imported} importé${result.imported > 1 ? 's' : ''} conservé${result.imported > 1 ? 's' : ''}`
            : 'Sync interrompue'
        );
      } else {
        setMessage(
          result.imported > 0
            ? `Sync : ${result.imported} importé${result.imported > 1 ? 's' : ''} (${result.scanned} scannés)`
            : result.folderCount === 0
              ? 'Aucun dossier à synchroniser — choisis-en un d’abord'
              : result.scanned === 0
                ? 'Dossier vide sur Drive (0 fichier). Si tu as récemment supprimé des cards, restaure les fichiers depuis la corbeille Google Drive.'
                : `Sync terminée — rien de nouveau (${result.scanned} scannés)`
        );
      }
    } catch (err) {
      if (ac.signal.aborted) {
        setMessage('Sync interrompue');
        onSynced?.();
      } else {
        setMessage(err instanceof Error ? err.message : 'Erreur de sync');
      }
    } finally {
      syncAbortRef.current = null;
      setSyncProgress(null);
      setBusy(false);
    }
  };

  const cancelSync = () => {
    void api.cancelGoogleDriveSync().catch(() => undefined);
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
                    <div className="w-full h-full avatar-accent-gradient flex items-center justify-center text-2xl font-semibold text-white">
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
                aria-label="Apparence"
                className="rounded-2xl border border-zinc-200 dark:border-white/15 bg-white dark:bg-zinc-900 shadow-sm p-4 space-y-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Apparence
                </p>

                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Thème</p>
                    <p className="text-xs text-zinc-500">Clair ou sombre</p>
                  </div>
                  <div className="flex shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 p-0.5">
                    <button
                      type="button"
                      onClick={() => onThemeChange('light')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        theme === 'light'
                          ? 'bg-white text-zinc-900 shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                      }`}
                      title="Mode clair"
                    >
                      <Sun className="w-3.5 h-3.5" />
                      Clair
                    </button>
                    <button
                      type="button"
                      onClick={() => onThemeChange('dark')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        theme === 'dark'
                          ? 'bg-zinc-700 text-zinc-50 shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                      }`}
                      title="Mode sombre"
                    >
                      <Moon className="w-3.5 h-3.5" />
                      Sombre
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      Couleur d’accent
                    </p>
                    <p className="text-xs text-zinc-500">Boutons, focus et highlights</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {ACCENT_OPTIONS.map((opt) => {
                      const selected = accent === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onAccentChange(opt.id)}
                          title={opt.label}
                          aria-label={opt.label}
                          aria-pressed={selected}
                          className={`relative w-8 h-8 rounded-full transition-transform ${
                            selected
                              ? 'scale-110 ring-2 ring-offset-2 ring-zinc-900 dark:ring-zinc-100 ring-offset-white dark:ring-offset-zinc-900'
                              : 'hover:scale-105 opacity-90'
                          }`}
                          style={{ backgroundColor: `#${opt.hex}` }}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <Columns3 className="w-3.5 h-3.5 text-zinc-400" />
                        Colonnes · {columnPrefMode === 'mobile' ? 'Mobile' : 'Ordinateur'}
                      </p>
                      <p className="text-xs text-zinc-500">Cartes affichées par ligne</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {columnCount}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {COLUMN_OPTIONS[columnPrefMode].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => onColumnCountChange(n)}
                        className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                          columnCount === n
                            ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

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
                      <HardDrive className="w-4 h-4 shrink-0 text-accent-text" />
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
                    className={`relative shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                      googleOn ? 'bg-accent' : 'bg-zinc-300 dark:bg-zinc-600'
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
                          className="w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-950/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                        />
                        <input
                          type="password"
                          value={clientSecret}
                          onChange={(e) => setClientSecret(e.target.value)}
                          placeholder="Client Secret"
                          autoComplete="off"
                          className="w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-950/50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
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
                          className="flex items-center justify-center gap-2 w-full rounded-xl bg-accent text-accent-fg py-2.5 text-sm font-medium disabled:opacity-50"
                        >
                          <Link2 className="w-4 h-4" />
                          Connecter Google Drive
                        </button>
                      </>
                    )}

                    {googleConfigured && googleConnected && (
                      <div className="space-y-3">
                        {driveUsage && (
                          <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-950/40 px-3 py-2.5 space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-medium text-zinc-700 dark:text-zinc-200">
                                API Drive aujourd’hui
                              </span>
                              <span className="tabular-nums text-zinc-500">
                                {driveUsage.requests.toLocaleString('fr-FR')} appel
                                {driveUsage.requests !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  driveUsage.percentUsed >= 80
                                    ? 'bg-rose-500'
                                    : driveUsage.percentUsed >= 50
                                      ? 'bg-accent'
                                      : 'bg-emerald-500'
                                }`}
                                style={{
                                  width: `${Math.min(100, Math.max(driveUsage.percentUsed, driveUsage.units > 0 ? 0.5 : 0))}%`,
                                }}
                              />
                            </div>
                            <p className="text-[11px] text-zinc-500 leading-snug">
                              {formatUnits(driveUsage.units)} /{' '}
                              {formatUnits(driveUsage.dailyLimitUnits)} unités (
                              {driveUsage.percentUsed < 0.01 && driveUsage.units > 0
                                ? '<0,01'
                                : driveUsage.percentUsed.toLocaleString('fr-FR', {
                                    maximumFractionDigits: 2,
                                  })}
                              % de la limite gratuite / jour)
                            </p>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setDriveDetailsOpen((o) => !o)}
                          className="flex items-center justify-between w-full rounded-xl border border-zinc-200 dark:border-white/10 px-3 py-2.5 text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-white/5"
                          aria-expanded={driveDetailsOpen}
                        >
                          <span>Options Drive</span>
                          <ChevronDown
                            className={`w-4 h-4 text-zinc-400 transition-transform ${
                              driveDetailsOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        <AnimatePresence initial={false}>
                          {driveDetailsOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="space-y-3 pt-1">
                                <p className="text-xs text-accent-text bg-accent-soft rounded-xl px-3 py-2">
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
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      disabled={busy || googleSyncFolders.length === 0}
                                      onClick={() => void runSync()}
                                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-accent text-accent-fg py-2.5 text-sm font-medium disabled:opacity-40"
                                    >
                                      <RefreshCw
                                        className={`w-4 h-4 ${syncProgress ? 'animate-spin' : ''}`}
                                      />
                                      {syncProgress
                                        ? `Sync… ${Math.round(syncProgress.percent)}%`
                                        : 'Synchroniser maintenant'}
                                    </button>
                                    {syncProgress && (
                                      <button
                                        type="button"
                                        onClick={cancelSync}
                                        className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 px-3 py-2.5 text-sm font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/20"
                                        title="Interrompre la synchronisation"
                                      >
                                        <Square className="w-3.5 h-3.5 fill-current" />
                                        Stop
                                      </button>
                                    )}
                                  </div>
                                  {syncProgress && (
                                    <div className="space-y-1.5">
                                      <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                                        <div
                                          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
                                          style={{
                                            width: `${Math.min(100, Math.max(2, syncProgress.percent))}%`,
                                          }}
                                        />
                                      </div>
                                      <p className="text-[11px] text-zinc-500 truncate text-center">
                                        {syncProgress.current != null &&
                                        syncProgress.total != null
                                          ? `${syncProgress.current}/${syncProgress.total} — `
                                          : ''}
                                        {syncProgress.message}
                                      </p>
                                    </div>
                                  )}
                                  {lastSyncLabel && !syncProgress && (
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
                            </motion.div>
                          )}
                        </AnimatePresence>
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
