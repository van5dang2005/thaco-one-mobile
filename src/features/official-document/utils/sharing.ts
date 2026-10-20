import type { SharePermissions } from '../types';

export type Permission = keyof SharePermissions;

export const PERMISSIONS: readonly Permission[] = ['xem', 'tai', 'chiaSe'];

export const NO_PERMISSIONS: SharePermissions = { xem: false, tai: false, chiaSe: false };

/** What a new recipient starts with. */
export const DEFAULT_GRANT: SharePermissions = { xem: true, tai: false, chiaSe: false };

/** Download or re-share implies view (`VanBan_ChiaSe`: any flag lets the recipient open it). */
export function normalize(p: SharePermissions): SharePermissions {
  return { ...p, xem: p.xem || p.tai || p.chiaSe };
}

/**
 * The ceiling of what I may hand on: the back-end's `grantablePermissions`, or what I hold myself until it is
 * known. Holding download or re-share counts as holding view.
 */
export function grantable(mine: SharePermissions): SharePermissions {
  return normalize(mine);
}

/** A permission row's lock: not grantable, or view while download / re-share keep it on. */
export function isLocked(current: SharePermissions, key: Permission, mine: SharePermissions) {
  if (!grantable(mine)[key]) return true;
  return key === 'xem' && (current.tai || current.chiaSe);
}

/** Flips one permission of a recipient within my ceiling; turning on download or re-share also turns on view. */
export function toggleGrant(current: SharePermissions, key: Permission, mine: SharePermissions): SharePermissions {
  if (isLocked(current, key, mine)) return current;
  return normalize({ ...current, [key]: !current[key] });
}

export function grantedList(p: SharePermissions): Permission[] {
  return PERMISSIONS.filter((key) => p[key]);
}
