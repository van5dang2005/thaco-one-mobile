import { useQuery } from '@tanstack/react-query';

import { qk } from '@/core/query/keys';

import { officialDocumentApi } from '../api/officialDocument.api';

/** My processing tasks ("Việc của tôi", today's tasks of the home); `enabled` false skips the request. */
export function useDocumentTasks(enabled = true) {
  return useQuery({ queryKey: qk.documents.tasks, queryFn: () => officialDocumentApi.tasks(), enabled });
}
