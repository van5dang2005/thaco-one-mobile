import { isApiError } from '@/core/api/ApiError';
import { guestScheduleApi } from '@/core/api/clients';

import {
  type GuestCheckIn,
  type GuestCheckInInput,
  GuestError,
  type GuestScheduleDto,
  type GuestScheduleFilter,
  type GuestSchedulePage,
  type GuestSchedulePageDto,
  type GuestVisit,
} from '../types';
import { scheduleQuery, toSchedulePage } from '../utils/schedule';
import { qrLinkOf, toVisit } from '../utils/visit';

/**
 * A wrong or ended visit as the guard should read it; anything else (network, server, rights) stays as thrown.
 * The API has no documented error codes yet, so this goes by status and wording. "Invalid" wording only means a
 * wrong code on the lookup: on check-in it may be about the form (head count, time).
 */
function asGuestError(error: unknown, step: 'lookup' | 'checkIn'): unknown {
  if (!isApiError(error)) return error;
  const said = `${error.errorCode} ${error.message}`.toLowerCase();
  if (/expired|hết hạn|đã kết thúc/.test(said)) return new GuestError('GUEST_VISIT_EXPIRED');
  if (error.status === 404 || (step === 'lookup' && /not_?found|invalid|không tìm thấy|không hợp lệ/.test(said))) return new GuestError('GUEST_QR_INVALID');
  return error;
}

export const guestApi = {
  /** A page of the day's visits under a tab, with the counters of the whole day: `GET /api/security/guest-schedules/mobile`. */
  async schedules(filter: GuestScheduleFilter, pageNumber: number): Promise<GuestSchedulePage> {
    const page = await guestScheduleApi.get<GuestSchedulePageDto>('/api/security/guest-schedules/mobile', { query: scheduleQuery(filter, pageNumber) });
    return toSchedulePage(page);
  },

  /** The visit a scanned QR (its link) or a list's `qrToken` points to: `GET …/mobile/qr/{code}`. */
  async lookup(qr: string): Promise<GuestVisit> {
    const link = qrLinkOf(qr);
    if (!link) throw new GuestError('GUEST_QR_INVALID');
    let dto: GuestScheduleDto | null;
    try {
      dto = await guestScheduleApi.get<GuestScheduleDto | null>(link);
    } catch (error) {
      throw asGuestError(error, 'lookup');
    }
    const visit = toVisit(dto, link);
    if (!visit) throw new GuestError('GUEST_QR_INVALID');
    return visit;
  },

  /** Records the group passing the gate: `POST …/mobile/qr/{code}/check-in` with `{ time, actualAmount, note }`. */
  async checkIn(input: GuestCheckInInput, visit: GuestVisit): Promise<GuestCheckIn> {
    try {
      await guestScheduleApi.post<unknown>(`${visit.link}/check-in`, {
        // UTC, as the API returns its own times.
        time: input.checkInAt,
        actualAmount: input.actualGuestCount,
        note: input.note,
      });
    } catch (error) {
      throw asGuestError(error, 'checkIn');
    }
    return { ...input, visit };
  },
};
