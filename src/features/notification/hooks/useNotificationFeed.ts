import { useInfiniteQuery } from '@tanstack/react-query';

import { qk } from '@/core/query/keys';

import type { NotificationSource } from '../types';
import { feedItems, firstFeedCursor, loadFeedPage } from '../utils/feed';

/** Notifications of `sources` merged newest first, a page at a time. */
export function useNotificationFeed(sources: readonly NotificationSource[]) {
  const query = useInfiniteQuery({
    queryKey: qk.notifications.feed(sources.map((source) => source.id).join(',')),
    queryFn: ({ pageParam }) => loadFeedPage(sources, pageParam),
    initialPageParam: firstFeedCursor(sources),
    getNextPageParam: (last) => last.cursor,
    enabled: sources.length > 0,
  });
  const pages = query.data?.pages;
  return {
    query,
    items: feedItems(pages),
    failed: [...new Set(pages?.flatMap((page) => page.failed) ?? [])],
  };
}
