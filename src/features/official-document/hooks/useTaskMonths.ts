import { useQueries } from '@tanstack/react-query';

import { qk } from '@/core/query/keys';

import { officialDocumentApi } from '../api/officialDocument.api';

/** My tasks of each month the calendar shows (`yyyy-MM`), one request per month as the web calendar makes. */
export function useTaskMonths(months: readonly string[]) {
  return useQueries({
    queries: months.map((month) => ({ queryKey: qk.documents.tasksMonth(month), queryFn: () => officialDocumentApi.tasks(month) })),
  });
}
