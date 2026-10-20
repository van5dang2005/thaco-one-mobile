import type { Href } from 'expo-router';

import type { ServiceId } from '@/core/api/ApiError';
import type vi from '@/core/i18n/locales/vi';
import type { Capability } from '@/core/session/capabilities';
import { type AppIcon, CalendarCheckIcon, InboxIcon, PackageIcon, ScrollTextIcon, UsersIcon } from '@/shared/ui/icons';

import {
  type Signal,
  useDocumentsPending,
  useDocumentsSummary,
  useFreeRoomsSummary,
  useParcelSummary,
  useReceptionSummary,
  useWaitingParcels,
} from './hooks/useSignals';

/** "Theo nhóm" card and icon tone: one per app with screens here, `other` for the apps that open on the web. */
export type ModuleGroup = 'meeting' | 'parcel' | 'guest' | 'document' | 'other';

/** Key under `home.modules` in the locale files. */
export type ModuleLabelKey = keyof (typeof vi)['home']['modules'];

/**
 * Who may see a module. `service`: the back-end the THACO apps portal must grant (`my-apps`). `capability`:
 * a server-side permission (see `useCapabilities`; per-resource flags from `my-permissions` are
 * Administrator-only on these back-ends, so they cannot be read for regular staff). `app`: the portal code
 * of an app whose tiles need no back-end here (yet).
 */
export type ModulePermission =
  | { service: ServiceId; capability?: Capability; app?: never }
  | { app: string; service?: never; capability?: never };

/** A locale key for a tile with screens here; the portal's name (`title`) for an app that opens on the web. */
type ModuleLabel =
  | {
      labelKey: ModuleLabelKey;
      /** Shorter label for the 4-column "Theo nhóm" layout. */
      shortLabelKey?: ModuleLabelKey;
      title?: never;
      shortTitle?: never;
    }
  | {
      title: string;
      /** `title` without the "Phần mềm" / "PM" lead, for the 4-column grids. */
      shortTitle?: string;
      labelKey?: never;
      shortLabelKey?: never;
    };

export type HomeModule = ModuleLabel & {
  id: string;
  group: ModuleGroup;
  icon: AppIcon;
  /** Portal image (`MyApp.icon`), shown instead of `icon` unless it fails to load. */
  iconUrl?: string;
  /** Portal description (`MyApp.description`): the "Thẻ" layout's second line for an app without a `summary`. */
  description?: string;
  /** Screen inside the app. */
  route?: Href;
  /** Runs before navigating to `route` (e.g. start a fresh booking draft). */
  onBeforeOpen?: () => void;
  /** Another app or a web page. Falls back to `storeUrl` when it cannot be opened. Shows the ↗ marker. */
  externalUrl?: string;
  storeUrl?: { ios: string; android: string };
  /** `externalUrl` opens a phone app (or its store page), not a web app in the browser. */
  opensApp?: boolean;
  /** Hidden when the user may not use it. */
  permission?: ModulePermission;
  /** Hook: red count on the icon. */
  badge?: () => Signal<number>;
  /** Hook: one-line summary for the "Thẻ" layout. */
  summary?: () => Signal<string>;
  /** "Thẻ" layout: a non-zero badge marks the card as needing action (red border and summary). */
  urgentWhenBadged?: boolean;
};

/**
 * Tiles of the apps with screens here, in display order. Home shows the tiles of each back-end the portal
 * grants (`appModules`); any other granted app gets one tile that opens it on the web. Add a tile by
 * appending an entry: every layout, the permission filter, badges and summaries pick it up.
 *
 * The array must stay a constant: `useModuleSignals` calls each module's hooks in this order.
 */
export const nativeModules: readonly HomeModule[] = [
  {
    // One tile for room booking: the room calendar books (quick book, tap a free slot) and opens bookings;
    // "Lịch họp" is the Calendar tab. Keeps the old id so a saved tile order still places it.
    id: 'book-room',
    group: 'meeting',
    labelKey: 'bookRoom',
    shortLabelKey: 'bookRoomShort',
    icon: CalendarCheckIcon,
    route: '/rooms',
    permission: { service: 'room' },
    summary: useFreeRoomsSummary,
  },
  {
    id: 'parcels',
    group: 'parcel',
    labelKey: 'parcels',
    icon: PackageIcon,
    route: '/parcels',
    permission: { service: 'parcel' },
    badge: useWaitingParcels,
    summary: useParcelSummary,
    urgentWhenBadged: true,
  },
  {
    id: 'reception',
    group: 'parcel',
    labelKey: 'reception',
    shortLabelKey: 'receptionShort',
    icon: InboxIcon,
    route: '/parcels/reception',
    permission: { service: 'parcel', capability: 'parcel.reception' },
    summary: useReceptionSummary,
  },
  {
    // The dashboard opens the QR scanner ("Quét mã QR"). Keeps the old id so a saved tile order still places it.
    id: 'guest-scan',
    group: 'guest',
    labelKey: 'guests',
    shortLabelKey: 'guestsShort',
    icon: UsersIcon,
    route: '/guests',
    permission: { app: 'GUEST_SCHEDULE_MANAGEMENT_WEB' },
  },
  {
    id: 'official-documents',
    group: 'document',
    labelKey: 'officialDocuments',
    icon: ScrollTextIcon,
    route: '/documents',
    // Served by thaco_be_ql_van_thu (`documentApi`), which accepts the same SSO token.
    permission: { app: 'VANTHU' },
    badge: useDocumentsPending,
    summary: useDocumentsSummary,
    urgentWhenBadged: true,
  },
];
