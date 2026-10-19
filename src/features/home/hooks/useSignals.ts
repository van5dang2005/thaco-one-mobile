import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { qk } from '@/core/query/keys';
import { useCapabilities } from '@/core/session/capabilities';
import { useSessionStore } from '@/core/session/sessionStore';
import { sameId } from '@/core/session/userTypes';
import { addDays, atMinutes, formatKey, minutesOfDay, todayKey } from '@/core/time/vn';
import { useDocumentSummary } from '@/features/official-document/hooks/useDocumentSummary';
import { useDueParcels } from '@/features/parcel/hooks/useDueParcels';
import { useMyParcelStats } from '@/features/parcel/hooks/useMyParcelStats';
import { useReceptionStats } from '@/features/parcel/hooks/useReceptionStats';
import { bookingsApi } from '@/features/room-booking/api/booking.api';
import { useDefaultAreaId } from '@/features/room-booking/hooks/useDefaultAreaId';
import { useRooms } from '@/features/room-booking/hooks/useRooms';
import { useSchedule } from '@/features/room-booking/hooks/useSchedule';
import { BookingStatus, type BookingDto } from '@/features/room-booking/types';
import { bookingFrom, bookingTo, roomHours } from '@/features/room-booking/utils/booking';

import { useHomePrefs } from '../store/homePrefs';

/** What a badge / summary hook returns: the slice of a query result the layouts read. */
export type Signal<T> = Pick<UseQueryResult<T>, 'data' | 'isLoading'>;

/** Summaries that cost extra requests only run while the card layout is on screen (or previewed). */
function useCardsVisible() {
  return useHomePrefs((s) => (s.draft?.layout ?? s.layout) === 'cards');
}

// ── Meetings ────────────────────────────────────────────────────────────────

function todayWindow(now = new Date()) {
  const today = todayKey(now);
  return { fromDate: atMinutes(today, 0).toISOString(), toDate: atMinutes(addDays(today, 1), 0).toISOString() };
}

/** My bookings (get-my-bookings) that are still on for today: waiting or approved. */
export function useTodayMeetings() {
  const connected = useSessionStore((s) => s.connected.room);
  const window = todayWindow();
  return useQuery({
    queryKey: qk.bookings.mine({ ...window, scope: 'home-today' }),
    queryFn: () => bookingsApi.mine({ pageNumber: 1, pageSize: 50, ...window }),
    enabled: connected,
    select: (page) =>
      page.items
        .filter((b) => b.status === BookingStatus.Waiting || b.status === BookingStatus.Approved)
        .sort((a, b) => (a.from ?? '').localeCompare(b.from ?? '')),
  });
}

/**
 * My meeting that is live or next today (approved or still waiting; `bookings` sorted by start),
 * and how many more follow it. Only an approved meeting can be live.
 */
export function pickNextMeeting(bookings: BookingDto[] | undefined, now = new Date()) {
  const upcoming = (bookings ?? []).filter((b) => (bookingTo(b)?.getTime() ?? 0) > now.getTime());
  const next = upcoming.find((b) => b.status === BookingStatus.Approved && (bookingFrom(b)?.getTime() ?? Infinity) <= now.getTime()) ?? upcoming[0];
  if (!next) return null;
  const live = next.status === BookingStatus.Approved && (bookingFrom(next)?.getTime() ?? Infinity) <= now.getTime();
  return { booking: next, live, later: upcoming.length - 1 };
}

export type FreeRooms = { free: number; total: number; /** One entry per room of the area, in room order: true when free now. */ rooms: boolean[] };

/** Rooms of my default area that are open and not taken right now. */
export function useFreeRooms(enabled: boolean): Signal<FreeRooms> {
  const areaId = useDefaultAreaId();
  const rooms = useRooms(enabled ? areaId : undefined);
  const schedule = useSchedule({ ...todayWindow(), areaId }, enabled);
  if (!enabled || !areaId) return { data: undefined, isLoading: false };
  if (!rooms.data || !schedule.data) return { data: undefined, isLoading: rooms.isLoading || schedule.isLoading };

  const now = new Date();
  const nowMin = minutesOfDay(now);
  const free = rooms.data.map((room) => {
    const { open, close } = roomHours(room);
    if (nowMin < open || nowMin >= close) return false;
    return !schedule.data.some((b) => {
      if (!sameId(b.roomId ?? b.room?.id, room.id)) return false;
      // A pending booking only blocks rooms that refuse overlapping requests.
      const blocking = b.status === BookingStatus.Approved || (b.status === BookingStatus.Waiting && room.isDisableOverlappingTimes);
      const from = bookingFrom(b)?.getTime() ?? 0;
      const to = bookingTo(b)?.getTime() ?? 0;
      return blocking && from <= now.getTime() && now.getTime() < to;
    });
  });
  return { data: { free: free.filter(Boolean).length, total: free.length, rooms: free }, isLoading: false };
}

