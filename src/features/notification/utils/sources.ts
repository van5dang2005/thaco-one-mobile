import { parcelNotificationSource } from '@/features/parcel/utils/notificationSource';
import { roomNotificationSource } from '@/features/room-booking/utils/notificationSource';

import type { NotificationSource } from '../types';

/**
 * Every back-end whose notifications the app shows, in tab order. A new module writes its source
 * (`src/features/<feature>/utils/notificationSource.ts`) and adds it here; the screen, badge, toasts and push
 * taps pick it up. Its `id` is also the `service` its back-end sends in push data (PUSH_NOTIFICATIONS.md).
 */
export const notificationSources: readonly NotificationSource[] = [roomNotificationSource, parcelNotificationSource];

export const findNotificationSource = (id: unknown) => notificationSources.find((source) => source.id === id);
