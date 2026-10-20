import { useMutation, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/core/query/keys';

import { officialDocumentApi } from '../api/officialDocument.api';
import type { ShareRecipient, SharedDoc } from '../types';

/** Mark a shared document as read (8h), applied to the cache right away, and share it on (8i). */
export function useSharedActions() {
  const queryClient = useQueryClient();

  const update = (id: string, change: (doc: SharedDoc) => SharedDoc) => {
    const list = queryClient.getQueryData<SharedDoc[]>(qk.documents.shared);
    const detail = queryClient.getQueryData<SharedDoc>(qk.documents.sharedDetail(id));
    if (list) queryClient.setQueryData<SharedDoc[]>(qk.documents.shared, list.map((d) => (d.id === id ? change(d) : d)));
    if (detail) queryClient.setQueryData(qk.documents.sharedDetail(id), change(detail));
    return { list, detail };
  };
  const restore = (id: string, snapshot?: { list?: SharedDoc[]; detail?: SharedDoc }) => {
    if (snapshot?.list) queryClient.setQueryData(qk.documents.shared, snapshot.list);
    if (snapshot?.detail) queryClient.setQueryData(qk.documents.sharedDetail(id), snapshot.detail);
  };

  const markRead = useMutation({
    mutationFn: (id: string) => officialDocumentApi.markSharedRead(id),
    onMutate: (id) => update(id, (d) => ({ ...d, daXem: true })),
    onError: (_e, id, snapshot) => restore(id, snapshot),
  });

  /** `recipients` is the final list (everyone keeps or loses the document by it). */
  const share = useMutation({
    mutationFn: ({ id, recipients }: { id: string; recipients: ShareRecipient[] }) => officialDocumentApi.share(id, recipients),
    // The list, the detail and who holds what.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: qk.documents.shared }),
  });

  return { markRead, share };
}
