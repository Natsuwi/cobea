import { useCallback, useEffect, useRef, useState } from 'react';
import {
  dismissUpdate,
  fetchRemoteVersion,
  forceAppUpdate,
  getClientBuildId,
  isUpdateAvailable,
  wasDismissedFor,
  type RemoteVersion,
} from '../lib/appUpdate';

const POLL_MS = 60_000;

export function useAppUpdate() {
  const [update, setUpdate] = useState<RemoteVersion | null>(null);
  const [updating, setUpdating] = useState(false);
  const clientBuildId = useRef(getClientBuildId());

  const check = useCallback(async () => {
    const remote = await fetchRemoteVersion();
    if (!isUpdateAvailable(remote) || !remote) {
      setUpdate(null);
      return;
    }
    if (wasDismissedFor(remote.buildId)) {
      setUpdate(null);
      return;
    }
    setUpdate(remote);
  }, []);

  useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    const onFocus = () => void check();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [check]);

  const applyUpdate = useCallback(async () => {
    setUpdating(true);
    try {
      await forceAppUpdate();
    } catch {
      setUpdating(false);
      window.location.reload();
    }
  }, []);

  const dismiss = useCallback(() => {
    if (update?.buildId) dismissUpdate(update.buildId);
    setUpdate(null);
  }, [update]);

  return {
    updateAvailable: Boolean(update),
    remoteBuildId: update?.buildId ?? null,
    clientBuildId: clientBuildId.current,
    builtAt: update?.builtAt ?? null,
    updating,
    applyUpdate,
    dismiss,
    recheck: check,
  };
}
