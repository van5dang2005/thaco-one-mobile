/**
 * Pure booking rules. Each function mirrors a back-end handler (noted inline) so the UI only offers
 * actions the server will accept; the server remains the authority.
 */
import type { RoomDepartment, RoomUser } from '@/core/session/userTypes';
import { sameId } from '@/core/session/userTypes';
import { addDays, diffDays, formatMinutes, minutesOfDay, parseServerDate, parseTimeOfDay, time, toDateKey, todayKey, weekdayOf, type DateKey } from '@/core/time/vn';

import {
  ApprovalActionType,
  BookingStatus,
  type AreaDetail,
  type ApprovalStepDto,
  type BookingApprovalHandlerDto,
  type BookingDto,
  type RoomDto,
} from '../types';

export type Recurrence = 'none' | 'daily' | 'weekly';
export type Phase = 'upcoming' | 'live' | 'past';

export const EXTEND_GRACE_MINUTES = 30;
export const MAX_SESSIONS = 60;
export const MAX_DOCUMENTS = 5;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const bookingFrom = (b: Pick<BookingDto, 'from'>) => parseServerDate(b.from);
export const bookingTo = (b: Pick<BookingDto, 'to'>) => parseServerDate(b.to);

/** "Đang diễn ra / Đã diễn ra" is derived on the client; approved bookings never change status by themselves. */
export function bookingPhase(b: BookingDto, now = new Date()): Phase {
  const from = bookingFrom(b);
  const to = bookingTo(b);
  if (!from || !to || now < from) return 'upcoming';
  if (now < to) return 'live';
  return 'past';
}

/** ExtendBookingCommandHandler: from ≤ now ≤ to + 30 min. */
export function isInExtendWindow(b: BookingDto, now = new Date()) {
  const from = bookingFrom(b);
  const to = bookingTo(b);
  if (!from || !to) return false;
  return now >= from && now.getTime() <= to.getTime() + EXTEND_GRACE_MINUTES * 60_000;
}

/**
 * Session days of a booking request — CreateMultiDayBookingCommandHandler: from the date of `from`
 * to the date of `to`, stepping (Daily=1 | Weekly=7) × interval days, skipping Sundays unless the
 * Sunday is the last day.
 */
export function sessionDates(startKey: DateKey, endKey: DateKey, recurrence: Recurrence, interval: number): DateKey[] {
  if (recurrence === 'none' || endKey < startKey) return [startKey];
  const step = (recurrence === 'weekly' ? 7 : 1) * Math.max(1, interval);
  const dates: DateKey[] = [];
  for (let key = startKey; key <= endKey && dates.length <= MAX_SESSIONS; key = addDays(key, step)) {
    if (weekdayOf(key) !== 0 || key === endKey) dates.push(key);
  }
  return dates;
}

const activeStatuses: number[] = [BookingStatus.Waiting, BookingStatus.Approved, BookingStatus.Finished];

function overlapsSlot(b: BookingDto, dateKey: DateKey, startMin: number, endMin: number) {
  const from = bookingFrom(b);
  const to = bookingTo(b);
  if (!from || !to || toDateKey(from) !== dateKey) return false;
  return minutesOfDay(from) < endMin && minutesOfDay(to) > startMin;
}

// ---- cross-level restrictions -------------------------------------------------------------------

export type CrossLevel = 'allowed' | 'blocked' | 'unknown';

export type CrossLevelContext = {
  userDepartments: RoomDepartment[];
  areas: AreaDetail[];
  /** id → parentId for every department; when missing, only the user's own department and its parent are known. */
  parentMap?: Map<string, string | null>;
};

function ancestorsOf(id: string, ctx: CrossLevelContext): string[] {
  if (!ctx.parentMap) {
    const own = ctx.userDepartments.find((d) => sameId(d.id, id));
    return [id, own?.parentId].filter((x): x is string => !!x).map((x) => x.toLowerCase());
  }
  const chain: string[] = [];
  let current: string | null | undefined = id.toLowerCase();
  for (let guard = 0; current && guard < 50; guard += 1) {
    chain.push(current);
    current = ctx.parentMap.get(current) ?? null;
  }
  return chain;
}

/** BookingService.ValidateCrossLevelAsync: is one of my departments the target or below it? */
function isDescendantOfAny(ctx: CrossLevelContext, targets: string[]) {
  const wanted = new Set(targets.map((t) => t.toLowerCase()));
  return ctx.userDepartments.some((d) => ancestorsOf(d.id, ctx).some((id) => wanted.has(id)));
}

