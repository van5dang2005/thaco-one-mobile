import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { qk } from '@/core/query/keys';
import { todayKey } from '@/core/time/vn';

import { officialDocumentApi } from '../api/officialDocument.api';
import type { AssignInput, IncomingDoc } from '../types';

type Snapshot = { list?: IncomingDoc[]; detail?: IncomingDoc };

/** Applies `change` to the cached list and detail of `id` at once; returns what to restore on failure. */
async function patch(queryClient: QueryClient, id: string, change: (doc: IncomingDoc) => IncomingDoc | null): Promise<Snapshot> {
  await queryClient.cancelQueries({ queryKey: qk.documents.incoming });
  const list = queryClient.getQueryData<IncomingDoc[]>(qk.documents.incoming);
  const detail = queryClient.getQueryData<IncomingDoc>(qk.documents.incomingDetail(id));
  if (list) {
    queryClient.setQueryData<IncomingDoc[]>(
      qk.documents.incoming,
      list.flatMap((doc) => {
        if (doc.id !== id) return [doc];
        const next = change(doc);
        return next ? [next] : [];
      }),
    );
  }
  if (detail) {
    const next = change(detail);
    if (next) queryClient.setQueryData(qk.documents.incomingDetail(id), next);
  }
  return { list, detail };
}

function restore(queryClient: QueryClient, id: string, snapshot?: Snapshot) {
  if (snapshot?.list) queryClient.setQueryData(qk.documents.incoming, snapshot.list);
  if (snapshot?.detail) queryClient.setQueryData(qk.documents.incomingDetail(id), snapshot.detail);
}

/**
 * Actions on an incoming document, each applied to the cache right away (optimistic) and rolled back if the
 * call fails: distribute (8e), complete or return (8f), mark as read.
 */
export function useIncomingActions(meId?: string) {
  const queryClient = useQueryClient();
  const settle = () => void queryClient.invalidateQueries({ queryKey: qk.documents.root });

  const assign = useMutation({
    mutationFn: (input: AssignInput) => officialDocumentApi.assign(input),
    onMutate: (input) =>
      patch(queryClient, input.id, (doc) => ({
        ...doc,
        trangThai: input.khongYeuCauXuLy ? 'khong_xu_ly' : 'dang_xu_ly',
        han: input.khongYeuCauXuLy ? undefined : input.han,
        khan: input.khan,
        quanTrong: input.quanTrong,
        yKienPhanPhoi: input.yKien.trim() || undefined,
        thanhPhan: input.thanhPhan,
        vaiTro: input.thanhPhan.find((a) => a.person.id === meId)?.role,
        coThePhanPhoi: false,
        phanPhoiLuc: new Date().toISOString(),
        lyDoTraLai: undefined,
      })),
    onError: (_e, input, snapshot) => restore(queryClient, input.id, snapshot),
    onSettled: settle,
  });

  const complete = useMutation({
    mutationFn: ({ id, ketQua }: { id: string; ketQua: string }) => officialDocumentApi.complete(id, ketQua),
    onMutate: ({ id, ketQua }) => patch(queryClient, id, (doc) => ({ ...doc, trangThai: 'da_xu_ly', coTheXuLy: false, ketQua: ketQua.trim(), ngayHoanTat: todayKey() })),
    onError: (_e, { id }, snapshot) => restore(queryClient, id, snapshot),
    onSettled: settle,
  });

  const returnDoc = useMutation({
    mutationFn: ({ id, lyDo }: { id: string; lyDo: string }) => officialDocumentApi.returnDoc(id, lyDo),
    // Without the right to distribute it, the document leaves my list.
    onMutate: ({ id, lyDo }) => patch(queryClient, id, (doc) => (doc.coThePhanPhoi ? { ...doc, trangThai: 'bi_tra_lai', coTheXuLy: false, lyDoTraLai: lyDo.trim() } : null)),
    onError: (_e, { id }, snapshot) => restore(queryClient, id, snapshot),
    onSettled: settle,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => officialDocumentApi.markIncomingRead(id),
    onMutate: (id) => patch(queryClient, id, (doc) => ({ ...doc, daXem: true })),
    onError: (_e, id, snapshot) => restore(queryClient, id, snapshot),
  });

  return { assign, complete, returnDoc, markRead };
}