export function useFreeRoomsSummary(): Signal<string> {
  const { t } = useTranslation();
  const rooms = useFreeRooms(useCardsVisible());
  if (!rooms.data) return { data: rooms.isLoading ? undefined : t('home.summary.bookRoom'), isLoading: rooms.isLoading };
  return { data: rooms.data.free ? t('home.summary.freeRooms', { count: rooms.data.free }) : t('home.summary.noFreeRooms'), isLoading: false };
}

// ── Parcels ─────────────────────────────────────────────────────────────────

/** Parcels I still have to collect: waiting (incl. due) and overdue, as on the "Cần xử lý" tile. */
export function useWaitingParcels(): Signal<number> {
  const stats = useMyParcelStats();
  return { data: stats.data ? stats.data.waiting + stats.data.overdue : undefined, isLoading: stats.isLoading };
}

/** "2 chờ · 1 quá hạn" or "2 chờ · 1 đến hạn". `waiting` already includes the Due ones. */
export function useParcelSummary(): Signal<string> {
  const { t } = useTranslation();
  const enabled = useCardsVisible();
  const stats = useMyParcelStats();
  const due = useDueParcels(enabled);
  const s = stats.data;
  if (!s) return { data: undefined, isLoading: stats.isLoading };
  if (!s.waiting && !s.overdue) return { data: t('home.summary.parcelsNone'), isLoading: false };
  // Two parts at most so the line fits a half-width card; overdue outranks due.
  const parts = [
    s.waiting ? t('home.summary.parcelsWaiting', { count: s.waiting }) : null,
    s.overdue ? t('home.summary.parcelsOverdue', { count: s.overdue }) : due.data?.count ? t('home.summary.parcelsDue', { count: due.data.count }) : null,
  ];
  return { data: parts.filter(Boolean).join(' · '), isLoading: false };
}

/** Reception desk: parcels of my units still waiting for hand-over. */
export function useReceptionSummary(): Signal<string> {
  const { t } = useTranslation();
  const { has } = useCapabilities();
  const enabled = useCardsVisible() && has('parcel.reception');
  const stats = useReceptionStats({}, enabled);
  if (!enabled) return { data: t('home.summary.reception'), isLoading: false };
  const waiting = stats.data?.waiting;
  return {
    data: waiting === undefined ? undefined : waiting ? t('home.summary.receptionWaiting', { count: waiting }) : t('home.summary.receptionNone'),
    isLoading: stats.isLoading,
  };
}

// ── "Cần xử lý" ─────────────────────────────────────────────────────────────

export type TodoKind = 'parcels';

/** The module behind each to-do tile; a tile shows only when its module is visible to the user. */
export const todoModuleIds: Record<TodoKind, string> = { parcels: 'parcels' };

export type TodoItem = { kind: TodoKind; count?: number; sub?: string; isLoading: boolean };

/** Counts and second lines of the to-do tiles (2c / 2g). Parcels count the ones waiting for me (incl. due) plus overdue. */
export function useTodoItems(): Record<TodoKind, TodoItem> {
  const { t } = useTranslation();
  const stats = useMyParcelStats();
  const due = useDueParcels();

  const s = stats.data;
  const parcelCount = s ? s.waiting + s.overdue : undefined;
  const parcelSub = !s
    ? undefined
    : s.overdue
      ? t('home.todo.parcelsOverdue', { count: s.overdue })
      : due.data?.count && due.data.firstDueKey
        ? t('home.todo.parcelsDue', { count: due.data.count, date: formatKey(due.data.firstDueKey, false) })
        : s.waiting
          ? t('home.todo.parcelsWaiting')
          : t('home.todo.parcelsNone');

  return {
    parcels: { kind: 'parcels', count: parcelCount, sub: parcelSub, isLoading: stats.isLoading },
  };
}

// ── Văn thư ─────────────────────────────────────────────────────────────────

/** The portal grants the Văn thư app (`VANTHU`): only then do its counters load. */
function useDocumentsGranted() {
  return useSessionStore((s) => !!s.apps?.some((app) => app.code === 'VANTHU'));
}

/** Documents waiting for me: to distribute plus to process (chủ trì / phối hợp). */
export function useDocumentsPending(): Signal<number> {
  const { summary, isLoading } = useDocumentSummary(useDocumentsGranted());
  return { data: summary?.pending, isLoading };
}

/** "N chờ xử lý · N quá hạn" for the "Thẻ" layout. */
export function useDocumentsSummary(): Signal<string> {
  const { t } = useTranslation();
  const { summary, isLoading } = useDocumentSummary(useDocumentsGranted());
  if (!summary) return { data: undefined, isLoading };
  if (!summary.pending) return { data: t('home.summary.documentsNone'), isLoading: false };
  const parts = [t('home.summary.documentsPending', { count: summary.pending }), summary.overdue ? t('home.summary.documentsOverdue', { count: summary.overdue }) : null];
  return { data: parts.filter(Boolean).join(' · '), isLoading: false };
}
