import { useQuery } from '@tanstack/react-query';

import { qk } from '@/core/query/keys';
import { useSessionStore } from '@/core/session/sessionStore';
import type { DateKey } from '@/core/time/vn';

import { parcelsApi } from '../api/parcel.api';
import { ParcelStatus } from '../types';
import { parcelDeadline } from '../utils/parcel';

/** My parcels in the Due state (day 6), for "N đến hạn dd/MM" (home summary, the Chờ nhận tile). */
export function useDueParcels(enabled = true) {
  const connected = useSessionStore((s) => s.connected.parcel);
  return useQuery({
    queryKey: qk.parcels.my({ statuses: [ParcelStatus.Due], scope: 'home-due' }),
    queryFn: () => parcelsApi.my({ pageNumber: 1, pageSize: 50, statuses: [ParcelStatus.Due] }),
    enabled: connected && enabled,
    select: (page) => {
      const due = page.items.map((p) => parcelDeadline(p)?.dueKey).filter((key): key is DateKey => !!key).sort();
      return { count: page.items.length, firstDueKey: due[0] ?? null };
    },
  });
}
