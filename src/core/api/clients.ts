import { env } from '@/core/config/env';

import type { ServiceId } from './ApiError';
import { type ApiClient, createApiClient } from './http';

/** thaco_be_ql_buu_pham — parcels, reception. */
export const parcelApi = createApiClient('parcel', env.parcelApiUrl);

/** thaco_be_ql_phong_hop — rooms, bookings, approvals. */
export const roomApi = createApiClient('room', env.roomApiUrl);

/**
 * Guest-schedule back-end: gate check-in by QR. Not in `clients`: it answers only the guest calls, so the
 * per-service code (users/me, notifications, hubs) never reaches it.
 */
export const guestScheduleApi = createApiClient('guest', env.guestApiUrl);

const clients: Record<ServiceId, ApiClient> = { parcel: parcelApi, room: roomApi };

export const apiFor = (service: ServiceId) => clients[service];

/** Every back-end, for code that runs once per service (users/me, push tokens). */
export const services = Object.keys(clients) as ServiceId[];
