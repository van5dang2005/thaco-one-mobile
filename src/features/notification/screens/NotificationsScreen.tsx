import { type InfiniteData, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, RefreshControl, SectionList, View } from 'react-native';

import { errorMessage } from '@/core/errors/errorMessage';
import { qk } from '@/core/query/keys';
import { formatDayMonth, formatTime, parseServerDate, todayKey } from '@/core/time/vn';
import { usePullRefresh } from '@/shared/hooks/usePullRefresh';
import { Banner } from '@/shared/ui/Banner';
import { Button } from '@/shared/ui/Button';
import { HeaderPillButton } from '@/shared/ui/HeaderBar';
import { HeaderChips } from '@/shared/ui/HeaderChips';
import { BellIcon, CheckCheckIcon } from '@/shared/ui/icons';
import { ModuleHeader } from '@/shared/ui/ModuleHeader';
import { CONTENT_PADDING, ModuleScreen } from '@/shared/ui/ModuleScreen';
import { useHeaderColors } from '@/shared/ui/ScreenShell';
import { GroupTitle } from '@/shared/ui/SectionTitle';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import { EmptyState, ErrorState } from '@/shared/ui/StateViews';
import { Text } from '@/shared/ui/Text';
import { toast } from '@/shared/ui/Toast';

import { NotificationRow } from '../components/NotificationRow';
import { NotificationsHeaderArt } from '../components/NotificationsHeaderArt';
import { useNotificationFeed } from '../hooks/useNotificationFeed';
import { useNotificationSources } from '../hooks/useNotificationSources';
import { useUnreadCounts } from '../hooks/useUnreadCount';
import type { NotificationSource } from '../types';
import { dayGroupOf, type FeedCursor, type FeedItem, feedKey, type FeedPage, groupByDay } from '../utils/feed';

/** Chip value of the merged feed (never a source id). */
const ALL = '*';

/**
 * Notifications (v3, Văn thư style): a picture header (`NotificationsHeaderArt`) with the unread count and one chip per
 * module, "Tất cả" merging every module newest first; rows grouped by day. Tap opens (and reads) one, long-press
 * deletes it.
 */
