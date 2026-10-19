import { dragSelection, freeGaps, roomLabels } from '../booking';

const room = (id: string, name: string | null) => ({ id, name });

describe('roomLabels', () => {
  it('drops the words every room shares and makes them the group', () => {
    expect(roomLabels([room('a', 'Phòng họp 18.1'), room('b', 'Phòng họp 18.2'), room('c', 'Phòng họp 19.4')])).toEqual({
      a: { group: 'Phòng họp', name: '18.1' },
      b: { group: 'Phòng họp', name: '18.2' },
      c: { group: 'Phòng họp', name: '19.4' },
    });
  });

  it('takes the brand before "_" as the group, then drops the shared words', () => {
    expect(roomLabels([room('a', 'MAZDA _Phòng họp 1'), room('b', 'Peugeot_Phòng họp 01'), room('c', 'KIA_Phòng họp 2')])).toEqual({
      a: { group: 'MAZDA', name: '1' },
      b: { group: 'Peugeot', name: '01' },
      c: { group: 'KIA', name: '2' },
    });
  });

  it('compares the shared words without case and capitalizes what is left', () => {
    expect(roomLabels([room('a', 'Phòng họp lớn'), room('b', 'phòng Họp nhỏ')])).toEqual({
      a: { group: 'Phòng họp', name: 'Lớn' },
      b: { group: 'Phòng họp', name: 'Nhỏ' },
    });
  });

  it('keeps names whole when stripping would leave one empty', () => {
    expect(roomLabels([room('a', 'Phòng họp'), room('b', 'Phòng họp VIP')])).toEqual({
      a: { group: '', name: 'Phòng họp' },
      b: { group: '', name: 'Phòng họp VIP' },
    });
  });

  it('keeps a single room whole', () => {
    expect(roomLabels([room('a', 'Phòng họp 18.1')])).toEqual({ a: { group: '', name: 'Phòng họp 18.1' } });
  });

  it('copes with missing names', () => {
    expect(roomLabels([room('a', null), room('b', 'Phòng 2')])).toEqual({ a: { group: '', name: '' }, b: { group: '', name: 'Phòng 2' } });
  });
});

describe('freeGaps', () => {
  const block = (startMin: number, endMin: number) => ({ startMin, endMin });

  it('is the whole range when nothing is booked', () => {
    expect(freeGaps([], 420, 1200)).toEqual([{ startMin: 420, endMin: 1200 }]);
  });

  it('leaves out booked stretches, whatever order the blocks come in', () => {
    expect(freeGaps([block(780, 900), block(540, 690)], 420, 1200)).toEqual([
      { startMin: 420, endMin: 540 },
      { startMin: 690, endMin: 780 },
      { startMin: 900, endMin: 1200 },
    ]);
  });

  it('merges overlapping blocks and drops gaps shorter than the minimum', () => {
    expect(freeGaps([block(540, 660), block(600, 720), block(730, 800)], 540, 800)).toEqual([]);
  });

  it('clips to the range: blocks before it, across its ends or after it', () => {
    expect(freeGaps([block(400, 500), block(1100, 1300)], 480, 1200)).toEqual([{ startMin: 500, endMin: 1100 }]);
    expect(freeGaps([block(1250, 1300)], 480, 1200)).toEqual([{ startMin: 480, endMin: 1200 }]);
  });
});

describe('dragSelection', () => {
  // 09:00–10:00, free from 08:00 to 11:30.
  const drag = (handle: 'start' | 'end' | 'move', delta: number) => dragSelection(handle, 540, 600, delta, 480, 690);

  it('moves the whole slot in 15-minute steps, keeping its length', () => {
    expect(drag('move', 22)).toEqual({ startMin: 555, endMin: 615 });
    expect(drag('move', -7)).toEqual({ startMin: 540, endMin: 600 });
  });

  it('stops the slot at the ends of its free stretch', () => {
    expect(drag('move', 300)).toEqual({ startMin: 630, endMin: 690 });
    expect(drag('move', -300)).toEqual({ startMin: 480, endMin: 540 });
  });

  it('moves one edge, never past the other one', () => {
    expect(drag('end', 45)).toEqual({ startMin: 540, endMin: 645 });
    expect(drag('end', -120)).toEqual({ startMin: 540, endMin: 555 });
    expect(drag('start', -30)).toEqual({ startMin: 510, endMin: 600 });
    expect(drag('start', 120)).toEqual({ startMin: 585, endMin: 600 });
  });

  it('keeps each edge inside the free stretch', () => {
    expect(drag('end', 300)).toEqual({ startMin: 540, endMin: 690 });
    expect(drag('start', -300)).toEqual({ startMin: 480, endMin: 600 });
  });
});
