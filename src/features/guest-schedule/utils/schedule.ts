import type { Query } from '@/core/api/http';

import {
  type GuestScheduleFilter,
  type GuestScheduleItem,
  type GuestScheduleListItemDto,
  type GuestSchedulePage,
  type GuestSchedulePageDto,
  type GuestVisitStatus,
  type GuestVisitTab,
  SecurityCheckInStatus,
} from '../types';

/** Visits per page: a day at the gate fits in one, so the dashboard sees all of them. */
export const SCHEDULE_PAGE_SIZE = 50;

/** What each tab adds to the query: one `securityCheckInStatus`, or `securityConfirmed` for inside and gone together. */
const tabQuery: Record<GuestVisitTab, Query> = {
  all: {},
  pending: { securityCheckInStatus: SecurityCheckInStatus.Pending },
  confirmed: { securityConfirmed: true },
  checkedIn: { securityCheckInStatus: SecurityCheckInStatus.CheckedIn },
  checkedOut: { securityCheckInStatus: SecurityCheckInStatus.CheckedOut },
};

/** The query of `GET /api/security/guest-schedules/mobile` for a page of a filter; the day goes as both ends. */
export function scheduleQuery({ day, tab, search }: GuestScheduleFilter, pageNumber: number): Query {
  return { pageNumber, pageSize: SCHEDULE_PAGE_SIZE, search, fromDate: day, toDate: day, ...tabQuery[tab] };
}

const statuses: Record<SecurityCheckInStatus, GuestVisitStatus> = {
  [SecurityCheckInStatus.Pending]: 'pending',
  [SecurityCheckInStatus.CheckedIn]: 'checkedIn',
  [SecurityCheckInStatus.CheckedOut]: 'checkedOut',
};

/** A visit of the list; null when it has no id. */
export function toScheduleItem(dto: GuestScheduleListItemDto | null | undefined): GuestScheduleItem | null {
  if (!dto?.guestScheduleId) return null;
  const units = (dto.workingUnits ?? []).map((unit) => unit.workingUnitName?.trim()).filter(Boolean);
  return {
    id: dto.guestScheduleId,
    groupName: dto.guestName?.trim() || dto.guestCode?.trim() || '',
    guestType: dto.guestTypeName?.trim() || null,
    host: units.length ? units.join(', ') : null,
    from: dto.startDate ?? '',
    to: dto.endDate ?? dto.startDate ?? '',
    guestCount: Math.max(0, dto.guestCount ?? 0),
    status: statuses[dto.securityCheckInStatus ?? SecurityCheckInStatus.Pending] ?? 'pending',
  };
}

export function toSchedulePage(dto: GuestSchedulePageDto): GuestSchedulePage {
  const total = dto.summary?.allCount ?? 0;
  const pending = dto.summary?.pendingCount ?? 0;
  return {
    ...dto,
    items: (dto.items ?? []).map(toScheduleItem).filter((item) => item !== null),
    // `checkInCount` still leaves out the groups that have left; everything not pending is confirmed either way.
    counts: { total, pending, confirmed: Math.max(0, total - pending) },
  };
}
