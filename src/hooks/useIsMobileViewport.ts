import { useEffect, useState } from 'react';
import { MOBILE_MEDIA_QUERY } from '../lib/columnsPref';

/** True when viewport is below the `md` breakpoint (mobile prefs). */
export function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MEDIA_QUERY);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return isMobile;
}
