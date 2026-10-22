import type { TepTinDto, VanBanDenDto, VanBanDto } from '../../api/dto';
import { EMPTY_ID, fileUrl, incomingDetail, incomingFromRow, incomingStatus, isStampable, isUrgentLevel, shareOptions, shareRow, sharedFromRow, splitFiles, vtDateKey, vtInstant } from '../mapping';

const row: VanBanDenDto = {
  id: 'vbd-1',
  maSoVanBan: '1248',
  ngayNhan: '2026-10-14T00:00:00',
  soKyHieu: '215/CV-UBND',
  trichYeu: ' V/v phối hợp kiểm tra PCCC ',
  tenCoQuan: null,
  coQuanNhan: 'UBND tỉnh Quảng Nam',
  tenDoKhan: 'Thường',
  trangThai: 2,
  isTraLai: false,
  nguoiPhanPhoi: 'Lê Văn Hùng',
  tenNguoiChuTri: 'Nguyễn Minh Khoa, Trần Thu Hà',
  lstNguoiPhoiHop: 'Phạm Đức Long',
  lstNguoiDeBiet: '',
  ngayPhanPhoi: '2026-10-14T23:30:00.1234567',
  hanXuLy: '2026-10-20T00:00:00',
  isChuaDoc: true,
  canPhanPhoiXuLy: false,
  canHoanTat: true,
  canTraLai: true,
};

describe('Vietnam wall-clock times', () => {
  it('reads the day as written and the instant at UTC+7', () => {
    expect(vtDateKey('2026-10-14T23:30:00')).toBe('2026-10-14');
    expect(vtDateKey(null)).toBeUndefined();
    expect(vtInstant('2026-10-14T23:30:00.1234567')?.toISOString()).toBe('2026-10-14T16:30:00.123Z');
    expect(vtInstant('2026-10-14T23:30:00Z')?.toISOString()).toBe('2026-10-14T23:30:00.000Z');
    expect(vtInstant('')).toBeUndefined();
  });
});

describe('incoming documents', () => {
  it('maps status with the returned flag', () => {
    expect(incomingStatus(1)).toBe('cho_phan_phoi');
    expect(incomingStatus(2)).toBe('dang_xu_ly');
    expect(incomingStatus(2, true)).toBe('bi_tra_lai');
    expect(incomingStatus(1, true)).toBe('bi_tra_lai');
    expect(incomingStatus(3)).toBe('khong_xu_ly');
    expect(incomingStatus(4, true)).toBe('da_xu_ly');
  });

  it('treats only a level other than "Thường" as urgent', () => {
    expect(isUrgentLevel('Thường')).toBe(false);
    expect(isUrgentLevel('Hỏa tốc')).toBe(true);
    expect(isUrgentLevel(null)).toBe(false);
  });

  it('builds a list row with my role and the back-end rights', () => {
    const doc = incomingFromRow(row, { id: 'cv-1', vanBanDenId: 'vbd-1', vanBanTrangThai: 2, vaiTroNguoiDung: 'chuTri' });
    expect(doc).toMatchObject({
      soDen: '1248',
      trichYeu: 'V/v phối hợp kiểm tra PCCC',
      coQuan: 'UBND tỉnh Quảng Nam',
      ngayNhan: '2026-10-14',
      han: '2026-10-20',
      khan: false,
      trangThai: 'dang_xu_ly',
      vaiTro: 'chu_tri',
      congViecId: 'cv-1',
      coThePhanPhoi: false,
      coTheXuLy: true,
      nguoiPhanPhoi: 'Lê Văn Hùng',
      phanPhoiLuc: '2026-10-14T16:30:00.123Z',
      daXem: false,
    });
    expect(doc.thanhPhan.map((a) => [a.person.name, a.role])).toEqual([
      ['Nguyễn Minh Khoa', 'chu_tri'],
      ['Trần Thu Hà', 'chu_tri'],
      ['Phạm Đức Long', 'phoi_hop'],
    ]);
  });

  it('completes the detail with the stored levels, the team ids and the files', () => {
    const base = incomingFromRow(row);
    const files: TepTinDto[] = [
      { id: 'a', tenTep: 'phu-luc.xlsx', loaiTepTin: 'Tệp đính kèm', duongDan: 'Uploads/2026/10/14/phu-luc.xlsx', isXem: true },
      { id: 'm', tenTep: '215.pdf', loaiTepTin: 'Văn bản đóng dấu', duongDan: 'Uploads/2026/10/14/215 dd.pdf', isXem: true },
      { id: 'o', tenTep: '215.pdf', loaiTepTin: 'Văn bản gốc', duongDan: 'Uploads/2026/10/14/215.pdf', isXem: true },
    ];
    const doc = incomingDetail(base, { id: 'vbd-1', ngayNhan: row.ngayNhan, trangThai: 2, mucDoKhan: 2, mucDoQuanTrong: 1 }, files, {
      id: 'cv-1',
      vanBanDenId: 'vbd-1',
      thanhPhan: [{ nhanVienId: 'nv-1', hoTen: 'Nguyễn Minh Khoa', vaiTro: 1 }],
    });
    expect(doc.khan).toBe(true);
    expect(doc.quanTrong).toBe(false);
    expect(doc.thanhPhan).toEqual([{ person: { id: 'nv-1', name: 'Nguyễn Minh Khoa', code: '', unit: '' }, role: 'chu_tri' }]);
    expect(doc.tep.map((f) => [f.id, f.kind])).toEqual([
      ['m', 'pdf'],
      ['a', 'xls'],
    ]);
  });
});

