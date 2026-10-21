import { documentHref, documentLook, toDocumentNotification } from '../notificationSource';

const ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

describe('documentHref', () => {
  it('opens incoming documents on their detail', () => {
    expect(documentHref({ loai: 'VanBanDen_PhanPhoiXuLy', refId: ID, refUrl: `/quan-ly/van-ban-den?id=${ID}&open=view&tab=2` })).toEqual({
      pathname: '/documents/incoming/[id]',
      params: { id: ID },
    });
  });

  it('opens shared outgoing and internal documents on their detail', () => {
    const href = { pathname: '/documents/shared/[id]', params: { id: ID } };
    expect(documentHref({ loai: 'VanBanDi_ChiaSe', refId: ID, refUrl: `/quan-ly/van-ban-di?id=${ID}&open=view` })).toEqual(href);
    expect(documentHref({ loai: 'VanBanNoiBo_BoHuy', refId: ID, refUrl: `/quan-ly/van-ban-noi-bo?id=${ID}&open=view` })).toEqual(href);
  });

  it('cannot open a notification without refUrl (revoked, cancelled, removed)', () => {
    expect(documentHref({ loai: 'VanBanNoiBo_ThuHoi', refId: ID, refUrl: '' })).toBeNull();
    expect(documentHref({ loai: 'VanBanDen_GoPhanPhoi', refId: ID, refUrl: null })).toBeNull();
  });

  it('opens the Văn thư home for E-sign documents, which have no mobile screen', () => {
    expect(documentHref({ loai: 'VanBanKhac_TuEsign', refId: ID, refUrl: `/quan-ly/van-ban-khac?id=${ID}&open=view` })).toBe('/documents');
  });

  it('falls back on the web route when the loai is unknown', () => {
    expect(documentHref({ loai: null, refId: ID, refUrl: `/quan-ly/van-ban-den?id=${ID}&open=view` })).toEqual({
      pathname: '/documents/incoming/[id]',
      params: { id: ID },
    });
  });
});

describe('documentLook', () => {
  it('maps actions to tones', () => {
    expect(documentLook({ type: 'VanBanDen_TraLai' }).tone).toBe('danger');
    expect(documentLook({ type: 'VanBanDen_PhanPhoiXuLy' }).tone).toBe('warn');
    expect(documentLook({ type: 'VanBanDen_HoanTat' }).tone).toBe('ok');
    expect(documentLook({ type: 'VanBanDi_Huy' }).tone).toBe('off');
    expect(documentLook({ type: 'VanBanDi_ChiaSe' }).tone).toBe('wait');
  });
});

describe('toDocumentNotification', () => {
  it('reads Vietnam wall-clock times and titles the empty tieuDe from the loai', () => {
    const notification = toDocumentNotification({
      id: 'n1',
      loai: 'VanBanDen_PhanPhoiXuLy',
      tieuDe: null,
      noiDung: 'Bạn được phân phối xử lý văn bản đến 12/VBĐ',
      refId: ID,
      refUrl: `/quan-ly/van-ban-den?id=${ID}&open=view&tab=2`,
      daDoc: false,
      createdDate: '2026-10-21T08:30:00.1234567',
    });
    expect(notification).toMatchObject({
      id: 'n1',
      title: 'Văn bản cần xử lý',
      body: 'Bạn được phân phối xử lý văn bản đến 12/VBĐ',
      type: 'VanBanDen_PhanPhoiXuLy',
      isRead: false,
      createdAt: '2026-10-21T01:30:00.123Z',
    });
  });
});