export function crossLevelStatus(room: RoomDto, ctx: CrossLevelContext): CrossLevel {
  if (!room.isDisableCrossLevelArea && !room.isDisableCrossLevelDepartment) return 'allowed';
  if (!ctx.userDepartments.length) return 'unknown';
  const exact = !!ctx.parentMap;
  if (room.isDisableCrossLevelDepartment && room.departmentId && !isDescendantOfAny(ctx, [room.departmentId])) {
    return exact ? 'blocked' : 'unknown';
  }
  const area = ctx.areas.find((a) => sameId(a.id, room.areaId));
  const directAreaLink = ctx.userDepartments.some((d) => d.areas?.some((a) => sameId(a.id, room.areaId)));
  if (directAreaLink) return 'allowed';
  if (!area?.departments?.length) return exact ? 'blocked' : 'unknown';
  if (!isDescendantOfAny(ctx, area.departments.map((d) => d.id))) return exact ? 'blocked' : 'unknown';
  return 'allowed';
}

// ---- room suitability (wizard step 2) ----------------------------------------------------------

export type BlockReason =
  | { code: 'inactive' }
  | { code: 'crossLevel' }
  | { code: 'outsideHours'; open: string; close: string }
  | { code: 'advance'; days: number }
  | { code: 'conflict'; date: DateKey };

export type RoomWarning = { code: 'pendingOverlap'; date: DateKey } | { code: 'fewerSeats'; seats: number } | { code: 'restricted' };

export type RoomCheck = {
  room: RoomDto;
  selectable: boolean;
  block?: BlockReason;
  warnings: RoomWarning[];
  freeSessions: number;
};

export type RoomCheckInput = {
  room: RoomDto;
  sessions: DateKey[];
  startMin: number;
  endMin: number;
  people: number;
  /** Bookings of the area covering the whole session range. */
  bookings: BookingDto[];
  crossLevel: CrossLevel;
  /** Group being edited; its own sessions never conflict. */
  excludeGroupId?: string | null;
  today?: DateKey;
};

/**
 * Opening hours of a room in Vietnam minutes; the whole day when either one is unset (no limit, like the
 * server). ValidateBookingWithinOperatingHoursAsync compares `openedAt` / `closedAt` with the booking's
 * UTC time of day, so they are UTC times: 00:00–11:00 is 07:00–18:00 in Vietnam. Capped at 24:00.
 */
export function roomHours(room: Pick<RoomDto, 'openedAt' | 'closedAt'> | null | undefined): { open: number; close: number } {
  const open = parseTimeOfDay(room?.openedAt);
  const close = parseTimeOfDay(room?.closedAt);
  if (open === null || close === null) return { open: 0, close: 24 * 60 };
  const offset = time.VN_OFFSET_MS / 60_000;
  return { open: Math.min(open + offset, 24 * 60), close: Math.min(close + offset, 24 * 60) };
}

/**
 * How a room heads its column: a small group line over a short name. A brand before "_" is the group
 * ("MAZDA _Phòng họp 1" → MAZDA / 1); then the leading words every name shares drop out ("Phòng họp 18.1",
 * "Phòng họp 18.2" → 18.1, 18.2) and, where there is no brand, become the group (Phòng họp / 18.1). Names stay whole
 * with a single room, or when one name is nothing but the shared words.
 *
 * When the names do not all start alike (Chu Lai: "Phòng họp 1.1"…, "Hội trường 01", "Phòng Khánh tiết"), each takes
 * the longest start it shares with another room (Phòng họp / 1.1, Phòng / Khánh tiết), or else its trailing number
 * (Hội trường / 01). A name that is all start, or a lone word, stays whole.
 */
