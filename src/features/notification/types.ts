import type { QueryKey } from '@tanstack/react-query';
import type { Href } from 'expo-router';
import type { TFunction } from 'i18next';

import type { useSessionStore } from '@/core/session/sessionStore';
import type { AppIcon } from '@/shared/ui/icons';
import type { Tone } from '@/shared/ui/tones';

/**
 * A notification as every screen shows it, whatever back-end sent it (its source maps the DTO onto this).
 * Plain JSON only: lists live in the persisted query cache.
 */
export type AppNotification = {
  id: string;
  title: string | null;
  body: string | null;
  /** The back-end's own code (`NEW_PARCEL`, `BOOKING_APPROVED`, Văn thư's `loai`…), null when it sends none. */
  type: string | null;
  isRead: boolean;
  /** ISO time with its zone (sources of Vietnam-time back-ends convert); read with `parseServerDate`. */
  createdAt: string | null;
  /** Screen a tap opens; null when the notification cannot be opened (its record is gone or no longer yours). */
  href: Href | null;
};

/** One page of a source's list; `nextPage` is undefined on the last one. */
export type NotificationPage = { items: AppNotification[]; nextPage: number | undefined };

export type NotificationLook = { icon: AppIcon; tone: Tone };

/** A notification arriving live (SignalR): what its toast shows and opens. */
export type LiveNotification = Pick<AppNotification, 'title' | 'body' | 'href'>;

type SessionState = ReturnType<typeof useSessionStore.getState>;

/**
 * One back-end's notifications. Each feature that receives some declares its source
 * (`src/features/<feature>/utils/notificationSource.ts`) and lists it in `utils/sources.ts`. The screen, the bell
 * badge, live toasts and push taps only go through this type, so adding a module never touches them.
 */
export type NotificationSource = {
  /** Stable id: query keys, and the `service` a back-end puts in a push's `data` (PUSH_NOTIFICATIONS.md). */
  id: string;
  /** Tab label. */
  label: (t: TFunction) => string;
  /** Module name in "Xóa tất cả thông báo của {{service}}?". */
  name: (t: TFunction) => string;
  /** Glyph and tone of a row (CLAUDE.md §5): `danger` overdue / rejected, `warn` due soon, `ok` done, `off` cancelled. */
  appearance: (notification: AppNotification) => NotificationLook;
  /** Whether the user may call the back-end (apps portal); a selector of the session store. */
  enabled: (session: SessionState) => boolean;

  list: (page: number) => Promise<NotificationPage>;
  unreadCount: () => Promise<number>;
  markRead: (id: string) => Promise<unknown>;
  // Calls a back-end may lack (Văn thư cannot delete): the screen hides their buttons.
  markAllRead?: () => Promise<unknown>;
  remove?: (id: string) => Promise<unknown>;
  removeAll?: () => Promise<unknown>;

  /** Query groups to refresh when one of its notifications arrives (the change it announces happened server-side). */
  refreshKeys: readonly QueryKey[];
  /** Screen a tapped push opens when its `data` carries no `href`. */
  hrefForPush: (data: Record<string, unknown>) => Href | null;
  /** Live channel; without one the source updates on pull-to-refresh and the badge's polling only. */
  realtime?: {
    hubUrl: string;
    /** `ReceiveNotification` payload → its toast. */
    parse: (payload: unknown) => LiveNotification;
    /** Other hub events → query groups to refresh. */
    events?: Record<string, (payload: unknown) => readonly QueryKey[]>;
  };
};
