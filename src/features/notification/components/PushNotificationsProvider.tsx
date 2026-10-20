import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { notifications, type NotificationsModule } from '@/core/notifications/permission';
import { registerPushToken } from '@/core/notifications/push';
import { useSessionStore } from '@/core/session/sessionStore';
import { kv, kvKeys } from '@/core/storage/kv';

import { findNotificationSource } from '../utils/sources';

const pushModule = notifications();

// In the foreground SignalR already pops a toast for the same notification: only keep it in the tray.
pushModule?.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Where a tapped push goes: its `href` (an app route) when the back-end sends one, else what its source decides. */
function hrefForPush(data: Record<string, unknown>): Href | null {
  if (typeof data.href === 'string' && data.href.startsWith('/')) return data.href as Href;
  return findNotificationSource(data.service)?.hrefForPush(data) ?? null;
}

function openResponse(n: NotificationsModule, response: ReturnType<NotificationsModule['getLastNotificationResponse']>) {
  if (!response || response.actionIdentifier !== n.DEFAULT_ACTION_IDENTIFIER) return;
  const href = hrefForPush(response.notification.request.content.data ?? {});
  n.clearLastNotificationResponse();
  if (href) router.push(href);
}

/**
 * Remote (push) notifications while signed in:
 * - asks for the permission once after sign-in, then sends the push token to the back-ends the account uses
 *   (again whenever that list changes);
 * - opens the screen a tapped push points to, including the tap that launched the app.
 */
export function PushNotificationsProvider() {
  const connected = useSessionStore((s) => s.connected);

  useEffect(() => {
    const n = pushModule;
    if (!n) return;
    void (async () => {
      const { granted, canAskAgain } = await n.getPermissionsAsync();
      if (!granted && canAskAgain && !kv.getBoolean(kvKeys.pushPrompted)) {
        kv.set(kvKeys.pushPrompted, true);
        await n.requestPermissionsAsync();
      }
      await registerPushToken();
    })();
  }, [connected]);

  useEffect(() => {
    const n = pushModule;
    if (!n) return;
    openResponse(n, n.getLastNotificationResponse());
    const sub = n.addNotificationResponseReceivedListener((response) => openResponse(n, response));
    return () => sub.remove();
  }, []);

  return null;
}
