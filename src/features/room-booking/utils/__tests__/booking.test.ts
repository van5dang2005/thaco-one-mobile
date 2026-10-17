import { shortRoomNames } from '../booking';

const room = (id: string, name: string | null) => ({ id, name });

describe('shortRoomNames', () => {
  it('drops the words every room shares', () => {
    expect(shortRoomNames([room('a', 'Phòng họp 18.1'), room('b', 'Phòng họp 18.2'), room('c', 'Phòng họp 19.4')])).toEqual({ a: '18.1', b: '18.2', c: '19.4' });
  });

  it('compares the shared words without case and capitalizes what is left', () => {
    expect(shortRoomNames([room('a', 'Phòng họp lớn'), room('b', 'phòng Họp nhỏ')])).toEqual({ a: 'Lớn', b: 'Nhỏ' });
  });

  it('keeps names whole when stripping would leave one empty', () => {
    expect(shortRoomNames([room('a', 'Phòng họp'), room('b', 'Phòng họp VIP')])).toEqual({ a: 'Phòng họp', b: 'Phòng họp VIP' });
  });

  it('keeps a single room whole', () => {
    expect(shortRoomNames([room('a', 'Phòng họp 18.1')])).toEqual({ a: 'Phòng họp 18.1' });
  });

  it('copes with missing names', () => {
    expect(shortRoomNames([room('a', null), room('b', 'Phòng 2')])).toEqual({ a: '', b: 'Phòng 2' });
  });
});
