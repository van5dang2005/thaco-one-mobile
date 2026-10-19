import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl } from 'react-native';

import { addDays, formatKey, todayKey, weekdayOf, type DateKey } from '@/core/time/vn';
import { usePullRefresh } from '@/shared/hooks/usePullRefresh';
import { CalendarCheckIcon, ListChecksIcon } from '@/shared/ui/icons';
import { ModuleHeader } from '@/shared/ui/ModuleHeader';
import { ModuleScreen } from '@/shared/ui/ModuleScreen';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import { EmptyState, ErrorState } from '@/shared/ui/StateViews';

import { HeaderChips } from '@/shared/ui/HeaderChips';
import { TaskCard } from '../components/TaskCard';
import { TaskWeekCard } from '../components/TaskWeekCard';
import { useIncomingDocs } from '../hooks/useIncomingDocs';
import { inTaskTab, isTaskTab, TASK_TABS, taskCounts, tasksOf, tasksOnDay, type TaskTab } from '../utils/tasks';

/** "Việc của tôi" (8b): tab chips, the calendar (week strip, expandable to the month) with role dots, and the tasks of the selected day. */
export function MyTasksScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<TaskTab>(isTaskTab(params.tab) ? params.tab : 'tat_ca');
  const today = todayKey();
  const [day, setDay] = useState<DateKey>(today);
  const query = useIncomingDocs();
  const pull = usePullRefresh(() => query.refetch());

  const tasks = tasksOf(query.data ?? []);
  const counts = taskCounts(tasks, today);
  const shown = tasksOnDay(tasks, day, today).filter((task) => inTaskTab(task, tab, today));

  const header = (
    <ModuleHeader testID="tasks-header" icon={ListChecksIcon} title={t('documents.tasks.title')} subtitle={t('documents.tasks.subtitle')} bottom={18}>
      <HeaderChips<TaskTab>
        testID="tasks-tabs"
        options={TASK_TABS.map((key) => ({ value: key, label: t(`documents.tasks.tab.${key}`), count: query.data ? counts[key] : undefined, testID: `tasks-tab-${key}` }))}
        value={tab}
        onChange={setTab}
      />
    </ModuleHeader>
  );

  return (
    <ModuleScreen header={header} refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} />}>
      <TaskWeekCard tasks={tasks} value={day} onChange={setDay} today={today} onWeek={(delta) => setDay((d) => addDays(d, delta * 7))} />

      <SectionTitle>
        {t('documents.tasks.dayTitle', {
          weekday: day === today ? t('documents.tasks.today') : t(`time.weekday.${String(weekdayOf(day)) as '0'}`),
          date: formatKey(day, false),
          count: shown.length,
        })}
      </SectionTitle>

      {query.isLoading ? (
        <ListSkeleton count={3} lines={3} />
      ) : query.isError && !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : shown.length ? (
        shown.map((task) => <TaskCard key={task.id} task={task} today={today} onPress={() => router.push({ pathname: '/documents/incoming/[id]', params: { id: task.docId } })} />)
      ) : (
        <EmptyState testID="tasks-empty" icon={CalendarCheckIcon} message={t('documents.tasks.empty')} />
      )}
    </ModuleScreen>
  );
}