export function roomLabels(rooms: Pick<RoomDto, 'id' | 'name'>[]): Record<string, { group: string; name: string }> {
  const parts = rooms.map((r) => {
    const full = (r.name ?? '').trim();
    const cut = full.indexOf('_');
    return cut > 0 ? { group: full.slice(0, cut).trim(), rest: full.slice(cut + 1).trim() } : { group: '', rest: full };
  });
  const words = parts.map((p) => p.rest.split(/\s+/).filter(Boolean));
  const sameStart = (a: string[], b: string[]) => {
    let n = 0;
    while (n < a.length && n < b.length && a[n].toLowerCase() === b[n].toLowerCase()) n++;
    return n;
  };
  let shared = 0;
  while (rooms.length > 1 && words.every((w) => shared < w.length && w[shared].toLowerCase() === words[0][shared].toLowerCase())) shared++;
  const mixed = shared === 0 && words.filter((w) => w.length).length > 1;
  if (words.some((w) => w.length === shared)) shared = 0;
  const common = shared ? words[0].slice(0, shared).join(' ') : '';
  /** Mixed names: how many leading words of room `i` make its group. */
  const ownLead = (i: number) => {
    const w = words[i];
    const best = Math.max(0, ...words.map((other, j) => (j === i ? 0 : sameStart(w, other))));
    if (best >= w.length) return 0;
    if (best > 0) return best;
    return w.length > 1 && /\d/.test(w[w.length - 1]) ? w.length - 1 : 0;
  };
  return Object.fromEntries(
    rooms.map((r, i) => {
      const lead = shared || (mixed ? ownLead(i) : 0);
      if (!lead) return [r.id, { group: parts[i].group, name: parts[i].rest }];
      const rest = words[i].slice(lead).join(' ');
      return [r.id, { group: parts[i].group || common || words[i].slice(0, lead).join(' '), name: rest.charAt(0).toUpperCase() + rest.slice(1) }];
    }),
  );
}

export function evaluateRoom({ room, sessions, startMin, endMin, people, bookings, crossLevel, excludeGroupId, today = todayKey() }: RoomCheckInput): RoomCheck {
  const warnings: RoomWarning[] = [];
  const blocked = (block: BlockReason): RoomCheck => ({ room, selectable: false, block, warnings, freeSessions: 0 });

  if (room.isActive === false) return blocked({ code: 'inactive' });
  if (crossLevel === 'blocked') return blocked({ code: 'crossLevel' });

  // ValidateBookingWithinOperatingHoursAsync (opening hours are UTC on the server, see roomHours).
  const { open, close } = roomHours(room);
  if (startMin < open || endMin > close) {
    return blocked({ code: 'outsideHours', open: formatMinutes(open), close: formatMinutes(close) });
  }

  const last = sessions[sessions.length - 1];
  if (room.isDayLimited && room.maxAdvanceRegistrationDays != null && diffDays(today, last) > room.maxAdvanceRegistrationDays) {
    return blocked({ code: 'advance', days: room.maxAdvanceRegistrationDays });
  }

  const mine = bookings.filter(
    (b) => sameId(b.roomId ?? b.room?.id, room.id) && activeStatuses.includes(b.status ?? 0) && !(excludeGroupId && sameId(b.groupId, excludeGroupId)),
  );

  if (room.isDisableOverlappingTimes) {
    // HasBookingConflictAsync is coarse: any active booking whose dates intersect the series' date
    // span and whose time of day overlaps, even on a non-session day.
    const first = sessions[0];
    const clash = mine.find((b) => {
      const from = bookingFrom(b);
      const to = bookingTo(b);
      if (!from || !to) return false;
      const day = toDateKey(from);
      return day >= first && day <= last && minutesOfDay(from) < endMin && minutesOfDay(to) > startMin;
    });
    if (clash) return blocked({ code: 'conflict', date: toDateKey(bookingFrom(clash) ?? new Date()) });
  } else {
    // Overlap allowed by the room, but an already-approved booking means the slot is effectively taken.
    for (const day of sessions) {
      const approved = mine.find((b) => b.status === BookingStatus.Approved && overlapsSlot(b, day, startMin, endMin));
      if (approved) return blocked({ code: 'conflict', date: day });
    }
    const pendingDay = sessions.find((day) => mine.some((b) => b.status === BookingStatus.Waiting && overlapsSlot(b, day, startMin, endMin)));
    if (pendingDay) warnings.push({ code: 'pendingOverlap', date: pendingDay });
  }

  if (crossLevel === 'unknown') warnings.push({ code: 'restricted' });
  if (room.numberOfSeats != null && room.numberOfSeats < people) warnings.push({ code: 'fewerSeats', seats: room.numberOfSeats });

  const freeSessions = sessions.filter((day) => !mine.some((b) => overlapsSlot(b, day, startMin, endMin))).length;
  return { room, selectable: true, warnings, freeSessions };
}

