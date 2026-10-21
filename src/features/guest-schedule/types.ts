import type { Paginated } from '@/core/api/types';
import type { DateKey } from '@/core/time/vn';

/** `GET /api/GuestSchedules/mobile/qr/{qrCode}`: the fields the app reads (times are UTC). */
export type GuestScheduleDto = {
  guestScheduleId: string;
  /** Registration number, e.g. `AUTO1020260003`. */
  guestCode?: string | null;
  /** "Khách hàng Malaysia - Đàm phán xe tải". */
  guestName?: string | null;
  guestCount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  purpose?: string | null;
  /** Units that receive the guests. */
  workingUnits?: { workingUnitId: string; workingUnitName?: string | null }[] | null;
  members?: { memberId: string; fullName?: string | null }[] | null;
};

/** A guest visit registration, what a guest QR points to. */
export type GuestVisit = {
  id: string;
  /** The code the QR holds; the check-in posts to the same link. */
  qrCode: string;
  /** Registration number, e.g. `AUTO1020260003`. */
  code?: string;
  /** "Khách hàng Malaysia - Đàm phán xe tải". */
  groupName: string;
  /** "Đàm phán hợp đồng xuất khẩu xe tải sang Malaysia". */
  purpose?: string | null;
  /** Registered number of guests. */
  guestCount: number;
  /** Working period of the visit (ISO, UTC; empty when the API gives none). */
  fromDate: string;
  toDate: string;
  /** Where the guests are received: the receiving units, "Công ty TNHH MTV Sản xuất và Lắp ráp xe tải THACO". */
  location?: string | null;
};

/** `securityCheckInStatus` of the list: where the group stands at the gate. */
export enum SecurityCheckInStatus {
  /** Chờ bảo vệ xác nhận. */
  Pending = 0,
  /** Đã vào cổng. */
  CheckedIn = 1,
  /** Đã ra cổng. */
  CheckedOut = 2,
}

/** An item of `GET /api/security/guest-schedules/mobile` (times are UTC). */
export type GuestScheduleListItemDto = {
  guestScheduleId: string;
  guestCode?: string | null;
  guestName?: string | null;
  /** The code the guests' QR holds. */
  qrToken?: string | null;
  guestTypeId?: string | null;
  /** "Khách hàng", "Đối tác"… */
  guestTypeName?: string | null;
  guestCount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string | null;
  securityCheckInStatus?: SecurityCheckInStatus | null;
  workingUnits?: { workingUnitId: string; workingUnitName?: string | null }[] | null;
};

/** `GET /api/security/guest-schedules/mobile`: a page of visits and the counters of the whole filter. */
export type GuestSchedulePageDto = Paginated<GuestScheduleListItemDto> & {
  summary?: {
    /** Every group the filter holds. */
    allCount?: number | null;
    /** `securityCheckInStatus` 0. */
    pendingCount?: number | null;
    /** `securityCheckInStatus` 1 only for now; the back-end will add 2 (đã ra cổng). */
    checkInCount?: number | null;
  } | null;
};

/** Where a visit stands at the gate: waiting for the guard, inside, gone. */
export type GuestVisitStatus = 'pending' | 'checkedIn' | 'checkedOut';

/** A tab of the list: every visit, one status, or `confirmed` (the guard has let them in: inside or gone). */
export type GuestVisitTab = 'all' | 'confirmed' | GuestVisitStatus;

/** A visit in the dashboard's "Lịch khách hôm nay" list. */
export type GuestScheduleItem = {
  id: string;
  /** "Đoàn KIA Hàn Quốc". */
  groupName: string;
  /** "Khách hàng", "Đối tác"… */
  guestType?: string | null;
  /** Who receives them: the receiving units. */
  host?: string | null;
  /** Working period of the visit (ISO, UTC). */
  from: string;
  to: string;
  guestCount: number;
  status: GuestVisitStatus;
};

/** What a list request asks for: the visits of a Vietnam day, under a tab, matching a search. */
export type GuestScheduleFilter = { day: DateKey; tab: GuestVisitTab; search?: string };

/** The counters over the whole filter, whatever the tab. */
export type GuestScheduleCounts = { total: number; pending: number; confirmed: number };

export type GuestSchedulePage = Paginated<GuestScheduleItem> & { counts: GuestScheduleCounts };

/** A gate check-in (the guard confirms the group at the gate). */
export type GuestCheckInInput = {
  /** ISO, UTC. */
  checkInAt: string;
  actualGuestCount: number;
  note?: string;
};

export type GuestCheckIn = GuestCheckInInput & { visit: GuestVisit };

/** What a failed lookup or check-in means for the guard, read from the API's status and message. */
export type GuestErrorCode = 'GUEST_QR_INVALID' | 'GUEST_VISIT_EXPIRED';

export class GuestError extends Error {
  readonly code: GuestErrorCode;

  constructor(code: GuestErrorCode) {
    super(code);
    this.name = 'GuestError';
    this.code = code;
  }
}
