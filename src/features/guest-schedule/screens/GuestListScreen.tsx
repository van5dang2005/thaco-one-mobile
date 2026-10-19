import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/core/theme/ThemeProvider';
import { formatKey, todayKey, weekdayOf } from '@/core/time/vn';
import { usePullRefresh } from '@/shared/hooks/usePullRefresh';
import { FilterChip } from '@/shared/ui/Chip';
import { UsersIcon } from '@/shared/ui/icons';
import { CardSkeleton } from '@/shared/ui/Skeleton';
import { EmptyState, ErrorState } from '@/shared/ui/StateViews';

import { GuestPage, guestPageColors } from '../components/GuestPage';
import { GuestScene, useGuestScene } from '../components/GuestScene';
import { GuestTopBar } from '../components/GuestTopBar';
import { VisitCard } from '../components/VisitCard';
import { useGuestDashboard } from '../hooks/useGuestDashboard';
import type { GuestVisitStatus } from '../types';
import { byStart } from '../utils/dashboard';

type Filter = 'all' | GuestVisitStatus;
const FILTERS: Filter[] = ['all', 'pending', 'confirmed', 'checkedIn', 'checkedOut'];

/**
 * "Xem tất cả" of the dashboard: the title on the picture of the plant's gate, cut just under the coach driving in, then
 * on a square-topped grey panel the status filters and every visit of the day in time order.
 */
export function GuestListScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();
  const scene = useGuestScene();
  const { data, isLoading, isError, error, refetch } = useGuestDashboard();
  const pull = usePullRefresh(refetch);
  const [filter, setFilter] = useState<Filter>('all');
  const today = todayKey();

  const visits = [...(data?.today ?? [])].sort(byStart);
  const count = (f: Filter) => (f === 'all' ? visits.length : visits.filter((v) => v.status === f).length);
  const shown = filter === 'all' ? visits : visits.filter((v) => v.status === filter);
  const label = (f: Filter) => (f === 'all' ? t('guestSchedule.list.all') : t(`guestSchedule.dashboard.status.${f}`));

  return (
    <GuestPage testID="guests-list">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 8 }}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} />}
      >
        {/* The picture, edge to edge, with the toolbar on it; the panel below covers the rest of the drawing. */}
        <View className="px-4" style={{ minHeight: scene.gate }}>
          <GuestScene />
          <GuestTopBar
            testID="guests-list-top"
            fallback="/guests"
            title={t('guestSchedule.list.title')}
            subtitle={t('guestSchedule.dashboard.date', { weekday: t(`time.weekday.${String(weekdayOf(today)) as '0'}`), date: formatKey(today) })}
          />
        </View>

        <View
          testID="guests-list-panel"
          className="flex-grow"
          style={{ backgroundColor: guestPageColors[scheme], paddingBottom: Math.max(insets.bottom, 12) + 16 }}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4 flex-grow-0" contentContainerClassName="gap-2 px-4">
            {FILTERS.map((f) => (
              <FilterChip
                key={f}
                testID={`guests-list-filter-${f}`}
                selected={filter === f}
                label={t('guestSchedule.list.filterCount', { label: label(f), count: count(f) })}
                onPress={() => setFilter(f)}
              />
            ))}
          </ScrollView>

          <View className="mt-4 gap-2.5 px-4">
            {isLoading ? (
              <>
                <CardSkeleton lines={3} />
                <CardSkeleton lines={3} />
              </>
            ) : isError && !data ? (
              <ErrorState error={error} onRetry={() => void refetch()} />
            ) : shown.length ? (
              shown.map((visit) => <VisitCard key={visit.id} visit={visit} />)
            ) : (
              <EmptyState testID="guests-list-empty" icon={UsersIcon} message={filter === 'all' ? t('guestSchedule.dashboard.todayEmpty') : t('guestSchedule.list.empty')} />
            )}
          </View>
        </View>
      </ScrollView>
    </GuestPage>
  );
}
