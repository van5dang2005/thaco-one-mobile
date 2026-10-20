import { directory, incomingSeed, me, sharedSeed, stampSeed, taskSeed } from '../__fixtures__/documents';
import type { Assignment } from '../../types';
import { assignmentError, MAX_CHU_TRI, roleCounts, toggleRole, withoutProcessing } from '../assignment';
import { deadlineOf } from '../deadline';
import { documentSummary, incomingCounts, inIncomingTab, sortIncoming } from '../incoming';
import { groupShared, matchesSharedFilter, sharedFilterCounts } from '../shared';
import { DEFAULT_GRANT, grantable, isLocked, toggleGrant } from '../sharing';
import { boldRuns, indexPeople, joinNames, matchesQuery, searchPeople, shortUnit } from '../text';
import { addMonths, dayTones, inMonth, monthWeeks, taskCounts, taskProgress, tasksOnDay, taskStage, visibleMonths, weekOf, withOverdue } from '../tasks';

const TODAY = '2026-10-16';
const [ha, long, mai] = ['nv-ha', 'nv-long', 'nv-mai'].map((id) => directory.find((p) => p.id === id)!);

describe('deadlineOf', () => {
  it('counts down, then shows the date further out', () => {
    expect(deadlineOf('2026-10-20', TODAY)).toEqual({ state: 'left', days: 4 });
    expect(deadlineOf('2026-10-16', TODAY)).toEqual({ state: 'today' });
    expect(deadlineOf('2026-10-13', TODAY)).toEqual({ state: 'overdue', days: 3 });
    expect(deadlineOf('2026-10-30', TODAY)).toEqual({ state: 'date', han: '2026-10-30' });
    expect(deadlineOf(undefined, TODAY)).toBeNull();
  });
});

describe('role assignment', () => {
  it('gives one role per person and toggles it off on a second tap', () => {
    let list: Assignment[] = [];
    list = toggleRole(list, ha, 'phoi_hop').assignments;
    list = toggleRole(list, ha, 'chu_tri').assignments;
    expect(list).toEqual([{ person: ha, role: 'chu_tri' }]);
    expect(toggleRole(list, ha, 'chu_tri').assignments).toEqual([]);
  });

  it(`refuses more than ${MAX_CHU_TRI} chủ trì`, () => {
    let list = toggleRole([], me, 'chu_tri').assignments;
    list = toggleRole(list, ha, 'chu_tri').assignments;
    const third = toggleRole(list, long, 'chu_tri');
    expect(third.rejected).toBe('max_chu_tri');
    expect(roleCounts(third.assignments).chu_tri).toBe(2);
  });

  it('needs a chủ trì unless nobody has to process it', () => {
    const list: Assignment[] = [{ person: mai, role: 'de_biet' }];
    expect(assignmentError(list, false)).toBe('need_chu_tri');
    expect(assignmentError(list, true)).toBeNull();
    expect(assignmentError([], true)).toBe('need_anyone');
    expect(withoutProcessing([{ person: ha, role: 'chu_tri' }])).toEqual([{ person: ha, role: 'de_biet' }]);
  });
});

describe('share permissions', () => {
  const mine = { xem: true, tai: false, chiaSe: true };

  it('cannot grant what I do not hold', () => {
    expect(grantable(mine).tai).toBe(false);
    expect(toggleGrant(DEFAULT_GRANT, 'tai', mine)).toEqual(DEFAULT_GRANT);
  });

  it('keeps view on while re-share is on', () => {
    const resharer = toggleGrant({ xem: false, tai: false, chiaSe: false }, 'chiaSe', mine);
    expect(resharer).toEqual({ xem: true, tai: false, chiaSe: true });
    expect(isLocked(resharer, 'xem', mine)).toBe(true);
    expect(toggleGrant(resharer, 'xem', mine)).toEqual(resharer);
  });
});

describe('summary (design numbers)', () => {
  const summary = documentSummary(incomingSeed, sharedSeed, stampSeed, taskSeed, TODAY);

  it('matches the home tiles', () => {
    expect(summary).toMatchObject({ toHandle: 5, toDistribute: 2, returned: 1, toProcess: 3, chuTri: 1, phoiHop: 2, unread: 1, toStamp: 2, toStampDi: 1, toStampNoiBo: 1, overdue: 1, worstOverdueDays: 3, shared: 4, unreadShared: 3, pending: 7 });
  });

  it('keeps a returned document in the distribution and processing tabs', () => {
    const returned = incomingSeed.find((d) => d.soDen === '1241')!;
    expect(inIncomingTab(returned, 'phan_phoi')).toBe(true);
    expect(inIncomingTab(returned, 'xu_ly')).toBe(true);
    expect(sortIncoming(incomingSeed.filter((d) => inIncomingTab(d, 'xu_ly')), 'xu_ly', TODAY)[0].soDen).toBe('1241');
    expect(incomingCounts(incomingSeed).phan_phoi).toBe(2);
  });
});

