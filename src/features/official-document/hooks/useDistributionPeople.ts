import { useQuery } from '@tanstack/react-query';

import { qk } from '@/core/query/keys';

import { officialDocumentApi } from '../api/officialDocument.api';

/** Active staff to pick the processing team of `docId` from (the whole list, searched on the device as the web does). */
export function useDistributionPeople(docId: string) {
  return useQuery({
    queryKey: qk.documents.people(docId),
    queryFn: () => officialDocumentApi.distributionPeople(docId),
    staleTime: 10 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    // Thousands of rows: kept in memory, not written to the persisted cache.
    meta: { persist: false },
    enabled: !!docId,
  });
}
