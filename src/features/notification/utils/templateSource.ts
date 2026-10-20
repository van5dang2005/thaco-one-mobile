import type { QueryKey } from '@tanstack/react-query';
import type { Href } from 'expo-router';

import type { ServiceId } from '@/core/api/ApiError';
import { apiFor } from '@/core/api/clients';
import { DEFAULT_PAGE_SIZE, nextPageParam, type NotificationDto } from '@/core/api/types';
import { qk } from '@/core/query/keys';
import { parseServerDate } from '@/core/time/vn';

import { notificationsApi } from '../api/notification.api';
import type { AppNotification, NotificationSource } from '../types';

/** `ReceiveNotification` of the template back-ends; the room service adds the booking fields. */
type ReceiveNotificationPayload = {
  title?: string | null;
  content?: string | null;
  bookingId?: string | null;
  groupId?: string | null;
  roomId?: string | null;
  code?: string | null;
};

type ResourceUpdatedPayload = { resourceType?: number | null; resourceId?: string | null; title?: string | null };

/** What a template notification may point at: the list DTO carries none of it, live and push ones may. */
export type TemplateRef = { bookingId?: string | null };

/** What a source reads out of a notification's `content`: the text to show, and what it points at. */
export type TemplateContent = TemplateRef & { body: string | null };

type TemplateOptions = {
  /** Screen a notification opens. */
  hrefFor: (ref: TemplateRef) => Href;
  /** `content` → text and reference, for a back-end that stores data there (room); default: the text as is. */
  readContent?: (content: string | null) => TemplateContent;
  /** Refreshed with the profile on `PermissionsUpdated`. */
  permissionKeys?: readonly QueryKey[];
  /** `ResourceUpdated` (the back-end's `ResourceType` value) → query groups to refresh. */
  resourceKeys: (resourceType: number | null | undefined) => readonly QueryKey[];
};

const text = (value: unknown) => (typeof value === 'string' ? value : null);

/**
 * The calls and live channel of a back-end built on the shared THACO .NET template (parcel, room): same
 * `/api/notifications` routes, `NotificationDto`, paging and `/hubs/notifications` hub. A source of another
 * shape (Văn thư's `/api/ThongBao`) writes these fields itself.
 */
export function templateSource(service: ServiceId, { hrefFor, readContent = (body) => ({ body }), permissionKeys = [], resourceKeys }: TemplateOptions) {
  const toNotification = (dto: NotificationDto): AppNotification => {
    const { body, ...ref } = readContent(dto.content ?? null);
    return {
      id: dto.id,
      title: dto.title ?? null,
      body,
      type: dto.code ?? null,
      isRead: !!dto.isRead,
      createdAt: parseServerDate(dto.createdAt)?.toISOString() ?? null,
      href: hrefFor(ref),
    };
  };

  return {
    id: service,
    enabled: (session) => session.connected[service],
    list: async (page) => {
      const result = await notificationsApi.list(service, page, DEFAULT_PAGE_SIZE);
      return { items: result.items.map(toNotification), nextPage: nextPageParam(result) };
    },
    unreadCount: async () => Number(await notificationsApi.totalUnread(service)) || 0,
    markRead: (id) => notificationsApi.markRead(service, id),
    markAllRead: () => notificationsApi.markAllRead(service),
    remove: (id) => notificationsApi.remove(service, id),
    removeAll: () => notificationsApi.removeAll(service),
    hrefForPush: (data) => hrefFor({ bookingId: text(data.bookingId) }),
    realtime: {
      hubUrl: `${apiFor(service).baseUrl}/hubs/notifications`,
      parse: (payload) => {
        const { title, content, bookingId } = payload as ReceiveNotificationPayload;
        const { body, ...ref } = readContent(content ?? null);
        return { title: title ?? null, body, href: hrefFor({ ...ref, bookingId: bookingId ?? ref.bookingId }) };
      },
      events: {
        PermissionsUpdated: () => [qk.me(service), ...permissionKeys],
        ResourceUpdated: (payload) => resourceKeys((payload as ResourceUpdatedPayload).resourceType),
      },
    },
  } satisfies Partial<NotificationSource>;
}
