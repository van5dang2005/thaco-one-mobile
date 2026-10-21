import { useInfiniteQuery } from '@tanstack/react-query';

import { nextPageParam } from '@/core/api/types';
import { qk } from '@/core/query/keys';

import { guestApi } from '../api/guest.api';
import type { GuestScheduleFilter } from '../types';

/** The day's visits under a tab, page by page; every page carries the counters of the whole day. */
export function useGuestSchedules({ day, tab, search }: GuestScheduleFilter) {
  // No empty search in the key, so the dashboard and the list's "Tất cả" share one cache entry.
  const filter: GuestScheduleFilter = search ? { day, tab, search } : { day, tab };
  return useInfiniteQuery({
    queryKey: qk.guests.schedules(filter),
    queryFn: ({ pageParam }) => guestApi.schedules(filter, pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
  });
}
