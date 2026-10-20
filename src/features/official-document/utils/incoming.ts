import { diffDays, todayKey, type DateKey } from '@/core/time/vn';

import type { DocTask, IncomingDoc, SharedDoc, StampDoc } from '../types';
import { isOverdue } from './deadline';
import { taskStage } from './tasks';

/** Tabs of "Văn bản đến" (8c). */
export type IncomingTab = 'phan_phoi' | 'xu_ly' | 'da_xu_ly';

export const INCOMING_TABS: readonly IncomingTab[] = ['phan_phoi', 'xu_ly', 'da_xu_ly'];

export function isIncomingTab(value: unknown): value is IncomingTab {
  return typeof value === 'string' && (INCOMING_TABS as readonly string[]).includes(value);
}

/** Waits for me to distribute it: new, or returned by its chủ trì. */
export function needsDistribution(doc: IncomingDoc) {
  return doc.coThePhanPhoi && !doc.daHuy && (doc.trangThai === 'cho_phan_phoi' || doc.trangThai === 'bi_tra_lai');
}

/**
 * "Chưa đọc" as on the web (`IsChuaDoc`, red row): I am one of its distributors, it is not processed or
 * cancelled, and I have not opened it (the back-end sets the flag only once it is stamped "đã nhận").
 */
export function isUnreadIncoming(doc: IncomingDoc) {
  return doc.coThePhanPhoi && !doc.daXem && !doc.daHuy && doc.trangThai !== 'da_xu_ly';
}

/** I have to act on it as chủ trì or phối hợp. */
export function needsMyProcessing(doc: IncomingDoc) {
  return !doc.daHuy && doc.trangThai === 'dang_xu_ly' && (doc.vaiTro === 'chu_tri' || doc.vaiTro === 'phoi_hop');
}

export function inIncomingTab(doc: IncomingDoc, tab: IncomingTab) {
  switch (tab) {
    case 'phan_phoi':
      return needsDistribution(doc);
    case 'xu_ly':
      // Returned documents stay here (backend tab "Chờ xử lý") so the distributor sees the reason.
      return !doc.daHuy && ((doc.trangThai === 'dang_xu_ly' && !!doc.vaiTro) || (doc.trangThai === 'bi_tra_lai' && doc.coThePhanPhoi));
    case 'da_xu_ly':
      return doc.trangThai === 'da_xu_ly' || doc.trangThai === 'khong_xu_ly';
  }
}

/** Newest first, overdue and urgent work on top of the processing tab. */
export function sortIncoming(docs: readonly IncomingDoc[], tab: IncomingTab, today: DateKey = todayKey()): IncomingDoc[] {
  const rank = (doc: IncomingDoc) => {
    if (tab !== 'xu_ly') return 0;
    if (doc.trangThai === 'bi_tra_lai') return 0;
    if (isOverdue(doc.han, today)) return 1;
    return doc.khan ? 2 : 3;
  };
  return [...docs].sort((a, b) => rank(a) - rank(b) || b.ngayNhan.localeCompare(a.ngayNhan) || b.soDen.localeCompare(a.soDen));
}

export function incomingCounts(docs: readonly IncomingDoc[]): Record<IncomingTab, number> {
  return {
    phan_phoi: docs.filter((d) => inIncomingTab(d, 'phan_phoi')).length,
    xu_ly: docs.filter((d) => inIncomingTab(d, 'xu_ly')).length,
    da_xu_ly: docs.filter((d) => inIncomingTab(d, 'da_xu_ly')).length,
  };
}

export type DocumentSummary = {
  /** "Cần xử lý": waiting for me to distribute (of which returned) plus to process (chủ trì / phối hợp). */
  toHandle: number;
  toDistribute: number;
  returned: number;
  toProcess: number;
  chuTri: number;
  phoiHop: number;
  /** "Chưa đọc": incoming documents I distribute and have not opened. */
  unread: number;
  /** "Chờ đóng dấu": registered outgoing / internal documents of my unit, split by kind. */
  toStamp: number;
  toStampDi: number;
  toStampNoiBo: number;
  /** My open tasks past their deadline, and the worst delay in days. */
  overdue: number;
  worstOverdueDays: number;
  /** Shared documents still in force, and how many I have not opened. */
  shared: number;
  unreadShared: number;
  /** The hero number: everything waiting for my action (to handle plus to stamp). */
  pending: number;
};

export function documentSummary(
  incoming: readonly IncomingDoc[],
  shared: readonly SharedDoc[],
  stamp: readonly StampDoc[],
  tasks: readonly DocTask[],
  today: DateKey = todayKey(),
): DocumentSummary {
  const distribute = incoming.filter(needsDistribution);
  const process = incoming.filter(needsMyProcessing);
  // As the "Quá hạn" tab of "Việc của tôi", which the counter opens.
  const overdue = tasks.filter((task) => taskStage(task, today) === 'qua_han');
  const worstOverdueDays = overdue.reduce((worst, task) => Math.max(worst, -diffDays(today, task.to)), 0);
  const live = shared.filter((d) => !d.daHuy);
  return {
    toHandle: distribute.length + process.length,
    toDistribute: distribute.length,
    returned: distribute.filter((d) => d.trangThai === 'bi_tra_lai').length,
    toProcess: process.length,
    chuTri: process.filter((d) => d.vaiTro === 'chu_tri').length,
    phoiHop: process.filter((d) => d.vaiTro === 'phoi_hop').length,
    unread: incoming.filter(isUnreadIncoming).length,
    toStamp: stamp.length,
    toStampDi: stamp.filter((d) => d.kind === 'di').length,
    toStampNoiBo: stamp.filter((d) => d.kind === 'noi_bo').length,
    overdue: overdue.length,
    worstOverdueDays,
    shared: live.length,
    unreadShared: live.filter((d) => !d.daXem).length,
    pending: distribute.length + process.length + stamp.length,
  };
}
