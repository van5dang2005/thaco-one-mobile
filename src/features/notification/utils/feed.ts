import { type DateKey, diffDays, parseServerDate, toDateKey } from '@/core/time/vn';

import type { AppNotification, NotificationSource } from '../types';

/** A row of the feed: the notification and the source it came from. */
export type FeedItem = AppNotification & { sourceId: string };

/** Where each source stands: its next page (undefined = no more) and what it gave that is not shown yet. */
export type FeedCursor = { next: Record<string, number | undefined>; buffer: Record<string, AppNotification[]> };

/** One page of the feed; `failed` = sources that could not be loaded (the others still show). */
export type FeedPage = { items: FeedItem[]; failed: string[]; cursor: FeedCursor | undefined };

export const feedKey = (item: Pick<FeedItem, 'sourceId' | 'id'>) => `${item.sourceId}:${item.id}`;

const timeOf = (notification: AppNotification) => (notification.createdAt ? Date.parse(notification.createdAt) : 0);

export function firstFeedCursor(sources: readonly NotificationSource[]): FeedCursor {
  return { next: Object.fromEntries(sources.map((source) => [source.id, 1])), buffer: {} };
}

/**
 * Next page of the sources' notifications merged newest first. Each source pages on its own, so a source
 * with more pages may still hold items newer than the oldest it has given: only items at least that new are
 * shown, the rest wait in the cursor for the next page. Throws only when every source it needed failed.
 */
export async function loadFeedPage(sources: readonly NotificationSource[], cursor: FeedCursor): Promise<FeedPage> {
  const next = { ...cursor.next };
  const buffer = { ...cursor.buffer };
  const failed: string[] = [];
  let firstError: unknown;
  let asked = 0;

  await Promise.all(
    sources.map(async (source) => {
      const page = next[source.id];
      if (buffer[source.id]?.length || page === undefined) return;
      asked += 1;
      try {
        const result = await source.list(page);
        buffer[source.id] = result.items;
        next[source.id] = result.nextPage;
      } catch (error) {
        firstError ??= error;
        failed.push(source.id);
        next[source.id] = undefined;
      }
    }),
  );
  if (asked > 0 && failed.length === asked && !sources.some((source) => buffer[source.id]?.length)) throw firstError;

  const limits = sources.flatMap((source) => {
    const held = buffer[source.id] ?? [];
    return next[source.id] !== undefined && held.length ? [Math.min(...held.map(timeOf))] : [];
  });
  const watermark = limits.length ? Math.max(...limits) : Number.NEGATIVE_INFINITY;

  const items: FeedItem[] = [];
  for (const source of sources) {
    const kept: AppNotification[] = [];
    for (const notification of buffer[source.id] ?? []) {
      if (timeOf(notification) >= watermark) items.push({ ...notification, sourceId: source.id });
      else kept.push(notification);
    }
    buffer[source.id] = kept;
  }
  items.sort((a, b) => timeOf(b) - timeOf(a));

  const more = sources.some((source) => next[source.id] !== undefined || buffer[source.id]?.length);
  return { items, failed, cursor: more ? { next, buffer } : undefined };
}

/** Rows of every loaded page, once each (a notification arriving between two pages shifts the next one). */
export function feedItems(pages: readonly FeedPage[] | undefined): FeedItem[] {
  const seen = new Set<string>();
  return (pages ?? []).flatMap((page) =>
    page.items.filter((item) => {
      const key = feedKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );
}

export type DayGroup = 'today' | 'yesterday' | 'week' | 'older';

const DAY_GROUPS: DayGroup[] = ['today', 'yesterday', 'week', 'older'];

export function dayGroupOf(createdAt: string | null, today: DateKey): DayGroup {
  const date = parseServerDate(createdAt);
  const days = date ? diffDays(toDateKey(date), today) : Number.POSITIVE_INFINITY;
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 7 ? 'week' : 'older';
}

/** Rows under Hôm nay / Hôm qua / 7 ngày qua / Cũ hơn, keeping their order. */
export function groupByDay(items: readonly FeedItem[], today: DateKey): { key: DayGroup; items: FeedItem[] }[] {
  const groups = new Map<DayGroup, FeedItem[]>();
  for (const item of items) {
    const key = dayGroupOf(item.createdAt, today);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return DAY_GROUPS.filter((key) => groups.has(key)).map((key) => ({ key, items: groups.get(key)! }));
}
