import type { ServiceId } from '@/core/api/ApiError';
import { services } from '@/core/api/clients';
import { fetchWithTimeout } from '@/core/api/fetchWithTimeout';
import { buildUrl } from '@/core/api/http';
import { env } from '@/core/config/env';

import type { SsoAccount } from './sso';

/** An application the THACO apps portal grants the user (`GET /api/Application/my-apps`). */
export type MyApp = {
  id: string;
  /** Stable key: `PARCEL_MANAGEMENT_WEB`, `BOOKING_ROOM_WEB`, `VANTHU`, `ESIGN_WEB`… */
  code: string;
  name: string;
  description?: string | null;
  /** Absolute image URL (png / jpg / svg). */
  icon?: string | null;
  /** The web app. */
  url?: string | null;
  backendUrl?: string | null;
  displayOrder?: number | null;
  isActive?: boolean | null;
  isPublished?: boolean | null;
  categoryName?: string | null;
  category?: { id: string; code: string; name: string; displayOrder?: number | null } | null;
};

type MyAppsReply = { data?: MyApp[] | null; success?: boolean; message?: string | null };

/** Portal code of each back-end this app has screens for: the app calls a back-end only while `my-apps` lists its code. */
export const serviceAppCodes: Record<ServiceId, string> = { parcel: 'PARCEL_MANAGEMENT_WEB', room: 'BOOKING_ROOM_WEB' };

/** Portal apps Home never shows: the E-sign test builds (`ESIGN LOCAL` at localhost, `… (UAT)`). */
export const hiddenAppCodes: ReadonlySet<string> = new Set(['ESIGN_LOCAL', 'ESIGN_WEB_UAT']);

/**
 * Back-ends the portal grants; none while its list is unknown (`null`). A back-end the user lacks answers
 * 401 to every call, each one costing a token refresh.
 */
export function grantedServices(apps: readonly Pick<MyApp, 'code'>[] | null): Record<ServiceId, boolean> {
  const codes = new Set((apps ?? []).map((app) => app.code));
  return Object.fromEntries(services.map((service) => [service, codes.has(serviceAppCodes[service])])) as Record<ServiceId, boolean>;
}

/** Portal order: by `displayOrder` (unset last), ties as listed. */
export function sortApps<T extends Pick<MyApp, 'displayOrder'>>(apps: readonly T[]): T[] {
  const rank = (app: T) => app.displayOrder ?? Number.POSITIVE_INFINITY;
  return apps
    .map((app, index) => ({ app, index }))
    .sort((a, b) => rank(a.app) - rank(b.app) || a.index - b.index)
    .map(({ app }) => app);
}

/** Active apps of the SSO account; the portal keys them on the Keycloak id, username (MSNV) and email. */
export async function fetchMyApps(account: SsoAccount): Promise<MyApp[]> {
  const url = buildUrl(env.appsApiUrl, '/api/Application/my-apps', {
    id: account.id ?? '',
    username: account.username ?? '',
    email: account.email ?? '',
    isActive: true,
  });
  const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, env.requestTimeoutMs);
  const reply = (await response.json().catch(() => null)) as MyAppsReply | null;
  if (!response.ok || !reply || reply.success === false || !Array.isArray(reply.data)) {
    throw new Error(`MY_APPS_${response.status}${reply?.message ? `: ${reply.message}` : ''}`);
  }
  return reply.data.filter((app) => typeof app?.code === 'string');
}
