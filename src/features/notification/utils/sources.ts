import { hiddenAppCodes } from '@/core/session/myApps';
import { documentNotificationSource } from '@/features/official-document/utils/notificationSource';
import { parcelNotificationSource } from '@/features/parcel/utils/notificationSource';
import { roomNotificationSource } from '@/features/room-booking/utils/notificationSource';

import type { NotificationSource } from '../types';

/**
 * Every back-end whose notifications the app shows, in tab order. A new module writes its source
 * (`src/features/<feature>/utils/notificationSource.ts`) and adds it here; the screen, badge, toasts and push
 * taps pick it up. Its `id` is also the `service` its back-end sends in push data (PUSH_NOTIFICATIONS.md).
 */
export const notificationSources: readonly NotificationSource[] = [
  roomNotificationSource,
  parcelNotificationSource,
  // Not in builds that hide Văn thư (`hiddenAppCodes`), so a stray push cannot open its screens either.
  ...(hiddenAppCodes.has('VANTHU') ? [] : [documentNotificationSource]),
];

export const findNotificationSource = (id: unknown) => notificationSources.find((source) => source.id === id);
