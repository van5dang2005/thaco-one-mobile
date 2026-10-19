import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { DEFAULT_PAGE_SIZE, flattenPages, nextPageParam } from '@/core/api/types';
import { qk } from '@/core/query/keys';
import { useSessionStore } from '@/core/session/sessionStore';
import { useParcelMe } from '@/core/session/useMe';
import { departmentLabel } from '@/core/session/userTypes';
import { formatKey, todayKey, weekdayOf } from '@/core/time/vn';
import { useDebounced } from '@/shared/hooks/useDebounced';
import { usePullRefresh } from '@/shared/hooks/usePullRefresh';
import { HeaderIconButton } from '@/shared/ui/HeaderBar';
import { Icon } from '@/shared/ui/Icon';
import {
  type AppIcon,
  CalendarOffIcon,
  CheckCheckIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  ClockAlertIcon,
  InboxIcon,
  PackageCheckIcon,
  PackageIcon,
  PackageXIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from '@/shared/ui/icons';
import { ModuleHeader } from '@/shared/ui/ModuleHeader';
import { ModuleScreen, OVERLAP } from '@/shared/ui/ModuleScreen';
import { useHeaderColors } from '@/shared/ui/ScreenShell';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import { EmptyState, ErrorState } from '@/shared/ui/StateViews';
import { StatTile } from '@/shared/ui/StatTile';
import { Text } from '@/shared/ui/Text';
import { TextField } from '@/shared/ui/TextField';
import type { Tone } from '@/shared/ui/tones';

import { parcelsApi } from '../api/parcel.api';
import { isOnBehalf, ParcelCard } from '../components/ParcelCard';
import { ParcelsHeaderArt } from '../components/ParcelsHeaderArt';
import { useCanCreateParcel } from '../hooks/useCanCreateParcel';
import { useDueParcels } from '../hooks/useDueParcels';
import { useMyParcelStats } from '../hooks/useMyParcelStats';
import { parcelTabs, type ParcelTab } from '../utils/parcel';

const tabLabel = { pending: 'parcels.tabPending', overdue: 'parcels.tabOverdue', handed: 'parcels.tabHanded', cancelled: 'parcels.tabCancelled' } as const;

const tabLook: Record<ParcelTab, { icon: AppIcon; tone: Tone }> = {
  pending: { icon: PackageIcon, tone: 'wait' },
  overdue: { icon: ClockAlertIcon, tone: 'danger' },
  handed: { icon: PackageCheckIcon, tone: 'ok' },
  cancelled: { icon: PackageXIcon, tone: 'off' },
};

const empty = { pending: 'parcels.emptyPending', overdue: 'parcels.emptyOverdue', handed: 'parcels.emptyHanded', cancelled: 'parcels.emptyCancelled' } as const;

const emptyIcon: Record<ParcelTab, AppIcon> = { pending: InboxIcon, overdue: CircleCheckIcon, handed: CheckCheckIcon, cancelled: CalendarOffIcon };

/**
 * "Bưu phẩm của tôi" (6d), laid out like the Văn thư home: today's date and how many parcels wait for me on
 * the header, four counter tiles (Chờ nhận · Quá hạn · Đã nhận · Đã hủy) that pick the list below, then the
 * rows of the picked one. Back (to Trang chủ from the tab) on the left, search and "Thêm bưu phẩm" on the right.
 */
export function MyParcelsScreen() {
  const { t } = useTranslation();
  const { fg, text2, text3 } = useHeaderColors();
  const connected = useSessionStore((s) => s.connected.parcel);
  const me = useParcelMe();
  const stats = useMyParcelStats();
  const due = useDueParcels();
  const canCreate = useCanCreateParcel();
  const [tab, setTab] = useState<ParcelTab>('pending');
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');
  const keyword = useDebounced(search.trim(), 350);
  const today = todayKey();

  const query = useInfiniteQuery({
    queryKey: qk.parcels.my({ tab, search: keyword }),
    queryFn: ({ pageParam }) => parcelsApi.my({ pageNumber: pageParam, pageSize: DEFAULT_PAGE_SIZE, statuses: [...parcelTabs[tab]], search: keyword || undefined }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    enabled: connected,
  });
  const items = flattenPages(query.data?.pages);
  const pull = usePullRefresh(() => Promise.all([query.refetch(), stats.refetch(), due.refetch()]));

  const s = stats.data;
  const open = s ? s.waiting + s.overdue : undefined;
  const counts: Record<ParcelTab, number | undefined> = { pending: s?.waiting, overdue: s?.overdue, handed: s?.handedOver, cancelled: s?.cancelled };
  const hints: Record<ParcelTab, string | undefined> = s
    ? {
        pending: due.data?.count
          ? t('parcels.hintPendingDue', { count: due.data.count, date: due.data.firstDueKey ? formatKey(due.data.firstDueKey, false) : '' })
          : s.waiting
            ? t('parcels.hintPending')
            : t('parcels.hintPendingNone'),
        overdue: s.overdue ? t('parcels.hintOverdue') : t('parcels.hintOverdueNone'),
        handed: s.handedOver ? t('parcels.hintHanded') : t('parcels.hintHandedNone'),
        cancelled: s.cancelled ? t('parcels.hintCancelled') : t('parcels.hintCancelledNone'),
      }
    : { pending: undefined, overdue: undefined, handed: undefined, cancelled: undefined };

  const toggleSearch = () => {
    if (searching) setSearch('');
    setSearching((v) => !v);
  };

  const header = (
    <ModuleHeader
      testID="parcels-header"
      icon={PackageIcon}
      title={t('parcels.title')}
      subtitle={departmentLabel(me.data) || t('parcels.subtitleFallback')}
      art={<ParcelsHeaderArt />}
      right={
        <>
          <HeaderIconButton testID="parcels-search" icon={searching ? XIcon : SearchIcon} label={searching ? t('parcels.closeSearch') : t('parcels.search')} onPress={toggleSearch} />
          {canCreate ? <HeaderIconButton testID="parcels-create" variant="solid" icon={PlusIcon} label={t('parcels.create')} onPress={() => router.push('/parcels/reception/new')} /> : null}
        </>
      }
      bottom={12 + OVERLAP}
    >
      {/* As on the Văn thư home: equal blue above the date and under the count, so the block sits mid-header. */}
      <Text weight="bold" className="mt-3.5" style={{ fontSize: 11, lineHeight: 14, letterSpacing: 0.66, color: text3 }}>
        {t('parcels.heroDate', { weekday: t(`time.weekday.${String(weekdayOf(today)) as '0'}`), date: formatKey(today) }).toLocaleUpperCase()}
      </Text>
      <View className="mt-1.5 flex-row items-center gap-3" accessible accessibilityLabel={t('parcels.heroA11y', { count: open ?? 0 })}>
        <Text weight="bold" maxFontSizeMultiplier={1.1} style={{ marginLeft: -1, fontSize: 52, lineHeight: 58, letterSpacing: -1, color: fg }}>
          {open === undefined ? '–' : String(open)}
        </Text>
        <View className="flex-1">
          <Text weight="bold" style={{ fontSize: 17, lineHeight: 22, color: fg }}>
            {t('parcels.heroUnit')}
          </Text>
          <Text weight="medium" style={{ fontSize: 13, lineHeight: 18, color: text2 }}>
            {open === 0 ? t('parcels.heroNone') : t('parcels.heroWaiting')}
          </Text>
        </View>
      </View>
    </ModuleHeader>
  );

  const tile = (key: ParcelTab) => (
    <StatTile
      testID={`parcels-tab-${key}`}
      icon={tabLook[key].icon}
      tone={tabLook[key].tone}
      label={t(tabLabel[key])}
      value={counts[key]}
      hint={hints[key]}
      hintTone={key === 'overdue' && s?.overdue ? 'danger' : key === 'pending' && due.data?.count ? 'warning' : undefined}
      selected={tab === key}
      onPress={() => setTab(key)}
    />
  );

  return (
    <ModuleScreen header={header} overlap refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} />}>
      <View className="mt-2 gap-2.5" testID="parcels-tabs" accessibilityRole="tablist">
        <View className="flex-row gap-2.5">
          {tile('pending')}
          {tile('overdue')}
        </View>
        <View className="flex-row gap-2.5">
          {tile('handed')}
          {tile('cancelled')}
        </View>
      </View>

      <SectionTitle className="mt-2" right={counts[tab] === undefined ? undefined : t('parcels.listCount', { count: counts[tab] })}>
        {t(tabLabel[tab])}
      </SectionTitle>
      {searching ? (
        <TextField
          testID="parcels-search-field"
          leftIcon={SearchIcon}
          value={search}
          onChangeText={setSearch}
          placeholder={t('parcels.searchPlaceholder')}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      ) : null}

      {query.isLoading ? (
        <ListSkeleton count={2} lines={3} />
      ) : query.isError && !items.length ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length ? (
        <>
          {items.map((item) => (
            <ParcelCard
              key={item.id}
              parcel={item}
              myCode={me.data?.employeeCode}
              onPress={() => router.push({ pathname: '/parcels/[id]', params: { id: item.id, onBehalf: isOnBehalf(item) ? '1' : undefined } })}
            />
          ))}
          {query.hasNextPage ? (
            <Pressable
              testID="parcels-more"
              accessibilityRole="button"
              disabled={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
              className="flex-row items-center justify-center gap-1 py-1 active:opacity-70"
            >
              <Text weight="semibold" className="text-primary" style={{ fontSize: 13, lineHeight: 17 }}>
                {query.isFetchingNextPage ? t('common.loadMore') : t('parcels.loadMoreParcels')}
              </Text>
              {query.isFetchingNextPage ? null : <Icon icon={ChevronDownIcon} size={15} color="primary" weight="bold" />}
            </Pressable>
          ) : null}
        </>
      ) : (
        <EmptyState testID="parcels-empty" icon={keyword ? SearchIcon : emptyIcon[tab]} message={keyword ? t('parcels.noResults') : t(empty[tab])} />
      )}
    </ModuleScreen>
  );
}
