import { toDateKey } from '@/core/time/vn';
import { useNow } from '@/shared/hooks/useNow';

import { documentSummary } from '../utils/incoming';
import { useDocumentTasks } from './useDocumentTasks';
import { useIncomingDocs } from './useIncomingDocs';
import { useSharedDocs } from './useSharedDocs';
import { useStampQueue } from './useStampQueue';

/** Counts of the Văn thư home (8a) and the Home tile badge; `enabled` false skips the requests. */
export function useDocumentSummary(enabled = true) {
  const incoming = useIncomingDocs(enabled);
  const shared = useSharedDocs(enabled);
  const stamp = useStampQueue(enabled);
  const tasks = useDocumentTasks(enabled);
  const today = toDateKey(useNow(60_000));
  const queries = [incoming, shared, stamp, tasks];
  const loaded = queries.every((q) => !!q.data);
  return {
    summary: loaded ? documentSummary(incoming.data ?? [], shared.data ?? [], stamp.data ?? [], tasks.data ?? [], today) : undefined,
    isLoading: enabled && queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
    error: queries.find((q) => q.error)?.error ?? null,
    refetch: () => Promise.all(queries.map((q) => q.refetch())),
  };
}