// ---- room schedule (3a) -------------------------------------------------------------------------

export type TimelineBlock = {
  key: string;
  kind: 'approved' | 'pending' | 'cluster' | 'finished';
  bookings: BookingDto[];
  startMin: number;
  endMin: number;
};

/** Blocks of one room for one day; overlapping pending bookings are merged into one "N phiếu chờ" block. */
export function roomDayBlocks(bookings: BookingDto[], dateKey: DateKey): TimelineBlock[] {
  const slots = bookings
    .filter((b) => activeStatuses.includes(b.status ?? 0))
    .map((b) => {
      const from = bookingFrom(b);
      const to = bookingTo(b);
      if (!from || !to || toDateKey(from) !== dateKey) return null;
      return { b, startMin: minutesOfDay(from), endMin: toDateKey(to) === dateKey ? minutesOfDay(to) : 24 * 60 };
    })
    .filter((x): x is { b: BookingDto; startMin: number; endMin: number } => !!x);

  const blocks: TimelineBlock[] = slots
    .filter(({ b }) => b.status !== BookingStatus.Waiting)
    .map(({ b, startMin, endMin }) => ({
      key: b.id,
      kind: b.status === BookingStatus.Finished ? 'finished' : 'approved',
      bookings: [b],
      startMin,
      endMin,
    }));

  const pending = slots.filter(({ b }) => b.status === BookingStatus.Waiting).sort((a, c) => a.startMin - c.startMin);
  let cluster: typeof pending = [];
  let clusterEnd = -1;
  const flush = () => {
    if (!cluster.length) return;
    blocks.push({
      key: cluster.map((c) => c.b.id).join('+'),
      kind: cluster.length > 1 ? 'cluster' : 'pending',
      bookings: cluster.map((c) => c.b),
      startMin: cluster[0].startMin,
      endMin: clusterEnd,
    });
    cluster = [];
  };
  pending.forEach((slot) => {
    if (cluster.length && slot.startMin >= clusterEnd) flush();
    cluster.push(slot);
    clusterEnd = cluster.length === 1 ? slot.endMin : Math.max(clusterEnd, slot.endMin);
  });
  flush();
  return blocks;
}

/** "09:30" for blocks up to an hour, "10:00–11:30" for longer ones. */
export const blockTime = (b: { startMin: number; endMin: number }) =>
  b.endMin - b.startMin <= 60 ? formatMinutes(b.startMin) : `${formatMinutes(b.startMin)}–${formatMinutes(b.endMin)}`;

/** A room is "in use" when an approved booking covers the current minute. */
export function isRoomBusy(blocks: TimelineBlock[], nowMin: number) {
  return blocks.some((b) => (b.kind === 'approved' || b.kind === 'finished') && nowMin >= b.startMin && nowMin < b.endMin);
}

/** Stretches of `from`–`to` that no block covers, `min` minutes or longer: the free slots of a room's lane. */
export function freeGaps(blocks: Pick<TimelineBlock, 'startMin' | 'endMin'>[], from: number, to: number, min = 15) {
  const gaps: { startMin: number; endMin: number }[] = [];
  let cursor = from;
  [...blocks]
    .sort((a, b) => a.startMin - b.startMin)
    .forEach((b) => {
      const end = Math.min(b.startMin, to);
      if (end - cursor >= min) gaps.push({ startMin: cursor, endMin: end });
      cursor = Math.max(cursor, b.endMin);
    });
  if (to - cursor >= min) gaps.push({ startMin: cursor, endMin: to });
  return gaps;
}

/** What a drag on the selected slot holds: its top edge, its bottom edge, or the whole card. */
export type DragHandle = 'start' | 'end' | 'move';

/**
 * Where a dragged selection lands: `delta` minutes from where it was picked up, in `snap` steps, inside
 * `minStart`–`maxEnd` and never shorter than one step. A worklet: it runs on the UI thread while the finger moves.
 */
export function dragSelection(handle: DragHandle, startMin: number, endMin: number, delta: number, minStart: number, maxEnd: number, snap = 15) {
  'worklet';
  const step = Math.round(delta / snap) * snap;
  if (handle === 'start') return { startMin: Math.max(minStart, Math.min(startMin + step, endMin - snap)), endMin };
  if (handle === 'end') return { startMin, endMin: Math.min(maxEnd, Math.max(endMin + step, startMin + snap)) };
  const span = endMin - startMin;
  const start = Math.max(minStart, Math.min(startMin + step, maxEnd - span));
  return { startMin: start, endMin: start + span };
}

