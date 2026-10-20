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
import { type TaskCalendarMode, TaskWeekCard } from '../components/TaskWeekCard';
import { useDocumentTasks } from '../hooks/useDocumentTasks';
import { useTaskMonths } from '../hooks/useTaskMonths';
import { inTaskTab, isTaskTab, monthOf, TASK_TABS, taskCounts, tasksOnDay, visibleMonths, withOverdue, type TaskTab } from '../utils/tasks';

/**
 * "Việc của tôi" (8b): tab chips, the calendar (week strip, expandable to the month) with role dots, and the tasks of
 * the selected day. As on the web, the calendar loads the months it shows (`Thang`): picking a day or stepping into
 * another month asks the server; the tab counts come from the full list, as the home counters that open this screen.
 */
export function MyTasksScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<TaskTab>(isTaskTab(params.tab) ? params.tab : 'tat_ca');
  const today = todayKey();
  const [day, setDay] = useState<DateKey>(today);
  const [mode, setMode] = useState<TaskCalendarMode>('week');
  const all = useDocumentTasks();
  const months = visibleMonths(day, mode !== 'week');
  const monthQueries = useTaskMonths(months);
  const dayMonth = monthQueries[months.indexOf(monthOf(day))];
  const pull = usePullRefresh(() => Promise.all([all.refetch(), ...monthQueries.map((q) => q.refetch())]));

  const tasks = withOverdue(
    monthQueries.flatMap((q) => q.data ?? []),
    all.data ?? [],
    today,
  );
  const counts = taskCounts(all.data ?? [], today);
  const shown = tasksOnDay(tasks, day, today).filter((task) => inTaskTab(task, tab, today));

  const header = (
    <ModuleHeader testID="tasks-header" icon={ListChecksIcon} title={t('documents.tasks.title')} subtitle={t('documents.tasks.subtitle')} bottom={18}>
      <HeaderChips<TaskTab>
        testID="tasks-tabs"
        options={TASK_TABS.map((key) => ({ value: key, label: t(`documents.tasks.tab.${key}`), count: all.data ? counts[key] : undefined, testID: `tasks-tab-${key}` }))}
        value={tab}
        onChange={setTab}
      />
    </ModuleHeader>
  );

  return (
    <ModuleScreen header={header} refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} />}>
      <TaskWeekCard tasks={tasks} value={day} onChange={setDay} today={today} onWeek={(delta) => setDay((d) => addDays(d, delta * 7))} mode={mode} onModeChange={setMode} />

      <SectionTitle>
        {t('documents.tasks.dayTitle', {
          weekday: day === today ? t('documents.tasks.today') : t(`time.weekday.${String(weekdayOf(day)) as '0'}`),
          date: formatKey(day, false),
          count: shown.length,
        })}
      </SectionTitle>

      {dayMonth?.isLoading ? (
        <ListSkeleton count={3} lines={3} />
      ) : dayMonth?.isError && !dayMonth.data ? (
        <ErrorState error={dayMonth.error} onRetry={() => void dayMonth.refetch()} />
      ) : shown.length ? (
        shown.map((task) => <TaskCard key={task.id} task={task} today={today} onPress={() => router.push({ pathname: '/documents/incoming/[id]', params: { id: task.docId } })} />)
      ) : (
        <EmptyState testID="tasks-empty" icon={CalendarCheckIcon} message={t('documents.tasks.empty')} />
      )}
    </ModuleScreen>
  );
}
