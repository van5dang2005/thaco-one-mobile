import { diffDays, parseServerDate, toDateKey, todayKey } from '@/core/time/vn';

import type { GuestScheduleDto, GuestVisit } from '../types';

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

/** The visit in a lookup response; null when it holds none. */
export function toVisit(dto: GuestScheduleDto | null | undefined, link: string): GuestVisit | null {
  if (!dto?.guestScheduleId) return null;
  const units = (dto.workingUnits ?? []).map((unit) => unit.workingUnitName?.trim()).filter(Boolean);
  return {
    id: dto.guestScheduleId,
    link,
    code: dto.guestCode?.trim() || undefined,
    groupName: dto.guestName?.trim() || dto.guestCode?.trim() || '',
    purpose: dto.purpose?.trim() || null,
    guestCount: Math.max(1, dto.guestCount ?? dto.members?.length ?? 1),
    fromDate: dto.startDate ?? '',
    toDate: dto.endDate ?? dto.startDate ?? '',
    location: units.length ? units.join(', ') : null,
    members: (dto.members ?? []).map((member) => member.fullName?.trim() ?? '').filter(Boolean),
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