describe('files', () => {
  it('serves stored paths from the API root', () => {
    expect(fileUrl('Uploads/2026/10/14/215 dd.pdf', 'https://api')).toBe('https://api/2026/10/14/215%20dd.pdf');
    expect(fileUrl('\\uploads\\a.pdf', 'https://api')).toBe('https://api/a.pdf');
  });

  it('keeps the URL from files I may not view', () => {
    const { main, tep, phienBan } = splitFiles([
      { id: 'm', tenTep: 'a.docx', loaiTepTin: 'Văn bản hiện tại', duongDan: 'Uploads/a.docx', isXem: false },
      { id: 'o', tenTep: 'a.pdf', loaiTepTin: 'Văn bản gốc', duongDan: 'Uploads/a.pdf', isXem: true },
    ]);
    expect(main).toMatchObject({ id: 'm', kind: 'doc', url: undefined, description: 'Văn bản hiện tại' });
    expect(tep).toEqual([]);
    expect(phienBan.map((f) => f.url)).toEqual(['https://vanthuapi.thaco.com.vn/a.pdf']);
  });
});

describe('outgoing / internal documents', () => {
  const vanBan: VanBanDto = {
    id: 'vb-1',
    loai: 3,
    maSoVanBan: '312/QĐ-THACO',
    createdDate: '2026-10-14T08:00:00',
    ngayGui: null,
    ngayVanBan: '2026-10-13T00:00:00',
    trangThai: 1,
    isTheoDoiPhanHoi: false,
    ngayPhanHoi: '2026-10-20T00:00:00',
    canXem: true,
    canChiaSe: true,
    canDongDau: true,
  };

  it('maps a shared row', () => {
    expect(sharedFromRow(vanBan)).toMatchObject({ kind: 'noi_bo', soHieu: '312/QĐ-THACO', ngayGui: '2026-10-13', daXem: false, hanPhanHoi: undefined, quyen: { xem: true, tai: false, chiaSe: true } });
  });

  it('queues for the stamp only what I may stamp and is not stamped, cancelled or recalled', () => {
    expect(isStampable(vanBan)).toBe(true);
    expect(isStampable({ ...vanBan, isDongDau: true })).toBe(false);
    expect(isStampable({ ...vanBan, isThuHoi: true })).toBe(false);
    expect(isStampable({ ...vanBan, canDongDau: false })).toBe(false);
  });
});

describe('sharing', () => {
  it('reads the ceiling and sends recipients back as they came', () => {
    const options = shareOptions({
      items: [
        { nhanVienId: 'nv-1', maNhanVien: '0123', tenNhanVien: 'Khoa', tenDonVi: 'Ban CNTT', isXem: true, isKiemNhiem: true },
        { nhanVienId: EMPTY_ID, userId: 'u-9', tenNhanVien: 'Văn thư', isXem: true, isTai: true },
      ],
      grantablePermissions: { isFullGrant: false, canGrantXem: true, canGrantTai: false, canGrantChiaSe: true },
    });
    expect(options.ceiling).toEqual({ xem: true, tai: false, chiaSe: true });
    expect(options.recipients[0].person).toMatchObject({ id: 'nv-1', code: '0123', concurrent: true });
    expect(options.recipients[1].person.id).toBe('user:u-9');
    expect(shareRow(options.recipients[1])).toMatchObject({ nhanVienId: EMPTY_ID, userId: 'u-9', isXem: true, isTai: true, isChiaSe: false });
    expect(shareOptions({}).ceiling).toEqual({ xem: true, tai: true, chiaSe: true });
  });
});

describe('file kinds', () => {
  it('labels PowerPoint files PPT, by name or by the extension field', () => {
    const [byName, byExt] = splitFiles([
      { id: 'p', tenTep: 'Báo cáo quý 3.pptx', loaiTepTin: 'Tệp đính kèm', isXem: true },
      { id: 'q', tenTep: 'Trình chiếu', loaiTep: '.PPT', loaiTepTin: 'Tệp đính kèm', isXem: true },
    ]).tep;
    expect(byName.kind).toBe('ppt');
    expect(byExt.kind).toBe('ppt');
  });
});