describe('tasks', () => {
  const tasks = taskSeed;

  it('leaves out documents still waiting for distribution', () => {
    expect(tasks).toHaveLength(8);
    expect(tasks.find((t) => t.soDen === '1248')).toMatchObject({ docId: 'vbd-1248', role: 'chu_tri', from: '2026-10-14', to: '2026-10-20', hasDeadline: true, done: false });
  });

  it('sorts tasks into exclusive tabs', () => {
    const counts = taskCounts(tasks, TODAY);
    expect(counts).toMatchObject({ den_han: 2, qua_han: 1, da_huy: 1 });
    expect(taskStage(tasks.find((t) => t.soDen === '1239')!, TODAY)).toBe('hoan_thanh');
  });

  it('keeps an overdue task on the days after its deadline', () => {
    const overdue = tasks.find((t) => t.soDen === '1236')!;
    expect(tasksOnDay([overdue], '2026-10-15', TODAY)).toHaveLength(1);
    expect(taskProgress(overdue, TODAY)).toBe(1);
  });

  it('asks for the months the calendar shows', () => {
    expect(visibleMonths(TODAY, false)).toEqual(['2026-10']);
    expect(visibleMonths('2026-10-01', false)).toEqual(['2026-09', '2026-10']);
    expect(visibleMonths(TODAY, true)).toEqual(['2026-09', '2026-10', '2026-11']);
  });

  it('keeps overdue tasks a month request leaves out, preferring the month copy', () => {
    const overdue = tasks.find((t) => t.soDen === '1236')!;
    const fresh = { ...tasks.find((t) => t.soDen === '1248')!, done: true };
    const merged = withOverdue([fresh], tasks, TODAY);
    expect(merged.map((t) => t.soDen).sort()).toEqual(['1236', '1248']);
    expect(merged.find((t) => t.soDen === '1248')!.done).toBe(true);
    expect(withOverdue([overdue, overdue], [], TODAY)).toHaveLength(1);
  });

  it('draws the week Monday to Sunday with role dots', () => {
    const week = weekOf(TODAY);
    expect(week[0]).toBe('2026-10-12');
    expect(week[6]).toBe('2026-10-18');
    expect(dayTones(tasks, '2026-10-16', TODAY)).toContain('chu_tri');
  });
});

describe('shared documents', () => {
  it('filters and groups by day', () => {
    expect(sharedFilterCounts(sharedSeed)).toEqual({ tat_ca: 5, chua_xem: 3, theo_doi: 1 });
    expect(matchesSharedFilter(sharedSeed.find((d) => d.daHuy)!, 'chua_xem')).toBe(false);
    expect(groupShared(sharedSeed, '2026-10-15').map((g) => g.key)).toEqual(['today', 'recent']);
  });
});

describe('text helpers', () => {
  it('finds Vietnamese names typed without diacritics', () => {
    expect(matchesQuery('bao', 'Hoàng Gia Bảo')).toBe(true);
    expect(matchesQuery('dang anh', 'Đặng Anh Tuấn')).toBe(true);
    expect(matchesQuery('', 'anything')).toBe(true);
    expect(matchesQuery('xyz', 'Trần Thu Hà')).toBe(false);
  });

  it('searches a folded people index and names a unit by its last level', () => {
    const index = indexPeople(directory);
    expect(searchPeople(index, 'bao', 5).map((p) => p.id)).toEqual(['nv-bao']);
    expect(searchPeople(index, '', 2)).toHaveLength(2);
    expect(searchPeople(index, 'ban cntt', 20, (p) => p.id === 'nv-khoa')).toHaveLength(directory.length - 1);
    expect(shortUnit('THACO GROUP/Các Ban NVQT/ Ban CNTT ')).toBe('Ban CNTT');
    expect(shortUnit('')).toBe('');
  });

  it('joins names and splits bold runs', () => {
    expect(joinNames(['Bạn', 'Hà', 'Long'], 'và')).toBe('Bạn, Hà và Long');
    expect(boldRuns('quay về **Hùng** để')).toEqual([
      { text: 'quay về ', bold: false },
      { text: 'Hùng', bold: true },
      { text: ' để', bold: false },
    ]);
  });
});

describe('month calendar', () => {
  it('clamps the day when moving between months', () => {
    expect(inMonth('2026-10-31', 2026, 11)).toBe('2026-11-30');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('lays a month out in Monday-first weeks', () => {
    const weeks = monthWeeks(2026, 10);
    expect(weeks[0][0]).toBe('2026-09-28');
    expect(weeks[weeks.length - 1][6]).toBe('2026-11-01');
    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });
});
