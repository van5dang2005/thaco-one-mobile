import { type GuestScheduleDto, SecurityCheckInStatus } from '../../types';
import { checkOutBlocker, gateModeOf, isOfficeHours, qrLinkOf, receptionTally, toVisit, visitPhase } from '../visit';

const CODE = '0807954103354f829a1375e0e0cb138e';
const LINK = `https://uatapi01.thaco.com.vn/api/GuestSchedules/mobile/qr/${CODE}`;

/** Shaped like the UAT response of `GET /api/GuestSchedules/mobile/qr/{code}`. */
const dto: GuestScheduleDto = {
  guestScheduleId: '35a1f640-d91e-4e4b-a62b-0ff16ce246d6',
  guestCode: 'AUTO1020260003',
  guestName: 'Đoàn khách mẫu',
  guestCount: 2,
  startDate: '2026-10-20T00:00:00Z',
  endDate: '2026-10-23T00:00:00Z',
  workingUnits: [
    { workingUnitId: 'u-1', workingUnitName: 'Công ty A' },
    { workingUnitId: 'u-2', workingUnitName: ' Công ty B ' },
  ],
  members: [
    { memberId: 'm-1', fullName: 'Khách 1' },
    { memberId: 'm-2', fullName: 'Khách 2' },
  ],
};

describe('qrLinkOf', () => {
  it('calls the link of a THACO guest QR as it is, over HTTPS, up to the code', () => {
    expect(qrLinkOf(`  ${LINK}\n`)).toBe(LINK);
    expect(qrLinkOf(`http://uatapi01.thaco.com.vn/api/GuestSchedules/mobile/qr/${CODE}`)).toBe(LINK);
    expect(qrLinkOf(`${LINK}/check-in?x=1`)).toBe(LINK);
    expect(qrLinkOf(`https://api01.thaco.com.vn/api/GuestSchedules/mobile/qr/${CODE}`)).toBe(`https://api01.thaco.com.vn/api/GuestSchedules/mobile/qr/${CODE}`);
  });

  it('sends a bare code to the guest back-end', () => {
    expect(qrLinkOf(` ${CODE} `)).toBe(`/api/GuestSchedules/mobile/qr/${CODE}`);
    expect(qrLinkOf('a b/c')).toBe('/api/GuestSchedules/mobile/qr/a%20b%2Fc');
  });

  it('calls nothing for an empty code or a link that is no THACO guest QR', () => {
    expect(qrLinkOf('   ')).toBe('');
    expect(qrLinkOf(`https://example.com/api/GuestSchedules/mobile/qr/${CODE}`)).toBe('');
    expect(qrLinkOf(`https://thaco.com.vn.example.com/api/GuestSchedules/mobile/qr/${CODE}`)).toBe('');
    expect(qrLinkOf('https://uatapi01.thaco.com.vn/api/other')).toBe('');
  });
});

describe('toVisit', () => {
  it('maps the schedule, the receiving units as the place', () => {
    expect(toVisit(dto, LINK)).toEqual({
      id: '35a1f640-d91e-4e4b-a62b-0ff16ce246d6',
      link: LINK,
      code: 'AUTO1020260003',
      groupName: 'Đoàn khách mẫu',
      guestCount: 2,
      fromDate: '2026-10-20T00:00:00Z',
      toDate: '2026-10-23T00:00:00Z',
      location: 'Công ty A, Công ty B',
      members: [
        { id: 'm-1', name: 'Khách 1', position: null, identityNumber: null, extra: false, absent: false, receptionIn: null, receptionOut: null },
        { id: 'm-2', name: 'Khách 2', position: null, identityNumber: null, extra: false, absent: false, receptionIn: null, receptionOut: null },
      ],
      status: 'pending',
      canCheckOut: false,
      checkIn: null,
      checkOut: null,
    });
  });

  it('reads where the group stands at the gate, and its passes in and out', () => {
    const inside = toVisit(
      {
        ...dto,
        securityCheckInStatus: SecurityCheckInStatus.CheckedIn,
        canCheckOut: true,
        isViewOnly: false,
        checkIn: { time: '2026-10-22T07:44:53.206Z', note: ' ', actualAmount: 2 },
        checkOut: null,
      },
      LINK,
    );
    expect(inside).toMatchObject({ status: 'checkedIn', canCheckOut: true, checkIn: { at: '2026-10-22T07:44:53.206Z', count: 2, note: null }, checkOut: null });

    const gone = toVisit(
      {
        ...dto,
        securityCheckInStatus: SecurityCheckInStatus.CheckedOut,
        canCheckOut: false,
        isViewOnly: true,
        checkIn: { time: '2026-10-22T09:00:34.831Z', actualAmount: 1 },
        checkOut: { time: '2026-10-22T09:06:33.372Z', note: 'Tự động checkout', actualAmount: 1 },
      },
      LINK,
    );
    expect(gone).toMatchObject({ status: 'checkedOut', canCheckOut: false, checkOut: { at: '2026-10-22T09:06:33.372Z', count: 1, note: 'Tự động checkout' } });
  });

  it('takes a view-only group as gone, whatever else it says', () => {
    const visit = toVisit({ ...dto, securityCheckInStatus: SecurityCheckInStatus.CheckedIn, canCheckOut: true, isViewOnly: true }, LINK);
    expect(visit).toMatchObject({ status: 'checkedOut', canCheckOut: false });
  });

  it('fills gaps: name from the code, head count from the members, one-day period', () => {
    const visit = toVisit({ ...dto, guestName: ' ', guestCount: null, endDate: null, workingUnits: [] }, LINK);
    expect(visit).toMatchObject({ groupName: 'AUTO1020260003', guestCount: 2, toDate: '2026-10-20T00:00:00Z', location: null });
  });

  it('reads each guest and when reception checked them in and out', () => {
    const visit = toVisit(
      {
        ...dto,
        members: [
          {
            memberId: 'm-1',
            fullName: ' Trần Văn B ',
            position: 'Kỹ sư',
            identityNumber: '001',
            phone: '091',
            isExtra: true,
            isAbsent: false,
            checkIn: { id: 'r-1', type: 1, time: '2026-10-23T01:40:00Z', note: null },
            checkOut: { id: 'r-2', type: 2, time: '2026-10-23T09:05:00Z', note: null },
          },
          { memberId: 'm-2', fullName: 'Khách 2', position: ' ', isAbsent: true, checkIn: null, checkOut: null },
        ],
      },
      LINK,
    );
    expect(visit?.members).toEqual([
      { id: 'm-1', name: 'Trần Văn B', position: 'Kỹ sư', identityNumber: '001', extra: true, absent: false, receptionIn: '2026-10-23T01:40:00Z', receptionOut: '2026-10-23T09:05:00Z' },
      { id: 'm-2', name: 'Khách 2', position: null, identityNumber: null, extra: false, absent: true, receptionIn: null, receptionOut: null },
    ]);
  });

  it('finds no visit in an empty answer', () => {
    expect(toVisit(null, LINK)).toBeNull();
    expect(toVisit({ guestScheduleId: '' }, LINK)).toBeNull();
  });
});