// ---- approval stepper (3e) ----------------------------------------------------------------------

export type StepState = 'approved' | 'rejected' | 'pending' | 'future' | 'notify' | 'skipped';

export type StepView = {
  key: string;
  order: number;
  name?: string | null;
  state: StepState;
  handlers: RoomUser[];
  decidedBy?: RoomUser | null;
  processedAt?: string | null;
  comment?: string | null;
};

/**
 * Rows exist only for approval-type steps reached so far (BookingApprovalService creates the next
 * level when the previous one is approved). Future and notification steps come from the workflow,
 * when the caller is allowed to read it.
 */
export function buildApprovalSteps(rows: BookingApprovalHandlerDto[], workflowSteps: ApprovalStepDto[] | undefined, status: BookingStatus | null | undefined): StepView[] {
  const groups = new Map<string, BookingApprovalHandlerDto[]>();
  rows.forEach((row) => {
    const id = row.approvalHandler?.approvalStep?.id ?? row.approvalHandler?.stepId ?? 'unknown';
    groups.set(id, [...(groups.get(id) ?? []), row]);
  });

  const views: StepView[] = [...groups.entries()].map(([stepId, stepRows]) => {
    const step = stepRows[0].approvalHandler?.approvalStep ?? workflowSteps?.find((s) => sameId(s.id, stepId));
    const handlers = stepRows.map((r) => r.approvalHandler?.user).filter((u): u is RoomUser => !!u);
    const rejected = stepRows.find((r) => r.isApproved === false);
    const approved = stepRows.find((r) => r.isApproved === true);
    const decided = rejected ?? approved;
    const decidedBy = decided ? (handlers.find((u) => sameId(u.id, decided.processedBy)) ?? decided.approvalHandler?.user) : null;
    let state: StepState = 'pending';
    if (rejected) state = 'rejected';
    else if (stepRows.every((r) => r.isApproved === true)) state = 'approved';
    else if (status !== BookingStatus.Waiting) state = 'skipped';
    return {
      key: stepId,
      order: step?.order ?? 0,
      name: step?.name,
      state,
      handlers,
      decidedBy,
      processedAt: decided?.processedAt,
      comment: decided?.comment,
    };
  });

  const known = new Set(views.map((v) => v.key.toLowerCase()));
  const lastOrder = Math.max(0, ...views.map((v) => v.order));
  (workflowSteps ?? [])
    .filter((s) => s.isActive !== false && !known.has(s.id.toLowerCase()))
    .forEach((s) => {
      const notify = s.actionType === ApprovalActionType.Notify;
      if (!notify && (s.order ?? 0) <= lastOrder) return;
      views.push({
        key: s.id,
        order: s.order ?? 0,
        name: s.name,
        state: notify ? 'notify' : status === BookingStatus.Waiting ? 'future' : 'skipped',
        handlers: (s.approvalHandlers ?? []).map((h) => h.user).filter((u): u is RoomUser => !!u),
      });
    });

  return views.sort((a, b) => a.order - b.order || (a.state === 'notify' ? 1 : 0) - (b.state === 'notify' ? 1 : 0));
}

/** "Cấp 2/2": the level being decided (or the last one reached) over the number of approval levels. */
export function levelProgress(steps: StepView[]) {
  const levels = [...new Set(steps.filter((s) => s.state !== 'notify').map((s) => s.order))].sort((a, b) => a - b);
  if (!levels.length) return null;
  const current = steps.find((s) => s.state === 'pending' || s.state === 'rejected')?.order ?? Math.max(...steps.filter((s) => s.state === 'approved').map((s) => s.order), levels[0]);
  return { current: levels.indexOf(current) + 1 || 1, total: levels.length };
}

export function approvalLevelCount(steps?: ApprovalStepDto[] | null) {
  return (steps ?? []).filter((s) => s.isActive !== false && s.actionType === ApprovalActionType.Approve).length;
}

// ---- in-meeting actions (3f) --------------------------------------------------------------------

export type ExtendOption = { minutes: number; taken: boolean };

/** Gaps of the quick extend chips, in minutes after the current end. */
export const EXTEND_STEPS = [15, 30, 60];

