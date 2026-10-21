import type { Href } from 'expo-router';
import type { TFunction } from 'i18next';

import { documentApi } from '@/core/api/clients';
import i18n from '@/core/i18n';
import { qk } from '@/core/query/keys';
import type { AppNotification, NotificationLook, NotificationSource } from '@/features/notification/types';
import {
  BellIcon,
  FileCheckIcon,
  FileTextIcon,
  FileXIcon,
  ForwardIcon,
  InboxIcon,
  ScrollTextIcon,
  Share2Icon,
  SignatureIcon,
  Undo2Icon,
} from '@/shared/ui/icons';

import type { ThongBaoDto } from '../api/dto';
import { officialDocumentApi } from '../api/officialDocument.api';
import { vtInstant } from './mapping';

/** `ReceiveNotification` of `/hubs/notification`: `ThongBaoViewModel` in PascalCase (the hub keeps C# names). */
type ThongBaoPayload = {
  Id?: string | null;
  Loai?: string | null;
  TieuDe?: string | null;
  NoiDung?: string | null;
  RefId?: string | null;
  RefUrl?: string | null;
  DaDoc?: boolean;
  CreatedDate?: string | null;
};

/** What a Văn thư notification points at: its `loai` (VANTHU.md 4), the document id and the web route. */
type DocRef = { loai?: string | null; refId?: string | null; refUrl?: string | null };

const EMPTY_ID = '00000000-0000-0000-0000-000000000000';

/** Action part of a `loai`: `VanBanDen_TraLai` → `TraLai` (the module part only changes the noun). */
const actionOf = (loai: string | null | undefined) => loai?.split('_')[1] ?? '';

/** `loai` actions with a title of their own (`notifications.document.*`). */
const TITLED = [
  'ChiaSe',
  'DieuChinhChiaSe',
  'GoChiaSe',
  'ThuHoi',
  'Huy',
  'BoHuy',
  'ChuyenPhanPhoi',
  'GoPhanPhoi',
  'PhanPhoiXuLy',
  'TraLai',
  'HoanTat',
  'HuyPhanPhoiXuLy',
  'TuEsign',
] as const;

const isTitled = (action: string): action is (typeof TITLED)[number] => (TITLED as readonly string[]).includes(action);

/** Short title of a `loai`; the back-end leaves `tieuDe` empty and puts the whole sentence in `noiDung`. */
export function documentNotificationTitle(loai: string | null | undefined, t: TFunction = i18n.t): string {
  const action = actionOf(loai);
  return isTitled(action) ? t(`notifications.document.${action}`) : t('notifications.document.default');
}

/**
 * Screen a notification opens. An empty `refUrl` means the document is gone for me (revoked, cancelled, removed from
 * the list): not openable. Incoming documents open their detail, shared outgoing / internal ones theirs; E-sign
 * documents waiting to be registered or stamped have no mobile screen, so they open the Văn thư home.
 */
export function documentHref({ loai, refId, refUrl }: DocRef): Href | null {
  if (!refUrl?.trim()) return null;
  const id = refId && refId !== EMPTY_ID ? refId : null;
  const kind = loai?.split('_')[0] ?? '';
  if (actionOf(loai) === 'TuEsign') return '/documents';
  const incoming = kind === 'VanBanDen' || (!kind && refUrl.includes('/van-ban-den'));
  const shared = kind === 'VanBanDi' || kind === 'VanBanNoiBo' || (!kind && /\/van-ban-(di|noi-bo)\b/.test(refUrl));
  if (id && incoming) return { pathname: '/documents/incoming/[id]', params: { id } };
  if (id && shared) return { pathname: '/documents/shared/[id]', params: { id } };
  return '/documents';
}

/** Glyph and tone of each `loai` (CLAUDE.md §5): to do = wait / warn, returned = danger, done = ok, gone = off. */
export function documentLook({ type }: Pick<AppNotification, 'type'>): NotificationLook {
  switch (actionOf(type)) {
    case 'ChiaSe':
    case 'DieuChinhChiaSe':
      return { icon: Share2Icon, tone: 'wait' };
    case 'ChuyenPhanPhoi':
      return { icon: ForwardIcon, tone: 'wait' };
    case 'PhanPhoiXuLy':
      return { icon: InboxIcon, tone: 'warn' };
    case 'TraLai':
      return { icon: Undo2Icon, tone: 'danger' };
    case 'HoanTat':
    case 'BoHuy':
      return { icon: FileCheckIcon, tone: 'ok' };
    case 'TuEsign':
      return { icon: SignatureIcon, tone: 'warn' };
    case 'GoChiaSe':
    case 'GoPhanPhoi':
    case 'ThuHoi':
    case 'Huy':
    case 'HuyPhanPhoiXuLy':
      return { icon: FileXIcon, tone: 'off' };
    default:
      return { icon: type ? FileTextIcon : BellIcon, tone: 'wait' };
  }
}

export function toDocumentNotification(dto: ThongBaoDto): AppNotification {
  return {
    id: dto.id,
    title: dto.tieuDe?.trim() || documentNotificationTitle(dto.loai),
    body: dto.noiDung?.trim() || null,
    type: dto.loai ?? null,
    isRead: !!dto.daDoc,
    createdAt: vtInstant(dto.createdDate)?.toISOString() ?? null,
    href: documentHref(dto),
  };
}

const text = (value: unknown) => (typeof value === 'string' ? value : null);

/**
 * Văn thư notifications (`/api/ThongBao`, VANTHU.md 1.3 and 4). Not the shared template: its own routes, the
 * `{ success, data }` wrapper, Vietnam times and the `/hubs/notification` hub. The back-end returns the latest 50
 * in one page and cannot delete, so the screen hides delete.
 */
export const documentNotificationSource: NotificationSource = {
  id: 'vanthu',
  label: (t) => t('notifications.tabDocument'),
  name: (t) => t('services.document'),
  icon: ScrollTextIcon,
  accent: 'document',
  appearance: documentLook,
  enabled: (session) => !!session.apps?.some((app) => app.code === 'VANTHU'),

  list: async () => ({ items: (await officialDocumentApi.notifications()).map(toDocumentNotification), nextPage: undefined }),
  unreadCount: officialDocumentApi.unreadNotifications,
  markRead: officialDocumentApi.markNotificationRead,
  markAllRead: officialDocumentApi.markAllNotificationsRead,

  refreshKeys: [qk.documents.root],
  hrefForPush: (data) => documentHref({ loai: text(data.loai), refId: text(data.refId), refUrl: text(data.refUrl) ?? '/' }),
  realtime: {
    hubUrl: `${documentApi.baseUrl}/hubs/notification`,
    parse: (payload) => {
      const p = payload as ThongBaoPayload;
      return {
        title: p.TieuDe?.trim() || documentNotificationTitle(p.Loai),
        body: p.NoiDung?.trim() || null,
        href: documentHref({ loai: p.Loai, refId: p.RefId, refUrl: p.RefUrl }),
      };
    },
  },
};
