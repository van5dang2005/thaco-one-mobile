import type { Paginated } from '@/core/api/types';
import type { DateKey } from '@/core/time/vn';

/** A gate record of the group: when the guard let it in or out, how many, and the guard's note. */
export type GateRecordDto = { time?: string | null; note?: string | null; actualAmount?: number | null };

/** Reception's record of one guest (`type` 1 check-in, 2 check-out). */
export type ReceptionRecordDto = { id?: string; type?: number | null; time?: string | null; note?: string | null };

/** A registered guest of `members[]`, with reception's records of them. */
export type GuestMemberDto = {
  memberId: string;
  fullName?: string | null;
  position?: string | null;
  identityNumber?: string | null;
  phone?: string | null;
  /** Added on the day, beyond the registration. */
  isExtra?: boolean | null;
  /** Reception marked them as not come. */
  isAbsent?: boolean | null;
  checkIn?: ReceptionRecordDto | null;
  checkOut?: ReceptionRecordDto | null;
};

/**
 * `GET /api/GuestSchedules/mobile/qr/{qrCode}` (also what check-in and check-out answer): the fields the app reads
 * (times are UTC). `canCheckOut` holds at the moment of the call (office hours 08:00–17:00 need a reception check-in).
 */
export type GuestScheduleDto = {
  guestScheduleId: string;
  /** Registration number, e.g. `AUTO1020260003`. */
  guestCode?: string | null;
  /** "Khách hàng Malaysia - Đàm phán xe tải". */
  guestName?: string | null;
  guestTypeName?: string | null;
  guestCount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  securityCheckInStatus?: SecurityCheckInStatus | null;
  /** The group has left: the QR only shows it now. */
  isViewOnly?: boolean | null;
  canCheckOut?: boolean | null;
  checkIn?: GateRecordDto | null;
  checkOut?: GateRecordDto | null;
  /** Units that receive the guests. */
  workingUnits?: { workingUnitId?: string; workingUnitName?: string | null }[] | null;
  members?: GuestMemberDto[] | null;
};

/** A gate record: when (ISO, UTC), how many and the guard's note. */
export type GateRecord = { at: string; count: number | null; note: string | null };

/** A registered guest and where reception has them: when it checked them in and out (ISO, UTC; null when not). */
export type GuestMember = {
  id: string;
  name: string;
  position: string | null;
  identityNumber: string | null;
  /** Added on the day, beyond the registration. */
  extra: boolean;
  /** Marked as not come: reception expects nothing of them. */
  absent: boolean;
  receptionIn: string | null;
  receptionOut: string | null;
};

/** A guest visit registration, what a guest QR points to. */
export type GuestVisit = {
  id: string;
  /** The lookup link (the QR's own, or the guest back-end's for a bare code); the check-in posts to `{link}/check-in`. */
  link: string;
  /** Registration number, e.g. `AUTO1020260003`. */
  code?: string;
  /** "Khách hàng Malaysia - Đàm phán xe tải". */
  groupName: string;
  /** Registered number of guests. */
  guestCount: number;
  /** Working period of the visit (ISO, UTC; empty when the API gives none). */
  fromDate: string;
  toDate: string;
  /** Where the guests are received: the receiving units, "Công ty TNHH MTV Sản xuất và Lắp ráp xe tải THACO". */
  location?: string | null;
  /** The registered guests, with reception's records of them. */
  members: GuestMember[];
  /** Where the group stands at the gate. */
  status: GuestVisitStatus;
  /** Whether the guard may let the group out now (only while it is in). */
  canCheckOut: boolean;
  /** When it passed the gate in and out. */
  checkIn: GateRecord | null;
  checkOut: GateRecord | null;
};

/** `securityCheckInStatus` of the list: where the group stands at the gate. */
export enum SecurityCheckInStatus {
  /** Chờ bảo vệ xác nhận. */
  Pending = 0,
  /** Đã vào cổng. */
  CheckedIn = 1,
  /** Đã ra cổng. */
  CheckedOut = 2,
  /** Từ chối: no gate action. */
  Rejected = 3,
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

/** Where a visit stands at the gate: waiting for the guard, inside, gone, or turned away. */
export type GuestVisitStatus = 'pending' | 'checkedIn' | 'checkedOut' | 'rejected';

/** A tab of the list: every visit, one status, or `confirmed` (the guard has let them in: inside or gone). */
export type GuestVisitTab = 'all' | 'confirmed' | GuestVisitStatus;

/** A visit in the dashboard's "Lịch khách hôm nay" list. */
export type GuestScheduleItem = {
  id: string;
  /** Registration number, e.g. `AUTO1020260003`. */
  code?: string;
  /** The code the guests' QR holds, to look up the details. */
  qrToken?: string;
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

/** A gate step the guard confirms, in or out: when, how many and an optional note. */
export type GateInput = {
  /** ISO, UTC. */
  at: string;
  actualGuestCount: number;
  note?: string;
};

export type GatePass = GateInput & { visit: GuestVisit };

/**
 * What a failed lookup, check-in or check-out means for the guard: a wrong code, a visit over, or the group's gate
 * state forbidding the step (the API's own `errorCode`s).
 */
export type GuestErrorCode =
  | 'GUEST_QR_INVALID'
  | 'GUEST_VISIT_EXPIRED'
  | 'ALREADY_CHECKED_IN'
  | 'ALREADY_CHECKED_OUT'
  | 'CHECKIN_REQUIRED'
  | 'RECEPTION_CHECKIN_REQUIRED'
  | 'INVALID_SCHEDULE_STATE';

export class GuestError extends Error {
  readonly code: GuestErrorCode;

  constructor(code: GuestErrorCode) {
    super(code);
    this.name = 'GuestError';
    this.code = code;
  }
}
