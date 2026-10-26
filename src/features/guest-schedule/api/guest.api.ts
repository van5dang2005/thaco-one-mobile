import { isApiError } from '@/core/api/ApiError';
import { guestScheduleApi } from '@/core/api/clients';

import {
  type GateInput,
  type GatePass,
  GuestError,
  type GuestErrorCode,
  type GuestScheduleDto,
  type GuestScheduleFilter,
  type GuestSchedulePage,
  type GuestSchedulePageDto,
  type GuestVisit,
} from '../types';
import { scheduleQuery, toSchedulePage } from '../utils/schedule';
import { qrLinkOf, toVisit } from '../utils/visit';

/** The API's `errorCode`s about the group's gate state, kept as they are. */
const gateCodes = new Set<string>(['ALREADY_CHECKED_IN', 'ALREADY_CHECKED_OUT', 'CHECKIN_REQUIRED', 'RECEPTION_CHECKIN_REQUIRED', 'INVALID_SCHEDULE_STATE']);

/**
 * A wrong code, an ended visit or a gate step the group's state forbids, as the guard should read it; anything else
 * (network, server, rights) stays as thrown. Goes by the documented `errorCode`s (the token's 404 has none), then by
 * status and wording. "Invalid" wording only means a wrong code on the lookup: on a gate step it may be about the form.
 */
function asGuestError(error: unknown, step: 'lookup' | 'gate'): unknown {
  if (!isApiError(error)) return error;
  if (gateCodes.has(error.errorCode)) return new GuestError(error.errorCode as GuestErrorCode);
  if (error.errorCode === 'SECURITY_CHECKIN_EXPIRED') return new GuestError('GUEST_VISIT_EXPIRED');
  if (error.errorCode === 'DATA_NOT_FOUND') return new GuestError('GUEST_QR_INVALID');
  const said = `${error.errorCode} ${error.message}`.toLowerCase();
  if (/expired|hết hạn|đã kết thúc/.test(said)) return new GuestError('GUEST_VISIT_EXPIRED');
  if (error.status === 404 || (step === 'lookup' && /not_?found|invalid|không tìm thấy|không hợp lệ/.test(said))) return new GuestError('GUEST_QR_INVALID');
  return error;
}

/** A gate step for the visit the QR link points to, with the time (UTC, as the API returns its own), head count and note. */
async function passGate(step: 'check-in' | 'check-out', input: GateInput, visit: GuestVisit): Promise<GatePass> {
  try {
    await guestScheduleApi.post<unknown>(`${visit.link}/${step}`, { time: input.at, actualAmount: input.actualGuestCount, note: input.note });
  } catch (error) {
    throw asGuestError(error, 'gate');
  }
  return { ...input, visit };
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

  /** Records the group passing the gate in: `POST …/mobile/qr/{code}/check-in` with `{ time, actualAmount, note }`. */
  checkIn(input: GateInput, visit: GuestVisit): Promise<GatePass> {
    return passGate('check-in', input, visit);
  },

  /**
   * Records the group leaving: `POST …/mobile/qr/{code}/check-out`, same body. Only while the lookup says
   * `canCheckOut`; the server also checks out of reception every guest it has not (and, the other way round, closes the
   * gate itself once reception has checked out everyone present).
   */
  checkOut(input: GateInput, visit: GuestVisit): Promise<GatePass> {
    return passGate('check-out', input, visit);
  },
};
