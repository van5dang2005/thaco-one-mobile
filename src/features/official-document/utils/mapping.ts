import { env } from '@/core/config/env';
import type { DateKey } from '@/core/time/vn';

import type {
  CongViecDetailDto,
  CongViecItemDto,
  NhanVienDto,
  TepTinDto,
  ThanhPhanDto,
  ThanhPhanResponseDto,
  VaiTroDto,
  VanBanDenDto,
  VanBanDenEntityDto,
  VanBanDto,
} from '../api/dto';
import type { Assignment, DocFile, DocPerson, DocRole, DocTask, FileKind, IncomingDoc, IncomingStatus, SharedDoc, SharePermissions, ShareOptions, ShareRecipient, StampDoc } from '../types';

/** `Guid.Empty`: a văn thư account without an HRM record shares by `userId` only. */
export const EMPTY_ID = '00000000-0000-0000-0000-000000000000';

const text = (value: string | null | undefined) => value?.trim() || undefined;

// ── Time: Văn thư sends Vietnam wall-clock without a zone ────────────────────

/** Day of a Văn thư timestamp, read as written ("2026-10-14T23:30:00" is 14/10). */
export function vtDateKey(value: string | null | undefined): DateKey | undefined {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : undefined;
}

/** Instant of a Văn thư timestamp: Vietnam time unless it carries a zone; fractions cut to milliseconds for Hermes. */
export function vtInstant(value: string | null | undefined): Date | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const iso = trimmed.replace(/(\.\d{3})\d+/, '$1');
  const date = new Date(/([zZ]|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}+07:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// ── People ───────────────────────────────────────────────────────────────────

export function personFromStaff(row: NhanVienDto): DocPerson {
  return { id: row.id, name: text(row.tenNhanVien) ?? text(row.maNhanVien) ?? '', code: text(row.maNhanVien) ?? '', unit: text(row.tenDonVi) ?? '', position: text(row.tenChucVu) };
}

/** A picker row; a văn thư account without HRM record is keyed by its user id. */
export function personFromThanhPhan(row: ThanhPhanDto): DocPerson {
  const id = row.nhanVienId && row.nhanVienId !== EMPTY_ID ? row.nhanVienId : `user:${row.userId ?? ''}`;
  return { ...personFromStaff({ ...row, id }), concurrent: !!row.isKiemNhiem };
}

/** Someone a list only names. */
export function namedPerson(name: string): DocPerson {
  return { id: `name:${name}`, name, code: '', unit: '' };
}

/** ", "-joined names → people. */
export function namesOf(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

// ── Files ────────────────────────────────────────────────────────────────────

/** Where a stored path (`Uploads/2026/10/14/a.pdf`) is served; the API maps its root to the uploads folder. */
export function fileUrl(duongDan: string, baseUrl = env.documentApiUrl): string {
  const path = duongDan
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^uploads\//i, '');
  return `${baseUrl}/${path.split('/').filter(Boolean).map(encodeURIComponent).join('/')}`;
}

function fileKind(name: string, ext?: string | null): FileKind {
  const found = (ext || name.match(/\.[^.]+$/)?.[0] || '').toLowerCase().replace(/^\./, '');
  if (found === 'pdf') return 'pdf';
  if (found === 'doc' || found === 'docx') return 'doc';
  if (found === 'xls' || found === 'xlsx') return 'xls';
  return 'other';
}

export function docFile(row: TepTinDto): DocFile {
  const name = text(row.tenTep) ?? '';
  return {
    id: row.id,
    name,
    kind: fileKind(name, row.loaiTep),
    size: text(row.kichThuoc) ?? '',
    description: text(row.loaiTepTin),
    url: row.isXem && row.duongDan?.trim() ? fileUrl(row.duongDan) : undefined,
  };
}

const ORIGINAL = 'văn bản gốc';
const ATTACHMENT = 'tệp đính kèm';

/** Splits `TepTin` into the main file (stamped or current), further main files and attachments, and originals. */
export function splitFiles(rows: readonly TepTinDto[]): { main?: DocFile; tep: DocFile[]; phienBan: DocFile[] } {
  const label = (row: TepTinDto) => (row.loaiTepTin ?? '').trim().toLocaleLowerCase('vi');
  const mains = rows.filter((row) => label(row) !== ORIGINAL && label(row) !== ATTACHMENT).map(docFile);
  return {
    main: mains[0],
    tep: [...mains.slice(1), ...rows.filter((row) => label(row) === ATTACHMENT).map(docFile)],
    phienBan: rows.filter((row) => label(row) === ORIGINAL).map(docFile),
  };
}

// ── Incoming documents ───────────────────────────────────────────────────────

export function incomingStatus(trangThai: number, isTraLai?: boolean): IncomingStatus {
  // Returned documents are 2 + IsTraLai (older data: 1 + IsTraLai).
  if (isTraLai && (trangThai === 1 || trangThai === 2)) return 'bi_tra_lai';
  if (trangThai === 2) return 'dang_xu_ly';
  if (trangThai === 3) return 'khong_xu_ly';
  if (trangThai === 4) return 'da_xu_ly';
  return 'cho_phan_phoi';
}

const ROLE_OF: Record<VaiTroDto, DocRole> = { chuTri: 'chu_tri', phoiHop: 'phoi_hop', deBiet: 'de_biet' };
const ROLE_BY_NUMBER: Record<number, DocRole> = { 1: 'chu_tri', 2: 'phoi_hop', 3: 'de_biet' };

/** "Độ khẩn" of the register: anything but "Thường" reads as urgent. */
export function isUrgentLevel(tenDoKhan: string | null | undefined) {
  const name = tenDoKhan?.trim().toLocaleLowerCase('vi');
  return !!name && name !== 'thường' && name !== 'bình thường';
}

/** A calendar item that is a task of mine (not a document still waiting for me to distribute it). */
export function isTaskItem(item: CongViecItemDto) {
  return item.id !== item.vanBanDenId && !!item.vaiTroNguoiDung;
}

/** The processing team a list row names: chủ trì, phối hợp, để biết. */
function teamFromNames(row: VanBanDenDto): Assignment[] {
  const of = (value: string | null | undefined, role: DocRole) => namesOf(value).map((name): Assignment => ({ person: namedPerson(name), role }));
  return [...of(row.tenNguoiChuTri, 'chu_tri'), ...of(row.lstNguoiPhoiHop, 'phoi_hop'), ...of(row.lstNguoiDeBiet, 'de_biet')];
}

/** A list row, with my task on it (from the task calendar) when I am in its processing team. */
export function incomingFromRow(row: VanBanDenDto, task?: CongViecItemDto): IncomingDoc {
  return {
    id: row.id,
    soDen: text(row.maSoVanBan) ?? '',
    soHieu: text(row.soKyHieu) ?? '',
    trichYeu: text(row.trichYeu) ?? '',
    coQuan: text(row.tenCoQuan) ?? text(row.coQuanNhan) ?? '',
    ngayNhan: vtDateKey(row.ngayNhan) ?? '',
    han: vtDateKey(row.hanXuLy),
    khan: isUrgentLevel(row.tenDoKhan),
    quanTrong: false,
    trangThai: incomingStatus(row.trangThai, row.isTraLai),
    vaiTro: task?.vaiTroNguoiDung ? ROLE_OF[task.vaiTroNguoiDung] : undefined,
    congViecId: task?.id,
    coThePhanPhoi: !!row.canPhanPhoiXuLy,
    coTheXuLy: !!row.canHoanTat || !!row.canTraLai,
    nguoiPhanPhoi: text(row.nguoiPhanPhoi),
    phanPhoiLuc: vtInstant(row.ngayPhanPhoi)?.toISOString(),
    yKienPhanPhoi: text(row.yKienPhanPhoi),
    thanhPhan: teamFromNames(row),
    tep: [],
    lyDoTraLai: text(row.lyDoTraLai),
    ketQua: text(row.ketQua),
    ngayHoanTat: vtDateKey(row.ngayHoanTat),
    daHuy: !!row.isHuy,
    daXem: !row.isChuaDoc,
  };
}

/**
 * The detail: the list row (rights, names) completed by the stored record (urgency, importance), the files, and
 * my task's team with ids when I am in it.
 */
export function incomingDetail(base: IncomingDoc, entity: VanBanDenEntityDto, files: readonly TepTinDto[], task?: CongViecDetailDto): IncomingDoc {
  const team = task?.thanhPhan?.length
    ? task.thanhPhan.map((m): Assignment => ({ person: { id: m.nhanVienId, name: text(m.hoTen) ?? '', code: '', unit: '' }, role: ROLE_BY_NUMBER[m.vaiTro] ?? 'de_biet' }))
    : base.thanhPhan;
  const mucDoKhan = task?.mucDoKhan ?? entity.mucDoKhan;
  const mucDoQuanTrong = task?.mucDoQuanTrong ?? entity.mucDoQuanTrong;
  const { main, tep } = splitFiles(files);
  return {
    ...base,
    khan: base.khan || mucDoKhan === 2,
    quanTrong: mucDoQuanTrong === 2,
    nguoiPhanPhoi: base.nguoiPhanPhoi ?? text(task?.tenNguoiPhanPhoi),
    thanhPhan: team,
    tep: main ? [main, ...tep] : tep,
  };
}

/** One of my tasks on the "Việc của tôi" calendar: a bar from distribution day to deadline. */
export function taskFromItem(item: CongViecItemDto): DocTask {
  const han = vtDateKey(item.hanXuLy);
  const from = vtDateKey(item.ngayPhanPhoi) ?? han ?? '';
  return {
    id: item.id,
    docId: item.vanBanDenId,
    soDen: text(item.maSoVanBan) ?? '',
    trichYeu: text(item.trichYeu) ?? '',
    role: ROLE_OF[item.vaiTroNguoiDung ?? 'deBiet'],
    from,
    to: han && han >= from ? han : from,
    hasDeadline: !!han,
    // As the web calendar (`mauLoai = hoanTat`): finished once processed or once the chủ trì filed a result.
    done: item.mauLoai === 'hoanTat' || item.vanBanTrangThai === 4 || !!item.ketQua?.trim(),
    cancelled: !!item.isHuyVanBan,
    chuTri: text(item.tenChuTri),
  };
}

// ── Outgoing / internal documents ────────────────────────────────────────────

export function sharedFromRow(row: VanBanDto): SharedDoc {
  return {
    id: row.id,
    kind: row.loai === 3 ? 'noi_bo' : 'di',
    soHieu: text(row.maSoVanBan) ?? '',
    loai: text(row.tenLoaiVanBan) ?? '',
    trichYeu: text(row.trichYeu) ?? '',
    donVi: text(row.tenDonVi) ?? '',
    ngayGui: vtDateKey(row.ngayGui) ?? vtDateKey(row.ngayVanBan) ?? vtDateKey(row.createdDate) ?? '',
    daXem: row.trangThai !== 1,
    hanPhanHoi: row.isTheoDoiPhanHoi ? vtDateKey(row.ngayPhanHoi) : undefined,
    daHuy: !!row.isHuy,
    lyDoHuy: text(row.lyDoHuy),
    quyen: { xem: !!row.canXem, tai: !!row.canTai, chiaSe: !!row.canChiaSe },
    nguoiKy: text(row.tenNguoiKy),
    nguoiDuThao: text(row.tenNguoiDuThao),
    doKhan: text(row.tenDoKhan),
    doMat: text(row.tenDoMat),
    tep: [],
    phienBan: [],
  };
}

export function sharedDetail(base: SharedDoc, files: readonly TepTinDto[]): SharedDoc {
  const { main, tep, phienBan } = splitFiles(files);
  return { ...base, vanBan: main, tep, phienBan };
}

/** Registered and stampable by me, not stamped, cancelled or recalled: "Chờ đóng dấu" (VANTHU.md 2.3). */
export function isStampable(row: VanBanDto) {
  return !!row.canDongDau && !row.isDongDau && !row.isHuy && !row.isThuHoi && !!row.maSoVanBan?.trim();
}

export function stampFromRow(row: VanBanDto): StampDoc {
  return {
    id: row.id,
    kind: row.loai === 3 ? 'noi_bo' : 'di',
    soHieu: text(row.maSoVanBan) ?? '',
    loai: text(row.tenLoaiVanBan) ?? '',
    trichYeu: text(row.trichYeu) ?? '',
    donVi: text(row.tenDonVi) ?? '',
    ngayVaoSo: vtDateKey(row.ngayVanBan) ?? vtDateKey(row.createdDate) ?? '',
    nguoiKy: text(row.tenNguoiKy),
    tuEsign: !!row.isTuEsign,
  };
}

// ── Sharing ──────────────────────────────────────────────────────────────────

export function shareOptions(reply: ThanhPhanResponseDto): ShareOptions {
  const grant = reply.grantablePermissions;
  // No ceiling sent: the web treats it as full.
  const full = !grant || !!grant.isFullGrant;
  const ceiling: SharePermissions = { xem: full || !!grant?.canGrantXem, tai: full || !!grant?.canGrantTai, chiaSe: full || !!grant?.canGrantChiaSe };
  const recipients = (reply.items ?? []).map(
    (row): ShareRecipient => ({
      person: personFromThanhPhan(row),
      quyen: { xem: !!row.isXem, tai: !!row.isTai, chiaSe: !!row.isChiaSe },
      nhanVienId: row.nhanVienId || EMPTY_ID,
      userId: row.userId ?? undefined,
    }),
  );
  return { recipients, ceiling };
}

/** A row of `POST /api/VanBan/ChiaSe` (the list is the final state). */
export function shareRow(recipient: ShareRecipient) {
  return {
    nhanVienId: recipient.nhanVienId,
    userId: recipient.userId ?? null,
    isXem: recipient.quyen.xem,
    isTai: recipient.quyen.tai,
    isChiaSe: recipient.quyen.chiaSe,
    maNhanVien: recipient.person.code,
    tenNhanVien: recipient.person.name,
    tenDonVi: recipient.person.unit,
    tenChucVu: recipient.person.position ?? '',
  };
}