export function NotificationsScreen() {
  const { t } = useTranslation();
  const { fg, text2 } = useHeaderColors();
  const queryClient = useQueryClient();
  const sources = useNotificationSources();
  const unread = useUnreadCounts();
  const [filter, setFilter] = useState(ALL);
  const selected = sources.find((source) => source.id === filter);
  const shown = selected ? [selected] : sources;
  const { query, items, failed } = useNotificationFeed(shown);
  const pull = usePullRefresh(() => query.refetch());
  const today = todayKey();

  const sourceOf = (item: FeedItem) => sources.find((source) => source.id === item.sourceId);
  const totalUnread = sources.reduce((sum, source) => sum + (unread[source.id] ?? 0), 0);
  const markAllTargets = shown.filter((source) => source.markAllRead && (unread[source.id] ?? 0) > 0);

  /** Changes rows in every loaded feed at once: a notification shows under "Tất cả" and under its module. */
  const patchFeeds = (change: (item: FeedItem) => FeedItem | null) =>
    queryClient.setQueriesData<InfiniteData<FeedPage, FeedCursor>>({ queryKey: qk.notifications.feeds }, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.flatMap((item) => {
                const next = change(item);
                return next ? [next] : [];
              }),
            })),
          }
        : data,
    );
  const refreshFeeds = () => void queryClient.invalidateQueries({ queryKey: qk.notifications.feeds });
  const refreshUnread = (ids: string[]) => ids.forEach((id) => void queryClient.invalidateQueries({ queryKey: qk.notifications.unread(id) }));

  const markRead = useMutation({
    mutationFn: (item: FeedItem) => sourceOf(item)!.markRead(item.id),
    onMutate: (item) => {
      patchFeeds((row) => (feedKey(row) === feedKey(item) ? { ...row, isRead: true } : row));
      queryClient.setQueryData<number>(qk.notifications.unread(item.sourceId), (count) => Math.max(0, (count ?? 1) - 1));
    },
    onError: refreshFeeds,
    onSettled: (_data, _error, item) => refreshUnread([item.sourceId]),
  });
  const markAll = useMutation({
    mutationFn: (targets: NotificationSource[]) => Promise.all(targets.map((source) => source.markAllRead!())),
    onMutate: (targets) => {
      const ids = new Set(targets.map((source) => source.id));
      patchFeeds((row) => (ids.has(row.sourceId) ? { ...row, isRead: true } : row));
      ids.forEach((id) => queryClient.setQueryData<number>(qk.notifications.unread(id), 0));
    },
    onSuccess: () => toast.success(t('notifications.markedAllRead')),
    onError: (error) => {
      toast.error(errorMessage(error, t));
      refreshFeeds();
    },
    onSettled: (_data, _error, targets) => refreshUnread(targets.map((source) => source.id)),
  });
  const remove = useMutation({
    mutationFn: (item: FeedItem) => sourceOf(item)!.remove!(item.id),
    onMutate: (item) => patchFeeds((row) => (feedKey(row) === feedKey(item) ? null : row)),
    onSuccess: () => toast.success(t('notifications.deleted')),
    onError: (error) => toast.error(errorMessage(error, t)),
    onSettled: (_data, _error, item) => {
      refreshFeeds();
      refreshUnread([item.sourceId]);
    },
  });
  const removeAll = useMutation({
    mutationFn: (source: NotificationSource) => source.removeAll!(),
    onError: (error) => toast.error(errorMessage(error, t)),
    onSettled: (_data, _error, source) => {
      refreshFeeds();
      refreshUnread([source.id]);
    },
  });

  const open = (item: FeedItem) => {
    if (!item.isRead) markRead.mutate(item);
    if (item.href) router.push(item.href);
  };

  const confirmRemove = (item: FeedItem) =>
    Alert.alert(t('notifications.title'), t('notifications.deleteOne'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => remove.mutate(item) },
    ]);

  const confirmRemoveAll = (source: NotificationSource) =>
    Alert.alert(t('notifications.title'), t('notifications.deleteAllConfirm', { service: source.name(t) }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => removeAll.mutate(source) },
    ]);

  /** Clock time today and yesterday (the group names the day), the date before. */
  const timeOf = (item: FeedItem) => {
    const group = dayGroupOf(item.createdAt, today);
    const date = parseServerDate(item.createdAt);
    return group === 'today' || group === 'yesterday' ? formatTime(date) : formatDayMonth(date);
  };

  const sections = groupByDay(items, today).map((group) => ({ key: group.key, title: t(`notifications.group.${group.key}`), data: group.items }));
  const failedNames = sources.filter((source) => failed.includes(source.id)).map((source) => source.label(t));

  const header = (
    <ModuleHeader
      testID="notifications-header"
      icon={BellIcon}
      title={t('notifications.title')}
      art={<NotificationsHeaderArt ringing={totalUnread > 0} />}
      right={
        markAllTargets.length ? (
          <HeaderPillButton testID="notifications-mark-all" icon={CheckCheckIcon} label={t('notifications.markAllRead')} onPress={() => markAll.mutate(markAllTargets)} />
        ) : undefined
      }
      bottom={18}
    >
      {/* The count on the left, where the picture leaves sky (as on the Bưu phẩm and Văn thư homes). */}
      <View className="flex-row items-center gap-3" accessible accessibilityLabel={`${totalUnread} ${t('notifications.heroUnit')}`}>
        <Text weight="bold" maxFontSizeMultiplier={1.1} style={{ marginLeft: -1, fontSize: 48, lineHeight: 54, letterSpacing: -1, color: fg }}>
          {String(totalUnread)}
        </Text>
        <View className="flex-shrink">
          <Text weight="bold" style={{ fontSize: 16, lineHeight: 21, color: fg }}>
            {t('notifications.heroUnit')}
          </Text>
          <Text weight="medium" style={{ fontSize: 12.5, lineHeight: 17, color: text2 }}>
            {totalUnread ? t('notifications.heroHint') : t('notifications.allRead')}
          </Text>
        </View>
      </View>
      {sources.length > 1 ? (
        <View className="mt-4">
          <HeaderChips
            testID="notifications-filter"
            options={[
              { value: ALL, label: t('notifications.all'), count: totalUnread || undefined, testID: 'notifications-chip-all' },
              ...sources.map((source) => ({ value: source.id, label: source.label(t), count: unread[source.id] || undefined, testID: `notifications-chip-${source.id}` })),
            ]}
            value={selected ? selected.id : ALL}
            onChange={setFilter}
          />
        </View>
      ) : null}
    </ModuleHeader>
  );

  return (
    <ModuleScreen header={header} scroll={false}>
      {query.isLoading ? (
        <View className="p-4">
          <ListSkeleton count={5} lines={3} />
        </View>
      ) : query.isError && !items.length ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={feedKey}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: CONTENT_PADDING.horizontal, paddingTop: CONTENT_PADDING.top, paddingBottom: CONTENT_PADDING.bottom }}
          ListHeaderComponent={
            failedNames.length ? (
              <Banner testID="notifications-failed" tone="warning" className="mb-3">
                {t('notifications.loadFailed', { service: failedNames.join(', ') })}
              </Banner>
            ) : null
          }
          renderSectionHeader={({ section }) => <GroupTitle className="mb-2 mt-1">{section.title}</GroupTitle>}
          renderItem={({ item }) => {
            const source = sourceOf(item);
            if (!source) return null;
            return (
              <NotificationRow
                item={item}
                source={source}
                time={timeOf(item)}
                onPress={() => open(item)}
                onLongPress={source.remove ? () => confirmRemove(item) : undefined}
              />
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          SectionSeparatorComponent={() => <View style={{ height: 6 }} />}
          refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          ListEmptyComponent={
            <EmptyState testID="notifications-empty" icon={BellIcon} message={selected ? t('notifications.emptyModule', { service: selected.label(t) }) : t('notifications.empty')} />
          }
          ListFooterComponent={
            items.length ? (
              <View className="items-center gap-3 pt-4">
                {query.isFetchingNextPage ? <Text className="text-meta text-muted">{t('common.loadMore')}</Text> : null}
                {selected?.removeAll && !query.hasNextPage ? (
                  <Button
                    testID="notifications-delete-all"
                    variant="danger"
                    size="sm"
                    label={t('notifications.deleteAllOf', { service: selected.label(t) })}
                    onPress={() => confirmRemoveAll(selected)}
                  />
                ) : null}
              </View>
            ) : null
          }
        />
      )}
    </ModuleScreen>
  );
}