/**
 * New end-time choices: same day, after the current end, within opening hours; taken slots struck
 * out. `deltas` defaults to the chips plus 90'; "Khác" asks for every quarter hour.
 */
export function extendOptions(b: BookingDto, room: RoomDto | null | undefined, sameDayBookings: BookingDto[], deltas: number[] = [...EXTEND_STEPS, 90]): ExtendOption[] {
  const from = bookingFrom(b);
  const to = bookingTo(b);
  if (!from || !to) return [];
  const end = minutesOfDay(to);
  const { close } = roomHours(room);
  const day = toDateKey(to);
  return deltas
    .map((delta) => end + delta)
    .filter((m) => m <= close && m < 24 * 60)
    .map((minutes) => ({
      minutes,
      taken: sameDayBookings.some((o) => blocksExtension(o, b, room) && overlapsSlot(o, day, end, minutes)),
    }));
}

/** Every quarter hour from the current end to closing time ("Khác"). */
export function allExtendDeltas(b: BookingDto, room: RoomDto | null | undefined): number[] {
  const to = bookingTo(b);
  if (!to) return [];
  const { close } = roomHours(room);
  const span = Math.min(close, 24 * 60 - 15) - minutesOfDay(to);
  return Array.from({ length: Math.max(0, Math.floor(span / 15)) }, (_, i) => (i + 1) * 15);
}

function blocksExtension(o: BookingDto, b: BookingDto, room: RoomDto | null | undefined) {
  return (
    !sameId(o.id, b.id) &&
    sameId(o.roomId ?? o.room?.id, b.roomId ?? b.room?.id) &&
    (o.status === BookingStatus.Approved || (!!room?.isDisableOverlappingTimes && o.status === BookingStatus.Waiting))
  );
}

/** Minute of day until which the room stays free after the meeting: next blocking booking or closing time. */
export function freeUntil(b: BookingDto, room: RoomDto | null | undefined, sameDayBookings: BookingDto[]): number | null {
  const to = bookingTo(b);
  if (!to) return null;
  const end = minutesOfDay(to);
  const day = toDateKey(to);
  const { close } = roomHours(room);
  const next = sameDayBookings
    .filter((o) => blocksExtension(o, b, room) && toDateKey(bookingFrom(o) ?? new Date(0)) === day)
    .map((o) => minutesOfDay(bookingFrom(o)!))
    .filter((m) => m >= end);
  return Math.min(close, ...next);
}

// ---- action matrix (CLAUDE.md §3.4) -------------------------------------------------------------

export type BookingPermissions = {
  isCreator: boolean;
  isApprover: boolean;
  isParticipant: boolean;
  canSeeContent: boolean;
  canEdit: boolean;
  canCancel: boolean;
  /** Approved + room forbids organiser cancellation: show the policy banner instead of the button. */
  cancelBlockedByPolicy: boolean;
  canExtend: boolean;
  canEndEarly: boolean;
};

export function bookingPermissions(b: BookingDto, myId: string | undefined, rows: BookingApprovalHandlerDto[], now = new Date()): BookingPermissions {
  const status = b.status ?? 0;
  const mine = rows.filter((r) => sameId(r.approvalHandler?.userId ?? r.approvalHandler?.user?.id, myId));
  const isCreator = sameId(b.user?.id, myId);
  const isApprover = mine.length > 0;
  const isParticipant = (b.participants ?? []).some((p) => sameId(p.userId ?? p.user?.id, myId));
  const phase = bookingPhase(b, now);
  const open = status === BookingStatus.Waiting || status === BookingStatus.Approved;
  const policyBlocks = !!b.room?.isDisableSubscriberCancel && status === BookingStatus.Approved && !isApprover;

  return {
    isCreator,
    isApprover,
    isParticipant,
    canSeeContent: !b.isConfidentialContent || isCreator || isApprover || isParticipant,
    canEdit: isCreator && status === BookingStatus.Waiting && phase !== 'past',
    canCancel: (isCreator || isApprover) && open && phase !== 'past' && !policyBlocks,
    cancelBlockedByPolicy: isCreator && open && policyBlocks && phase !== 'past',
    canExtend: isCreator && status === BookingStatus.Approved && isInExtendWindow(b, now),
    canEndEarly: isCreator && status === BookingStatus.Approved && phase === 'live',
  };
}
