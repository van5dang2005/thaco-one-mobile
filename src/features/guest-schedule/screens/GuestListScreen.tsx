import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { flattenPages } from '@/core/api/types';
import { qk } from '@/core/query/keys';
import { useTheme } from '@/core/theme/ThemeProvider';
import { formatKey, todayKey, weekdayOf } from '@/core/time/vn';
import { useDebounced } from '@/shared/hooks/useDebounced';
import { usePullRefresh } from '@/shared/hooks/usePullRefresh';
import { FilterChip } from '@/shared/ui/Chip';
import { SearchIcon, UsersIcon } from '@/shared/ui/icons';
import { CardSkeleton } from '@/shared/ui/Skeleton';
import { EmptyState, ErrorState } from '@/shared/ui/StateViews';
import { Text } from '@/shared/ui/Text';
import { TextField } from '@/shared/ui/TextField';

import { GuestPage, guestPageColors } from '../components/GuestPage';
import { GuestScene, useGuestScene } from '../components/GuestScene';
import { GuestTopBar } from '../components/GuestTopBar';
import { VisitCard } from '../components/VisitCard';
import { VisitDetailSheet } from '../components/VisitDetailSheet';
import { useGuestSchedules } from '../hooks/useGuestSchedules';
import type { GuestScheduleItem, GuestVisitTab } from '../types';
import { byStart } from '../utils/dashboard';

const TABS: GuestVisitTab[] = ['all', 'pending', 'checkedIn', 'checkedOut'];

/**
 * "Xem tất cả" of the dashboard: the title on the picture of the plant's gate, cut just under the coach driving in, then
 * on a square-topped grey panel a search field, the status tabs and the day's visits in time order, in a FlatList that
 * loads the next page as it nears the end. A visit opens its details in a sheet.
 */
export function GuestListScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();
  const scene = useGuestScene();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<GuestVisitTab>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<GuestScheduleItem | null>(null);
  const keyword = useDebounced(search.trim(), 350);
  const today = todayKey();

  // The counters of the whole day, from the dashboard's own query; the list asks for the tab and the search.
  const counts = useGuestSchedules({ day: today, tab: 'all' }).data?.pages[0]?.counts;
  const query = useGuestSchedules({ day: today, tab, search: keyword || undefined });
  const pull = usePullRefresh(() => queryClient.refetchQueries({ queryKey: qk.guests.schedulesRoot, type: 'active' }));

  const visits = flattenPages(query.data?.pages).sort(byStart);
  // The summary has no figure for inside and gone apart, so those two show the tab's own total once it is open.
  const count = (f: GuestVisitTab) =>
    f === 'all' ? counts?.total : f === 'pending' ? counts?.pending : f === tab && !keyword ? query.data?.pages[0]?.totalCount : undefined;
  const label = (f: GuestVisitTab) => {
    const name = f === 'all' ? t('guestSchedule.list.all') : t(`guestSchedule.dashboard.status.${f}`);
    const n = count(f);
    return n === undefined ? name : t('guestSchedule.list.filterCount', { label: name, count: n });
  };

  const panel = { backgroundColor: guestPageColors[scheme] };
  const loadMore = () => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  };

  return (
    <GuestPage testID="guests-list">
      <FlatList
        testID="guests-list-items"
        data={query.isLoading || (query.isError && !visits.length) ? [] : visits}
        keyExtractor={(visit) => visit.id}
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 8 }}
        keyboardShouldPersistTaps="handled"
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} />}
        ListHeaderComponent={
          <>
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

            <View testID="guests-list-panel" className="pb-4" style={panel}>
              <View className="px-4 pt-4">
                <TextField
                  testID="guests-list-search"
                  leftIcon={SearchIcon}
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('guestSchedule.list.searchPlaceholder')}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 flex-grow-0" contentContainerClassName="gap-2 px-4">
                {TABS.map((f) => (
                  <FilterChip key={f} testID={`guests-list-filter-${f}`} size="sm" selected={tab === f} label={label(f)} onPress={() => setTab(f)} />
                ))}
              </ScrollView>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View className="px-4 pb-2.5" style={panel}>
            <VisitCard visit={item} onPress={() => setSelected(item)} />
          </View>
        )}
        ListEmptyComponent={
          <View className="gap-2.5 px-4" style={panel}>
            {query.isLoading ? (
              <>
                <CardSkeleton lines={3} />
                <CardSkeleton lines={3} />
              </>
            ) : query.isError ? (
              <ErrorState error={query.error} onRetry={() => void query.refetch()} />
            ) : keyword ? (
              <EmptyState testID="guests-list-empty" icon={SearchIcon} message={t('guestSchedule.list.searchEmpty')} />
            ) : (
              <EmptyState testID="guests-list-empty" icon={UsersIcon} message={tab === 'all' ? t('guestSchedule.dashboard.todayEmpty') : t('guestSchedule.list.empty')} />
            )}
          </View>
        }
        // Grey down to the screen's end under a short list, so the drawing never shows below the visits.
        ListFooterComponentStyle={[{ flexGrow: 1 }, panel]}
        ListFooterComponent={
          <View style={{ paddingBottom: Math.max(insets.bottom, 12) + 6 }}>
            {query.isFetchingNextPage ? <Text className="py-2 text-center text-meta text-muted">{t('common.loadMore')}</Text> : null}
          </View>
        }
      />
      <VisitDetailSheet visit={selected} onClose={() => setSelected(null)} />
    </GuestPage>
  );
}
