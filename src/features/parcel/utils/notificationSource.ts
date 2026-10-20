import { qk } from '@/core/query/keys';
import type { AppNotification, NotificationLook, NotificationSource } from '@/features/notification/types';
import { templateSource } from '@/features/notification/utils/templateSource';
import { BellIcon, FileSpreadsheetIcon, HandshakeIcon, PackageCheckIcon, PackageIcon, PackageXIcon } from '@/shared/ui/icons';

/**
 * The parcel back-end leaves `code` empty on most in-app notifications (only report exports carry one), so
 * the look comes from its fixed titles ("Bưu phẩm quá hạn nhận", "Ủy quyền sắp hết hạn"…), codes first.
 */
export function parcelLook({ type, title }: Pick<AppNotification, 'type' | 'title'>): NotificationLook {
  if (type === 'EXPORT_SUCCESSFULLY') return { icon: FileSpreadsheetIcon, tone: 'ok' };
  if (type === 'EXPORT_FAILED') return { icon: FileSpreadsheetIcon, tone: 'danger' };
  const text = (title ?? '').normalize('NFC').toLocaleLowerCase('vi');
  const has = (...words: string[]) => words.some((word) => text.includes(word));

  if (type === 'NEW_DELEGATION' || type === 'DUE_DELEGATION' || has('ủy quyền', 'uỷ quyền')) {
    if (has('từ chối')) return { icon: HandshakeIcon, tone: 'danger' };
    if (type === 'DUE_DELEGATION' || has('sắp hết hạn')) return { icon: HandshakeIcon, tone: 'warn' };
    if (has('hết hạn', 'kết thúc', 'bị xóa')) return { icon: HandshakeIcon, tone: 'off' };
    if (has('đồng ý')) return { icon: HandshakeIcon, tone: 'ok' };
    return { icon: HandshakeIcon, tone: 'wait' };
  }
  if (type === 'HANDOVER_PARCEL' || has('bàn giao')) return { icon: PackageCheckIcon, tone: 'ok' };
  if (type === 'REMIND_PARCEL' || has('quá hạn', 'nhắc')) return { icon: PackageIcon, tone: 'danger' };
  if (type === 'DUE_PARCEL' || has('đến hạn')) return { icon: PackageIcon, tone: 'warn' };
  if (type === 'CANCEL_PARCEL' || has('hủy', 'huỷ')) return { icon: PackageXIcon, tone: 'off' };
  if (type === 'NOTICE_OF_CORRECTION' || has('đính chính')) return { icon: PackageIcon, tone: 'warn' };
  return { icon: type || has('bưu phẩm') ? PackageIcon : BellIcon, tone: 'wait' };
}

/** Parcel notifications (`NEW_PARCEL`, `DUE_PARCEL`…, CLAUDE.md 2.8): each opens "Bưu phẩm của tôi". */
export const parcelNotificationSource: NotificationSource = {
  ...templateSource('parcel', {
    hrefFor: () => '/parcels',
    permissionKeys: [qk.menus],
    resourceKeys: (resourceType) => {
      switch (resourceType) {
        case 1: // Delegation
        case 2: // Parcel
        case 3: // ParcelLog
          return [qk.parcels.root];
        case 4: // Department
          return [qk.parcels.departments];
        case 6: // Menu
        case 7: // Permission
          return [qk.menus];
        case 8: // Notification
          return [qk.notifications.root];
        default:
          return [qk.parcels.root];
      }
    },
  }),
  label: (t) => t('notifications.tabParcel'),
  name: (t) => t('services.parcel'),
  appearance: parcelLook,
  refreshKeys: [qk.parcels.root],
};
