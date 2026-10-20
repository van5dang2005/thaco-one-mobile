import { useQuery, useQueryClient } from '@tanstack/react-query';

import { qk } from '@/core/query/keys';

import { officialDocumentApi } from '../api/officialDocument.api';
import type { IncomingDoc } from '../types';

/** One incoming document (8d, 8e), loaded fresh; shows the list's copy while the detail loads. */
export function useIncomingDoc(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.documents.incomingDetail(id),
    queryFn: () => officialDocumentApi.incomingDetail(id),
    placeholderData: () => queryClient.getQueryData<IncomingDoc[]>(qk.documents.incoming)?.find((d) => d.id === id),
    enabled: !!id,
  });
}
