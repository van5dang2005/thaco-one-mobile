import { ApiError } from '@/core/api/ApiError';
import { documentApi } from '@/core/api/clients';
import type { Query } from '@/core/api/http';
import { addDays, todayKey, type DateKey } from '@/core/time/vn';

import type { AssignInput, DocPerson, DocTask, IncomingDoc, ShareOptions, ShareRecipient, SharedDoc, StampDoc } from '../types';
import {
  incomingDetail,
  incomingFromRow,
  isStampable,
  isTaskItem,
  personFromStaff,
  personFromThanhPhan,
  shareOptions,
  shareRow,
  sharedDetail,
  sharedFromRow,
  stampFromRow,
  taskFromItem,
  vtDateKey,
} from '../utils/mapping';
import type {
  CongViecCalendarDto,
  CongViecDetailDto,
  NhanVienDto,
  TepTinDto,
  ThanhPhanDto,
  ThanhPhanResponseDto,
  UserInfoDto,
  VanBanDenDto,
  VanBanDenEntityDto,
  VanBanDto,
  VanBanEntityDto,
  VtPage,
  VtReply,
} from './dto';

/**
 * Văn thư calls (`thaco_be_ql_van_thu`, VANTHU.md), the same the web app makes. Lists need both ends of a date
 * range (one missing returns nothing): open incoming work and shared documents go back a year, processed
 * incoming documents a month (the screens show no older history), the stamp queue three months.
 */

const OPEN_DAYS = 365;
const HISTORY_DAYS = 30;
const STAMP_DAYS = 90;
const PAGE_SIZE = 100;
/** A list stops after this many pages; older rows are left to the web app. */
const MAX_PAGES = 10;
const NOT_FOUND = 'Không tìm thấy văn bản hoặc bạn không còn quyền xem.';

/** Unwraps `{ success, message, data }`; a refusal sent with 200 becomes an error carrying its sentence. */
function unwrap<T>(reply: VtReply<T> | undefined, path: string): T {
  if (reply?.success === false) throw new ApiError({ service: 'document', status: 400, errorCode: 'HTTP_400', message: reply.message?.trim() || path });
  return reply?.data as T;
}

const get = async <T>(path: string, query?: Query) => unwrap(await documentApi.get<VtReply<T>>(path, { query }), path);
const post = async <T>(path: string, body?: unknown, query?: Query) => unwrap(await documentApi.post<VtReply<T>>(path, body, { query }), path);

/** Every page of a list, the later ones in parallel. */
async function allPages<T>(path: string, query: Query): Promise<T[]> {
  const first = await get<VtPage<T> | null>(path, { ...query, page: 1, pageSize: PAGE_SIZE });
  const pages = Math.min(first?.totalPage ?? 1, MAX_PAGES);
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => get<VtPage<T> | null>(path, { ...query, page: i + 2, pageSize: PAGE_SIZE })));
  return [first, ...rest].flatMap((page) => page?.items ?? []);
}

/** `tuNgay` / `denNgay` (received date, compared with time) covering whole days. */
const receivedBetween = (from: DateKey, to: DateKey) => ({ tuNgay: from, denNgay: `${to}T23:59:59` });

/**
 * My tasks and the documents waiting for me to distribute: all of them, or with `Thang` (`yyyy-MM`) those whose bar
 * (distribution day to deadline) touches that month, as the web calendar asks.
 */
const calendar = async (Thang?: string) => (await get<CongViecCalendarDto | null>('/api/VanBanDen/CongViec/Calendar', { Thang }))?.items ?? [];

/** Incoming documents I distribute, created, were shared or have a role in, received between the two days. */
const incomingRows = (TrangThai: number, from: DateKey, to: DateKey) =>
  allPages<VanBanDenDto>('/api/VanBanDen', { chiDuocChiaSe: true, TrangThai, ...receivedBetween(from, to) });

/** Registered outgoing (2) / internal (3) documents filed between the two days; `mine`: only those shared with me. */
const registered = (loai: 2 | 3, from: DateKey, to: DateKey, mine: boolean) =>
  allPages<VanBanDto>('/api/VanBan/VaoSo', { loai, chiDuocChiaSe: mine, fromDate: from, toDate: to });