describe('receptionTally', () => {
  const guest = (id: string, more: { absent?: boolean; receptionIn?: string; receptionOut?: string } = {}) => ({
    id,
    name: id,
    position: null,
    identityNumber: null,
    extra: false,
    absent: more.absent ?? false,
    receptionIn: more.receptionIn ?? null,
    receptionOut: more.receptionOut ?? null,
  });
  const IN = '2026-10-23T01:40:00Z';
  const OUT = '2026-10-23T09:05:00Z';

  it('is done once every guest but the absent is checked out', () => {
    expect(receptionTally([guest('a', { receptionIn: IN, receptionOut: OUT }), guest('b', { absent: true })])).toEqual({ expected: 1, checkedIn: 1, checkedOut: 1, done: true });
  });

  it('waits on a guest still inside or never checked in', () => {
    expect(receptionTally([guest('a', { receptionIn: IN, receptionOut: OUT }), guest('b', { receptionIn: IN }), guest('c')])).toEqual({ expected: 3, checkedIn: 2, checkedOut: 1, done: false });
  });

  it('counts a check-out alone as in and out (after hours the server writes both)', () => {
    expect(receptionTally([guest('a', { receptionOut: OUT })])).toEqual({ expected: 1, checkedIn: 1, checkedOut: 1, done: true });
  });

  it('is never done without a guest to expect', () => {
    expect(receptionTally([]).done).toBe(false);
    expect(receptionTally([guest('a', { absent: true })]).done).toBe(false);
  });
});

describe('visitPhase', () => {
  it('counts the days of the period in Vietnam time', () => {
    const visit = toVisit(dto, LINK)!;
    expect(visitPhase(visit, new Date('2026-10-16T07:00:00Z'))).toEqual({ kind: 'upcoming', day: -3, days: 4 });
    expect(visitPhase(visit, new Date('2026-10-21T03:00:00Z'))).toEqual({ kind: 'ongoing', day: 2, days: 4 });
    expect(visitPhase(visit, new Date('2026-10-24T03:00:00Z'))).toEqual({ kind: 'ended', day: 5, days: 4 });
  });
});

describe('gateModeOf', () => {
  it('lets a waiting group in, a group inside out when allowed, and only shows the rest', () => {
    expect(gateModeOf({ status: 'pending', canCheckOut: false })).toBe('in');
    expect(gateModeOf({ status: 'checkedIn', canCheckOut: true })).toBe('out');
    expect(gateModeOf({ status: 'checkedIn', canCheckOut: false })).toBe('view');
    expect(gateModeOf({ status: 'checkedOut', canCheckOut: false })).toBe('view');
    expect(gateModeOf({ status: 'rejected', canCheckOut: false })).toBe('view');
  });
});

describe('checkOutBlocker', () => {
  it('names why a group may not leave, as the API would', () => {
    expect(checkOutBlocker({ status: 'checkedIn' })).toBe('RECEPTION_CHECKIN_REQUIRED');
    expect(checkOutBlocker({ status: 'checkedOut' })).toBe('ALREADY_CHECKED_OUT');
    expect(checkOutBlocker({ status: 'pending' })).toBe('CHECKIN_REQUIRED');
    expect(checkOutBlocker({ status: 'rejected' })).toBe('INVALID_SCHEDULE_STATE');
  });
});

describe('isOfficeHours', () => {
  it('runs from 08:00 up to, not including, 17:00 Vietnam time', () => {
    expect(isOfficeHours(new Date('2026-10-23T00:59:00Z'))).toBe(false); // 07:59
    expect(isOfficeHours(new Date('2026-10-23T01:00:00Z'))).toBe(true); // 08:00
    expect(isOfficeHours(new Date('2026-10-23T09:59:00Z'))).toBe(true); // 16:59
    expect(isOfficeHours(new Date('2026-10-23T10:00:00Z'))).toBe(false); // 17:00
    expect(isOfficeHours(new Date('2026-10-25T03:00:00Z'))).toBe(true); // Sunday 10:00, every day counts
  });
});
