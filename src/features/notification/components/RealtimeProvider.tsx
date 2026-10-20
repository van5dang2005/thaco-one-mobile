import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { qk } from '@/core/query/keys';
import { type HubEvents, ServiceHub } from '@/core/realtime/hub';
import { kv, kvKeys } from '@/core/storage/kv';
import { toast } from '@/shared/ui/Toast';

import { useNotificationSources } from '../hooks/useNotificationSources';
import type { NotificationSource } from '../types';

/**
 * Keeps one SignalR connection per notification source the user may use while the app is in the foreground.
 * - `ReceiveNotification`: toast (unless turned off in Profile) + bell badge refresh (+ the data the notification is about)
 * - the source's other events (`PermissionsUpdated`, `ResourceUpdated`…): invalidate the query groups it names
 */
export function RealtimeProvider() {
  const queryClient = useQueryClient();
  const sources = useNotificationSources();

  useEffect(() => {
    const invalidate = (keys: readonly QueryKey[]) => keys.forEach((queryKey) => void queryClient.invalidateQueries({ queryKey }));

    const eventsOf = (source: NotificationSource, realtime: NonNullable<NotificationSource['realtime']>): HubEvents => ({
      ...Object.fromEntries(Object.entries(realtime.events ?? {}).map(([name, keysFor]) => [name, (payload: unknown) => invalidate(keysFor(payload))])),
      ReceiveNotification: (payload) => {
        invalidate([qk.notifications.feeds, qk.notifications.unread(source.id), ...source.refreshKeys]);
        const { title, body, href } = realtime.parse(payload);
        const popups = kv.getBoolean(kvKeys.notificationPopups) !== false;
        if (popups && (title || body)) toast.notification(title ?? '', body ?? undefined, href ? () => router.push(href) : undefined);
      },
    });

    const live = sources.flatMap((source) =>
      source.realtime ? [{ source, hub: new ServiceHub(source.realtime.hubUrl, eventsOf(source, source.realtime), source.unreadCount) }] : [],
    );
    if (AppState.currentState === 'active') live.forEach(({ hub }) => hub.start());

    const subscription = AppState.addEventListener('change', (state) => {
      live.forEach(({ source, hub }) => {
        if (state === 'active') {
          hub.start();
          // Catch up on anything missed while the socket was closed.
          invalidate([qk.notifications.unread(source.id)]);
        } else if (state === 'background') {
          void hub.stop();
        }
      });
    });

    return () => {
      subscription.remove();
      live.forEach(({ hub }) => void hub.stop());
    };
  }, [sources, queryClient]);

  return null;
}
