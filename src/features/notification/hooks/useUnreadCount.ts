import { useQueries } from '@tanstack/react-query';

import { qk } from '@/core/query/keys';

import type { NotificationSource } from '../types';
import { useNotificationSources } from './useNotificationSources';

const unreadQuery = (source: NotificationSource) => ({
  queryKey: qk.notifications.unread(source.id),
  queryFn: () => source.unreadCount(),
  // SignalR pushes updates; polling is only a fallback when the socket is down.
  refetchInterval: 120_000,
});

/** Unread count of each source the user may use, by source id (0 while unknown or failed). */
export function useUnreadCounts(): Record<string, number> {
  const sources = useNotificationSources();
  return useQueries({
    queries: sources.map(unreadQuery),
    combine: (results) => Object.fromEntries(results.map((result, index) => [sources[index].id, Number(result.data) || 0])),
  });
}

/** Badge on the bell: unread notifications of every source. */
export function useTotalUnread() {
  const counts = useUnreadCounts();
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}
