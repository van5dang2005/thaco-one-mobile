import { useMemo } from 'react';

import { useSessionStore } from '@/core/session/sessionStore';

import { notificationSources } from '../utils/sources';

/** Sources the user may use, in tab order; the same array until that set changes (hubs restart on it). */
export function useNotificationSources() {
  const ids = useSessionStore((s) =>
    notificationSources
      .filter((source) => source.enabled(s))
      .map((source) => source.id)
      .join(','),
  );
  return useMemo(() => {
    const enabled = new Set(ids.split(','));
    return notificationSources.filter((source) => enabled.has(source.id));
  }, [ids]);
}
