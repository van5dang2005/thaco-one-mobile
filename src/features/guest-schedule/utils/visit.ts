import { diffDays, minutesOfDay, parseServerDate, toDateKey, todayKey } from '@/core/time/vn';

import type { GateRecord, GateRecordDto, GuestErrorCode, GuestScheduleDto, GuestVisit } from '../types';
import { statusOf } from './schedule';

/** The API link a guest QR holds: `…/api/GuestSchedules/mobile/qr/{code}` on a THACO server. */
const QR_LINK = /^https?:\/\/(?:[a-z0-9-]+\.)*thaco\.com\.vn\/api\/GuestSchedules\/mobile\/qr\/[^/?#\s]+/i;

/**
 * Where to look up a scanned QR. The QR holds the whole API link, which is called as it is rather than on this build's
 * guest back-end, only over HTTPS since iOS refuses plain HTTP. Any other link is no guest QR (the request carries the
 * user's token). A bare code, like a list's `qrToken`, goes to the guest back-end. Empty when there is nothing to call.
 */
export function qrLinkOf(text: string): string {
  const value = text.trim();
  if (/^https?:\/\//i.test(value)) return value.match(QR_LINK)?.[0].replace(/^http:/i, 'https:') ?? '';
  return value ? `/api/GuestSchedules/mobile/qr/${encodeURIComponent(value)}` : '';
}

/** A gate record of the response; null when it has no time. */
function toGateRecord(dto: GateRecordDto | null | undefined): GateRecord | null {
  if (!dto?.time) return null;
  return { at: dto.time, count: dto.actualAmount ?? null, note: dto.note?.trim() || null };
}

/** The visit in a lookup response; null when it holds none. A left group (`isViewOnly`) counts as gone whatever its status says. */
export function toVisit(dto: GuestScheduleDto | null | undefined, link: string): GuestVisit | null {
  if (!dto?.guestScheduleId) return null;
  const units = (dto.workingUnits ?? []).map((unit) => unit.workingUnitName?.trim()).filter(Boolean);
  return {
    id: dto.guestScheduleId,
    link,
    code: dto.guestCode?.trim() || undefined,
    groupName: dto.guestName?.trim() || dto.guestCode?.trim() || '',
    guestCount: Math.max(1, dto.guestCount ?? dto.members?.length ?? 1),
    fromDate: dto.startDate ?? '',
    toDate: dto.endDate ?? dto.startDate ?? '',
    location: units.length ? units.join(', ') : null,
    members: (dto.members ?? []).map((member) => member.fullName?.trim() ?? '').filter(Boolean),
    status: dto.isViewOnly ? 'checkedOut' : statusOf(dto.securityCheckInStatus),
    canCheckOut: !dto.isViewOnly && !!dto.canCheckOut,
    checkIn: toGateRecord(dto.checkIn),
    checkOut: toGateRecord(dto.checkOut),
  };
}

/** Where today falls in the visit's working period (Vietnam days). */
export type VisitPhase = { kind: 'upcoming' | 'ongoing' | 'ended'; /** 1-based day of the period. */ day: number; days: number };

export function visitPhase(visit: Pick<GuestVisit, 'fromDate' | 'toDate'>, now = new Date()): VisitPhase {
  const from = toDateKey(parseServerDate(visit.fromDate) ?? now);
  const to = toDateKey(parseServerDate(visit.toDate) ?? now);
  const today = todayKey(now);
  const days = Math.max(1, diffDays(from, to) + 1);
  const day = diffDays(from, today) + 1;
  return { kind: day < 1 ? 'upcoming' : day > days ? 'ended' : 'ongoing', day, days };
}

/** What the guard can do with the group now: let it in, let it out, or only look (gone, turned away, or waiting on reception). */
export type GateMode = 'in' | 'out' | 'view';

export function gateModeOf(visit: Pick<GuestVisit, 'status' | 'canCheckOut'>): GateMode {
  if (visit.status === 'pending') return 'in';
  return visit.status === 'checkedIn' && visit.canCheckOut ? 'out' : 'view';
}

/** Why a group may not be let out right now, as the API would say it. */
export function checkOutBlocker(visit: Pick<GuestVisit, 'status'>): GuestErrorCode {
  if (visit.status === 'checkedOut') return 'ALREADY_CHECKED_OUT';
  if (visit.status === 'pending') return 'CHECKIN_REQUIRED';
  return visit.status === 'rejected' ? 'INVALID_SCHEDULE_STATE' : 'RECEPTION_CHECKIN_REQUIRED';
}

/** Office hours on the server's clock, Vietnam time, every day: 08:00 included, 17:00 already after hours. */
export const OFFICE_HOURS = { from: 8 * 60, to: 17 * 60 };

export function isOfficeHours(now = new Date()): boolean {
  const minutes = minutesOfDay(now);
  return minutes >= OFFICE_HOURS.from && minutes < OFFICE_HOURS.to;
}