export const officialDocumentApi = {
  /**
   * The signed-in staff member: `GET /api/User/Info`, then their HRM record (`GET /api/NhanVien?keyword=` by
   * MSNV, the account's user name) for the id the processing teams use and the unit line.
   */
  async me(): Promise<DocPerson> {
    const info = await get<UserInfoDto>('/api/User/Info');
    const code = info.userName?.trim() ?? '';
    const staff = code
      ? await get<VtPage<NhanVienDto> | null>('/api/NhanVien', { keyword: code, pageSize: 20 })
          .then((page) => page?.items?.find((row) => row.maNhanVien?.trim().toLowerCase() === code.toLowerCase()))
          .catch(() => undefined)
      : undefined;
    if (staff) return personFromStaff(staff);
    return { id: '', name: info.fullName?.trim() || code, code, unit: '' };
  },

  /**
   * `GET /api/VanBanDen?chiDuocChiaSe=true`: waiting and in-progress documents of the last year, everything of the
   * last month; my role on each comes from the task calendar.
   */
  async incoming(): Promise<IncomingDoc[]> {
    const today = todayKey();
    const [waiting, processing, recent, items] = await Promise.all([
      incomingRows(1, addDays(today, -OPEN_DAYS), today),
      incomingRows(2, addDays(today, -OPEN_DAYS), today),
      incomingRows(0, addDays(today, -HISTORY_DAYS), today),
      calendar(),
    ]);
    const tasks = new Map(items.filter(isTaskItem).map((item) => [item.vanBanDenId, item]));
    const rows = new Map([...waiting, ...processing, ...recent].map((row) => [row.id, row]));
    return [...rows.values()].map((row) => incomingFromRow(row, tasks.get(row.id)));
  },

  /**
   * One incoming document, fresh: the stored record (`GET /api/VanBanDen/{id}`), its row in my list for that
   * day (rights, names), its files, and my task's team when I am in it.
   */
  async incomingDetail(id: string): Promise<IncomingDoc> {
    const entity = await get<VanBanDenEntityDto>(`/api/VanBanDen/${id}`);
    const day = vtDateKey(entity.ngayNhan) ?? todayKey();
    const [rows, files, items] = await Promise.all([
      allPages<VanBanDenDto>('/api/VanBanDen', { chiDuocChiaSe: true, ...receivedBetween(day, day) }),
      get<TepTinDto[] | null>(`/api/VanBanDen/${id}/TepTin`),
      calendar(),
    ]);
    const row = rows.find((r) => r.id === id);
    if (!row) throw new ApiError({ service: 'document', status: 404, errorCode: 'HTTP_404', message: NOT_FOUND });
    const task = items.find((item) => item.vanBanDenId === id && isTaskItem(item));
    const team = task ? await get<CongViecDetailDto>(`/api/VanBanDen/CongViec/${task.id}`).catch(() => undefined) : undefined;
    return incomingDetail(incomingFromRow(row, task), entity, files ?? [], team);
  },

  /** `POST /api/VanBanDen/{id}/GhiNhanDaDoc`: a distributor opened it. */
  markIncomingRead: (id: string) => post<unknown>(`/api/VanBanDen/${id}/GhiNhanDaDoc`),

  /** `POST /api/VanBanDen/PhanPhoiXuLy`: assigns chủ trì / phối hợp / để biết. */
  assign: (input: AssignInput) => {
    const ids = (role: AssignInput['thanhPhan'][number]['role']) => input.thanhPhan.filter((a) => a.role === role).map((a) => a.person.id);
    const chuTri = ids('chu_tri');
    return post<unknown>('/api/VanBanDen/PhanPhoiXuLy', {
      id: input.id,
      isKhongYeuCauXuLy: input.khongYeuCauXuLy,
      hanXuLy: input.khongYeuCauXuLy ? null : (input.han ?? null),
      mucDoKhan: input.khan ? 2 : 1,
      mucDoQuanTrong: input.quanTrong ? 2 : 1,
      yKienPhanPhoi: input.yKien.trim(),
      isKhongChuyenChuTri: false,
      isGuiEmail: input.guiEmail,
      thanhPhan: { nguoiChuTriIds: chuTri, nguoiChuTriId: chuTri[0] ?? null, nguoiPhoiHopIds: ids('phoi_hop'), nguoiDeBietIds: ids('de_biet') },
    });
  },

  /** `POST /api/VanBanDen/HoanTat`. */
  complete: (id: string, ketQua: string) => post<unknown>('/api/VanBanDen/HoanTat', { id, ketQua: ketQua.trim() }),

  /** `POST /api/VanBanDen/TraLai`: back to the distributor; the processing team no longer sees it. */
  returnDoc: (id: string, lyDo: string) => post<unknown>('/api/VanBanDen/TraLai', { id, lyDoTraLai: lyDo.trim() }),

  /** "Việc của tôi": my tasks on `GET /api/VanBanDen/CongViec/Calendar` (all, or of a month), without the documents to distribute. */
  async tasks(month?: string): Promise<DocTask[]> {
    return (await calendar(month)).filter(isTaskItem).map(taskFromItem);
  },

  /** `GET /api/VanBanDen/{id}/ThanhPhanPhanPhoi`: active staff, to pick the processing team from (as the web). */
  async distributionPeople(docId: string): Promise<DocPerson[]> {
    return ((await get<ThanhPhanDto[] | null>(`/api/VanBanDen/${docId}/ThanhPhanPhanPhoi`)) ?? []).map(personFromThanhPhan);
  },

  /** `GET /api/VanBan/VaoSo?loai=2|3&chiDuocChiaSe=true`: outgoing and internal documents shared with me. */
  async shared(): Promise<SharedDoc[]> {
    const today = todayKey();
    const from = addDays(today, -OPEN_DAYS);
    const [di, noiBo] = await Promise.all([registered(2, from, today, true), registered(3, from, today, true)]);
    return [...di, ...noiBo].map(sharedFromRow);
  },

  /** One shared document, fresh: its row in my list for the day it was filed, and its files. */
  async sharedDetail(id: string): Promise<SharedDoc> {
    const entity = await get<VanBanEntityDto>(`/api/VanBan/${id}`);
    const day = vtDateKey(entity.createdDate) ?? todayKey();
    const [rows, files] = await Promise.all([
      entity.loai === 2 || entity.loai === 3 ? registered(entity.loai, day, day, true) : Promise.resolve([]),
      get<TepTinDto[] | null>(`/api/VanBan/${id}/TepTin`),
    ]);
    const row = rows.find((r) => r.id === id);
    if (!row) throw new ApiError({ service: 'document', status: 404, errorCode: 'HTTP_404', message: NOT_FOUND });
    return sharedDetail(sharedFromRow(row), files ?? []);
  },

  /** `POST /api/VanBan/{id}/GhiNhanDaDoc`. */
  markSharedRead: (id: string) => post<unknown>(`/api/VanBan/${id}/GhiNhanDaDoc`),

  /** `GET /api/VanBan/{id}/ThanhPhan`: every active staff member with their rights, and my ceiling. */
  async shareOptions(docId: string): Promise<ShareOptions> {
    return shareOptions((await get<ThanhPhanResponseDto | null>(`/api/VanBan/${docId}/ThanhPhan`)) ?? {});
  },

  /**
   * `POST /api/VanBan/ChiaSe`. `recipients` is the final list: whoever is left out loses the document. Groups
   * (`lstThanhPhanNhomChiaSes`) are not sent, so the server keeps them as they are.
   */
  share: (id: string, recipients: ShareRecipient[]) => post<unknown>('/api/VanBan/ChiaSe', { id, lstThanhPhans: recipients.map(shareRow) }),

  /** Registered outgoing / internal documents I may stamp and that wait for it ("Chờ đóng dấu"). */
  async stampQueue(): Promise<StampDoc[]> {
    const today = todayKey();
    const from = addDays(today, -STAMP_DAYS);
    const [di, noiBo] = await Promise.all([registered(2, from, today, false), registered(3, from, today, false)]);
    return [...di, ...noiBo].filter(isStampable).map(stampFromRow);
  },
};
