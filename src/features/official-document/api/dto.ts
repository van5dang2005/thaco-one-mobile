/**
 * Wire shapes of `thaco_be_ql_van_thu` (camelCase JSON of its view models). Times are Vietnam wall-clock
 * without a zone ("2026-10-14T08:30:00"); enums are numbers or the strings noted. Only the fields the app reads.
 */

/** Every answer: `{ success, message, data }`. */
export type VtReply<T> = { success?: boolean; message?: string | null; data?: T | null };

/** `data` of a paged list (`page`, `pageSize` in the query). */
export type VtPage<T> = { items?: T[] | null; totalRow?: number | null; totalPage?: number | null };

/** `GET /api/User/Info`. */
export type UserInfoDto = {
  id: string;
  userName?: string | null;
  fullName?: string | null;
  lstRoleNames?: string[] | null;
};

/** `GET /api/NhanVien` row. */
export type NhanVienDto = {
  id: string;
  maNhanVien?: string | null;
  tenNhanVien?: string | null;
  tenDonVi?: string | null;
  tenChucVu?: string | null;
};

/** `GET /api/VanBanDen` row (`VanBanDenViewModel`), `can*` computed for the caller. */
export type VanBanDenDto = {
  id: string;
  maSoVanBan?: string | null;
  ngayNhan: string;
  soKyHieu?: string | null;
  trichYeu?: string | null;
  tenCoQuan?: string | null;
  coQuanNhan?: string | null;
  tenDoKhan?: string | null;
  /** 1 chờ phân phối, 2 chờ xử lý, 3 không xử lý, 4 đã xử lý. */
  trangThai: number;
  isTraLai?: boolean;
  lyDoTraLai?: string | null;
  isHuy?: boolean;
  /** Who assigned the current task (name). */
  nguoiPhanPhoi?: string | null;
  /** Chủ trì of the current task, ", "-joined when two. */
  tenNguoiChuTri?: string | null;
  lstNguoiPhoiHop?: string | null;
  lstNguoiDeBiet?: string | null;
  yKienPhanPhoi?: string | null;
  ngayPhanPhoi?: string | null;
  hanXuLy?: string | null;
  ngayHoanTat?: string | null;
  ketQua?: string | null;
  /** Set only for a distributor who has not opened it. */
  isChuaDoc?: boolean;
  canPhanPhoiXuLy?: boolean;
  canHoanTat?: boolean;
  canTraLai?: boolean;
};

/** `GET /api/VanBanDen/{id}`: the stored record (ids, no catalogue names except `coQuan`). */
export type VanBanDenEntityDto = {
  id: string;
  maSoVanBan?: string | null;
  ngayNhan: string;
  soKyHieu?: string | null;
  trichYeu?: string | null;
  coQuan?: { tenCoQuan?: string | null } | null;
  coQuanNhan?: string | null;
  trangThai: number;
  isTraLai?: boolean;
  lyDoTraLai?: string | null;
  isHuy?: boolean;
  /** 1 bình thường, 2 khẩn. */
  mucDoKhan?: number;
  /** 1 bình thường, 2 quan trọng. */
  mucDoQuanTrong?: number;
  hanXuLy?: string | null;
  ngayPhanPhoi?: string | null;
  yKienPhanPhoi?: string | null;
  ketQua?: string | null;
  ngayHoanTat?: string | null;
};

export type VaiTroDto = 'chuTri' | 'phoiHop' | 'deBiet';

/** `GET /api/VanBanDen/CongViec/Calendar` item: one of my tasks, or a document waiting for me to distribute. */
export type CongViecItemDto = {
  /** The task id; the document id for a document still waiting for distribution (no task yet). */
  id: string;
  vanBanDenId: string;
  maSoVanBan?: string | null;
  trichYeu?: string | null;
  tenChuTri?: string | null;
  ngayPhanPhoi?: string | null;
  hanXuLy?: string | null;
  vanBanTrangThai: number;
  isHuyVanBan?: boolean;
  vaiTroNguoiDung?: VaiTroDto | null;
  /** `chuTriChuaHt` | `phoiHopChuaHt` | `deBietChuaHt` | `hoanTat`. */
  mauLoai?: string | null;
  ketQua?: string | null;
};

export type CongViecCalendarDto = { referenceDate?: string | null; items?: CongViecItemDto[] | null };

/** `GET /api/VanBanDen/CongViec/{id}`: only for a member of the task. */
export type CongViecDetailDto = {
  id: string;
  vanBanDenId: string;
  tenNguoiPhanPhoi?: string | null;
  mucDoKhan?: number;
  mucDoQuanTrong?: number;
  /** `vaiTro` 1 chủ trì, 2 phối hợp, 3 để biết. */
  thanhPhan?: { nhanVienId: string; hoTen?: string | null; vaiTro: number }[] | null;
};

/** `GET …/{id}/TepTin` row: each file with the caller's view / download right. */
export type TepTinDto = {
  id: string;
  /** "Văn bản đóng dấu", "Văn bản hiện tại", "Văn bản gốc", "Tệp đính kèm". */
  loaiTepTin?: string | null;
  /** `Uploads/yyyy/m/d/file.pdf`, served statically without a token. */
  duongDan?: string | null;
  tenTep?: string | null;
  /** Formatted size ("1.2 MB"). */
  kichThuoc?: string | null;
  /** Extension (".pdf"). */
  loaiTep?: string | null;
  isXem?: boolean;
  isTai?: boolean;
};

/** `GET /api/VanBan/VaoSo` row (`VanBanViewModel`). */
export type VanBanDto = {
  id: string;
  /** 2 đi, 3 nội bộ. */
  loai: number;
  trichYeu?: string | null;
  tenDonVi?: string | null;
  tenNguoiKy?: string | null;
  tenNguoiDuThao?: string | null;
  maSoVanBan?: string | null;
  tenLoaiVanBan?: string | null;
  tenDoMat?: string | null;
  tenDoKhan?: string | null;
  ngayVanBan?: string | null;
  ngayGui?: string | null;
  createdDate: string;
  isDongDau?: boolean;
  isTuEsign?: boolean;
  /** 1 not opened yet by me, 0 opened. */
  trangThai?: number;
  isTheoDoiPhanHoi?: boolean;
  ngayPhanHoi?: string | null;
  isThuHoi?: boolean;
  isHuy?: boolean;
  lyDoHuy?: string | null;
  canDongDau?: boolean;
  canChiaSe?: boolean;
  canXem?: boolean;
  canTai?: boolean;
};

/** `GET /api/VanBan/{id}`: the stored record. */
export type VanBanEntityDto = { id: string; loai: number; createdDate: string };

/** A person on a picker with their rights (`VanBan_ThanhPhanModel`, `VanBanDenPhanPhoiThanhPhanModel`). */
export type ThanhPhanDto = {
  nhanVienId: string;
  userId?: string | null;
  maNhanVien?: string | null;
  tenNhanVien?: string | null;
  tenDonVi?: string | null;
  tenChucVu?: string | null;
  isKiemNhiem?: boolean;
  isXem?: boolean;
  isTai?: boolean;
  isChiaSe?: boolean;
};

/** `GET /api/VanBan/{id}/ThanhPhan`. */
export type ThanhPhanResponseDto = {
  items?: ThanhPhanDto[] | null;
  grantablePermissions?: { isFullGrant?: boolean; canGrantXem?: boolean; canGrantTai?: boolean; canGrantChiaSe?: boolean } | null;
};
