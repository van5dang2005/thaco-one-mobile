import { useQuery } from '@tanstack/react-query';

import { qk } from '@/core/query/keys';

import { officialDocumentApi } from '../api/officialDocument.api';

/** Who may receive `docId`, what each holds now, and what I may grant ("Chia sẻ tiếp"); `enabled` while the sheet is open. */
export function useShareOptions(docId: string, enabled = true) {
  return useQuery({
    queryKey: qk.documents.recipients(docId),
    queryFn: () => officialDocumentApi.shareOptions(docId),
    // Always the current holders: the share list sent back is the final state.
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    // The whole staff list: kept in memory, not written to the persisted cache.
    meta: { persist: false },
    enabled: enabled && !!docId,
  });
}
