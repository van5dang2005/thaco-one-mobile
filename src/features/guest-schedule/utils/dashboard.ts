import { parseServerDate } from '@/core/time/vn';

import type { GuestScheduleItem } from '../types';

/** Where a visit is for the guard: still to come, inside the premises, or gone (turned away counts as gone). */
export type VisitStage = 'upcoming' | 'inside' | 'left';

export function visitStage(visit: Pick<GuestScheduleItem, 'status'>): VisitStage {
  if (visit.status === 'checkedIn') return 'inside';
  return visit.status === 'checkedOut' || visit.status === 'rejected' ? 'left' : 'upcoming';
}

export const visitStart = (visit: Pick<GuestScheduleItem, 'from'>) => parseServerDate(visit.from) ?? new Date(0);
export const visitEnd = (visit: Pick<GuestScheduleItem, 'to'>) => parseServerDate(visit.to) ?? new Date(0);

/** Sort comparator: earliest start first. */
export const byStart = (a: Pick<GuestScheduleItem, 'from'>, b: Pick<GuestScheduleItem, 'from'>) => visitStart(a).getTime() - visitStart(b).getTime();
