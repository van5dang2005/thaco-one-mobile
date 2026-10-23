import { type GuestSchedulePageDto, SecurityCheckInStatus } from '../../types';
import { scheduleQuery, statusOf, toSchedulePage } from '../schedule';

/** Shaped like `GET /api/security/guest-schedules/mobile` as the back-end documents it. */
const page: GuestSchedulePageDto = {
  items: [
    {
      guestScheduleId: 'g-1',
      guestCode: 'AUTO1020260003',
      guestName: ' Đoàn khách mẫu ',
      qrToken: '0807954103354f829a1375e0e0cb138e',
      guestTypeId: 't-1',
      guestTypeName: 'Khách hàng',
      guestCount: 4,
      startDate: '2026-10-21T01:30:00Z',
      endDate: '2026-10-21T03:00:00Z',
      createdAt: '2026-10-20T02:00:00Z',
      securityCheckInStatus: SecurityCheckInStatus.CheckedIn,
      workingUnits: [
        { workingUnitId: 'u-1', workingUnitName: 'Công ty A' },
        { workingUnitId: 'u-2', workingUnitName: ' Công ty B ' },
      ],
    },
    { guestScheduleId: 'g-2', guestCode: 'AUTO1020260004', securityCheckInStatus: SecurityCheckInStatus.CheckedOut },
    { guestScheduleId: 'g-3', guestName: 'Đoàn chờ', guestTypeName: null, workingUnits: null, securityCheckInStatus: SecurityCheckInStatus.Pending },
    { guestScheduleId: '' },
  ],
  totalCount: 3,
  pageNumber: 1,
  pageSize: 50,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
  summary: { allCount: 7, pendingCount: 2, checkInCount: 3 },
};

describe('scheduleQuery', () => {
  const day = '2026-10-21';

  it('asks for the day as both ends, the search and the page', () => {
    expect(scheduleQuery({ day, tab: 'all', search: 'KH' }, 2)).toEqual({ pageNumber: 2, pageSize: 50, search: 'KH', fromDate: day, toDate: day });
  });

  it('maps each tab onto securityCheckInStatus or securityConfirmed', () => {
    const extra = (tab: Parameters<typeof scheduleQuery>[0]['tab']) => {
      const { securityCheckInStatus, securityConfirmed } = scheduleQuery({ day, tab }, 1);
      return { securityCheckInStatus, securityConfirmed };
    };
    expect(extra('all')).toEqual({ securityCheckInStatus: undefined, securityConfirmed: undefined });
    expect(extra('pending')).toEqual({ securityCheckInStatus: 0, securityConfirmed: undefined });
    expect(extra('confirmed')).toEqual({ securityCheckInStatus: undefined, securityConfirmed: true });
    expect(extra('checkedIn')).toEqual({ securityCheckInStatus: 1, securityConfirmed: undefined });
    expect(extra('checkedOut')).toEqual({ securityCheckInStatus: 2, securityConfirmed: undefined });
    expect(extra('rejected')).toEqual({ securityCheckInStatus: 3, securityConfirmed: undefined });
  });
});

describe('toSchedulePage', () => {
  it('maps the visits and drops those without an id', () => {
    const { items } = toSchedulePage(page);
    expect(items).toEqual([
      {
        id: 'g-1',
        code: 'AUTO1020260003',
        qrToken: '0807954103354f829a1375e0e0cb138e',
        groupName: 'Đoàn khách mẫu',
        guestType: 'Khách hàng',
        host: 'Công ty A, Công ty B',
        from: '2026-10-21T01:30:00Z',
        to: '2026-10-21T03:00:00Z',
        guestCount: 4,
        status: 'checkedIn',
      },
      { id: 'g-2', code: 'AUTO1020260004', groupName: 'AUTO1020260004', guestType: null, host: null, from: '', to: '', guestCount: 0, status: 'checkedOut' },
      { id: 'g-3', groupName: 'Đoàn chờ', guestType: null, host: null, from: '', to: '', guestCount: 0, status: 'pending' },
    ]);
  });

  it('counts as confirmed every group not pending, gone ones included', () => {
    expect(toSchedulePage(page).counts).toEqual({ total: 7, pending: 2, confirmed: 5 });
    expect(toSchedulePage({ ...page, summary: null }).counts).toEqual({ total: 0, pending: 0, confirmed: 0 });
  });

  it('keeps the paging fields', () => {
    const { totalCount, hasNextPage, pageNumber } = toSchedulePage({ ...page, hasNextPage: true });
    expect({ totalCount, hasNextPage, pageNumber }).toEqual({ totalCount: 3, hasNextPage: true, pageNumber: 1 });
  });
});

describe('statusOf', () => {
  it('reads every securityCheckInStatus, a missing one as still waiting', () => {
    expect([0, 1, 2, 3].map((value) => statusOf(value))).toEqual(['pending', 'checkedIn', 'checkedOut', 'rejected']);
    expect(statusOf(null)).toBe('pending');
  });
});
