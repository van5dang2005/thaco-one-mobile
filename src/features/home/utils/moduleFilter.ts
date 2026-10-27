import { Platform } from 'react-native';

import type { ServiceId } from '@/core/api/ApiError';
import { env, type PhoneApp } from '@/core/config/env';
import type { Capability } from '@/core/session/capabilities';
import { type MyApp, serviceAppCodes, sortApps } from '@/core/session/myApps';
import { AppWindowIcon } from '@/shared/ui/icons';

import type { HomeModule, ModuleGroup } from '../modules';

export type AccessContext = {
  connected: Record<ServiceId, boolean>;
  has: (capability: Capability) => boolean;
};

export function canSeeModule(module: Pick<HomeModule, 'permission'>, ctx: AccessContext) {
  const permission = module.permission;
  if (!permission) return true;
  // Listed only while the portal grants the app (`appModules`).
  if (permission.app !== undefined) return true;
  if (!ctx.connected[permission.service]) return false;
  return !permission.capability || ctx.has(permission.capability);
}

/** Modules the user may see, in config order. */
export function filterModules<M extends Pick<HomeModule, 'permission'>>(modules: readonly M[], ctx: AccessContext): M[] {
  return modules.filter((module) => canSeeModule(module, ctx));
}

/** Portal names lead with the kind of thing ("Phần mềm Quản lý bưu phẩm", "PM Văn Thư"). */
const SOFTWARE_LEAD = /^(phần\s+mềm|pm)\s+/i;

/** `name` without its "Phần mềm" / "PM" lead, first letter raised: "Văn Thư"; `name` itself when nothing is left. */
export function shortAppName(name: string) {
  const short = name.replace(SOFTWARE_LEAD, '').trim();
  return short ? short.charAt(0).toUpperCase() + short.slice(1) : name;
}

type Os = 'ios' | 'android';

/**
 * Where the tile of the phone app `env.phoneApps` names for portal `code` goes on `os`: its link (on Android, its
 * package), with the store page to offer when that fails; or the store page itself when the app has neither there.
 * `null`: not a phone app.
 */
export function phoneAppLink(
  code: string,
  os: Os,
  apps: Record<string, PhoneApp> = env.phoneApps,
): Pick<HomeModule, 'externalUrl' | 'storeUrl' | 'androidPackage'> | null {
  const app = apps[code];
  const url = app?.url[os].trim();
  const store = app?.storeUrl[os].trim();
  const androidPackage = os === 'android' ? app?.androidPackage : undefined;
  if (!url && !androidPackage) return store ? { externalUrl: store } : null;
  return { externalUrl: url || store, storeUrl: store ? app.storeUrl : undefined, androidPackage };
}

/**
 * Tile of a granted app without screens here, under the portal's name and icon, that opens its phone app
 * (`env.phoneApps`: E-sign, Paytime); `null` for any other app, which Home leaves out.
 */
export function phoneModule(app: MyApp, os: Os = Platform.OS === 'ios' ? 'ios' : 'android'): HomeModule | null {
  const target = phoneAppLink(app.code, os);
  if (!target) return null;
  const title = app.name?.trim() || app.code;
  return {
    id: `app:${app.code}`,
    group: 'other',
    title,
    shortTitle: shortAppName(title),
    icon: AppWindowIcon,
    iconUrl: app.icon?.trim() || undefined,
    description: app.description?.trim() || undefined,
    ...target,
    opensApp: true,
  };
}

/**
 * Home tiles of the portal's `apps`: the `native` tiles of each app with screens here, in portal order, then a
 * `phoneModule` for each phone app; every other app gets no tile. An app listed twice counts once.
 */
export function appModules(apps: readonly MyApp[] | null, native: readonly HomeModule[]): HomeModule[] {
  const seen = new Set<string>();
  const own: HomeModule[] = [];
  const phone: HomeModule[] = [];
  for (const app of sortApps(apps ?? [])) {
    if (seen.has(app.code)) continue;
    seen.add(app.code);
    const tiles = native.filter((module) => portalCode(module) === app.code);
    const tile = tiles.length ? null : phoneModule(app);
    own.push(...tiles);
    if (tile) phone.push(tile);
  }
  return [...own, ...phone];
}

/** Portal code of the app that grants a tile with screens here. */
function portalCode({ permission }: Pick<HomeModule, 'permission'>) {
  if (!permission) return undefined;
  return permission.app ?? serviceAppCodes[permission.service];
}

/** Non-empty groups in the order of their first module, each keeping the order of its modules. */
export function groupModules<M extends Pick<HomeModule, 'group'>>(modules: readonly M[]) {
  const groups = new Map<ModuleGroup, M[]>();
  modules.forEach((module) => groups.set(module.group, [...(groups.get(module.group) ?? []), module]));
  return Array.from(groups, ([group, items]) => ({ group, modules: items }));
}
