import { qk } from '@/core/query/keys';
import { formatDate, formatDateTime, formatTime, isSameVnDay, parseServerDate } from '@/core/time/vn';
import type { AppNotification, NotificationLook, NotificationSource } from '@/features/notification/types';
import { type TemplateContent, templateSource } from '@/features/notification/utils/templateSource';
import { CalendarCheckIcon, CalendarIcon, CalendarOffIcon, CalendarXIcon, HourglassIcon, RotateCcwIcon } from '@/shared/ui/icons';

/** Look of each room notification code (CLAUDE.md 3.7). */
export function roomLook({ type }: Pick<AppNotification, 'type'>): NotificationLook {
  switch (type) {
    case 'NEW_BOOKING': // waits for my approval
      return { icon: HourglassIcon, tone: 'wait' };
    case 'BOOKING_APPROVED':
    case 'BOOKING_FINISH_APPROVED':
    case 'BOOKING_PARTICIPANT_APPROVED':
      return { icon: CalendarCheckIcon, tone: 'ok' };
    case 'BOOKING_REJECTED':
    case 'BOOKING_FINISH_REJECTED':
      return { icon: CalendarXIcon, tone: 'danger' };
    case 'UNDO_APPROVAL':
    case 'UNDO_APPROVAL_TO_CREATOR':
      return { icon: RotateCcwIcon, tone: 'warn' };
    case 'BOOKING_AUTO_CANCELLED':
    case 'BOOKING_CANCELLATION':
      return { icon: CalendarOffIcon, tone: 'off' };
    default:
      return { icon: CalendarIcon, tone: 'wait' };
  }
}

/** "08:00–09:30 · 20/10/2026", or both ends in full when the meeting spans days. */
function meetingTime(from: Date | null, to: Date | null) {
  if (!from) return null;
  if (!to) return `${formatTime(from)} · ${formatDate(from)}`;
  return isSameVnDay(from, to) ? `${formatTime(from)}–${formatTime(to)} · ${formatDate(from)}` : `${formatDateTime(from)} – ${formatDateTime(to)}`;
}

/**
 * The room back-end stores `{ BookingId, GroupId, RoomId, From, To }` (JSON) as the content of its in-app
 * notifications (`BookingApprovalNotiInAppEventConsumer`): show the meeting time instead, and open the booking.
 */
export function readBookingContent(content: string | null): TemplateContent {
  let data: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = content?.trimStart().startsWith('{') ? JSON.parse(content) : null;
    if (parsed && typeof parsed === 'object') data = parsed as Record<string, unknown>;
  } catch {
    // Plain text after all.
  }
  if (!data) return { body: content };
  const date = (value: unknown) => (typeof value === 'string' ? parseServerDate(value) : null);
  return {
    body: meetingTime(date(data.From), date(data.To)),
    bookingId: typeof data.BookingId === 'string' ? data.BookingId : null,
  };
}

/**
 * Meeting-room notifications (`NEW_BOOKING`, `BOOKING_FINISH_APPROVED`…, CLAUDE.md 3.7): each opens its booking
 * when it names one (a request for a whole multi-day group does not), else the room calendar.
 */
export const roomNotificationSource: NotificationSource = {
  ...templateSource('room', {
    hrefFor: ({ bookingId }) => (bookingId ? { pathname: '/rooms/bookings/[id]', params: { id: bookingId } } : '/calendar'),
    readContent: readBookingContent,
    resourceKeys: (resourceType) => {
      switch (resourceType) {
        case 9: // Booking
          return [qk.bookings.root];
        case 1: // Room
        case 2: // Service
        case 3: // Area
        case 10: // ApprovalWorkflow
        case 11: // ApprovalStep
        case 12: // ApprovalHandler
          return [qk.rooms.root];
        case 14: // Notification
          return [qk.notifications.root];
        default:
          return [qk.bookings.root, qk.rooms.root];
      }
    },
  }),
  label: (t) => t('notifications.tabRoom'),
  name: (t) => t('services.room'),
  icon: CalendarCheckIcon,
  accent: 'meeting',
  appearance: roomLook,
  refreshKeys: [qk.bookings.root],
};
