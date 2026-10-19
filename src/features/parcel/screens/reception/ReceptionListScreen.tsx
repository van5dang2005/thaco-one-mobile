import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, View } from 'react-native';

import { DEFAULT_PAGE_SIZE, flattenPages, nextPageParam } from '@/core/api/types';
import { qk } from '@/core/query/keys';
import { useCapabilities } from '@/core/session/capabilities';
import { useSessionStore } from '@/core/session/sessionStore';
import { useDebounced } from '@/shared/hooks/useDebounced';
import { Button } from '@/shared/ui/Button';
import { HeaderIconButton } from '@/shared/ui/HeaderBar';
import { HeaderChips } from '@/shared/ui/HeaderChips';
import { BuildingIcon, CalendarDaysIcon, InboxIcon, LockIcon, PackageIcon, PlusIcon, SearchIcon } from '@/shared/ui/icons';
import { ModuleHeader } from '@/shared/ui/ModuleHeader';
import { CONTENT_PADDING, ModuleScreen } from '@/shared/ui/ModuleScreen';
import { SelectSheet } from '@/shared/ui/SelectSheet';
import { ListSkeleton } from '@/shared/ui/Skeleton';
import { EmptyState, ErrorState } from '@/shared/ui/StateViews';
import { Text } from '@/shared/ui/Text';
import { TextField } from '@/shared/ui/TextField';
import { usePullRefresh } from '@/shared/hooks/usePullRefresh';

import { parcelsApi } from '../../api/parcel.api';
import { ReceptionParcelCard } from '../../components/ReceptionParcelCard';
import { useAccessibleDepartments } from '../../hooks/useAccessibleDepartments';
import { useReceptionStats } from '../../hooks/useReceptionStats';
import { ParcelStatus } from '../../types';
import { isOpenParcel, rangeFromDate, type ReceptionRange } from '../../utils/parcel';

const statusChips = [ParcelStatus.Waiting, ParcelStatus.Due, ParcelStatus.Overdue, ParcelStatus.HandedOver, ParcelStatus.Cancelled] as const;

type StatusChip = 'all' | `${(typeof statusChips)[number]}`;

const rangeLabels = {
  all: 'reception.rangeAll',
  today: 'reception.rangeToday',
  week: 'reception.rangeWeek',
  month: 'reception.rangeMonth',
} as const;

/**
 * Reception desk, laid out like the văn thư lists: the unit picker under the title, the date range and
 * "Tiếp nhận" on the right, status chips with their counts on the header, a search field, then the rows;
 * ticking open parcels brings up the bulk handover bar.
 */
export function ReceptionListScreen() {
  const { t } = useTranslation();
  const connected = useSessionStore((s) => s.connected.parcel);
  const { has, isLoading: capsLoading } = useCapabilities();
  const allowed = has('parcel.reception');

  const [search, setSearch] = useState('');
  const keyword = useDebounced(search.trim(), 350);
  const [status, setStatus] = useState<ParcelStatus | undefined>(undefined);
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
  const [range, setRange] = useState<ReceptionRange>('all');
  const [picker, setPicker] = useState<'department' | 'range' | null>(null);
  const [picked, setPicked] = useState<string[]>([]);

  const departments = useAccessibleDepartments(allowed);
  const fromDate = rangeFromDate(range);
  const stats = useReceptionStats({ departmentId, fromDate });
  const filters = { search: keyword || undefined, status, departmentId, fromDate };

  const query = useInfiniteQuery({
    queryKey: qk.parcels.reception(filters),
    queryFn: ({ pageParam }) => parcelsApi.list({ pageNumber: pageParam, pageSize: DEFAULT_PAGE_SIZE, ...filters }),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    enabled: connected && allowed,
  });
  const items = flattenPages(query.data?.pages);
  const pull = usePullRefresh(() => Promise.all([query.refetch(), stats.refetch()]));
  // Parcels handed over (or cancelled) since they were ticked drop out of the selection.
  const selected = picked.filter((id) => items.some((p) => p.id === id && isOpenParcel(p.status)));
  const department = departments.data?.find((d) => d.id === departmentId);

  const toggle = (id: string) => setPicked(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const changeFilter = (apply: () => void) => {
    apply();
    setPicked([]);
  };

  if (!capsLoading && !allowed) {
    return (
      <ModuleScreen header={<ModuleHeader icon={InboxIcon} title={t('reception.title')} bottom={24} />}>
        <EmptyState icon={LockIcon} message={t('errors.FORBIDDEN')} />
      </ModuleScreen>
    );
  }

  // The stats count Chờ tiếp nhận and Đến hạn together, so those two chips go without a count.
  const counts: Partial<Record<StatusChip, number>> = {
    all: stats.data?.total,
    [String(ParcelStatus.Overdue)]: stats.data?.overdue,
    [String(ParcelStatus.HandedOver)]: stats.data?.handedOver,
    [String(ParcelStatus.Cancelled)]: stats.data?.cancelled,
  };

  const create = () => router.push('/parcels/reception/new');
  const header = (
    <ModuleHeader
      testID="reception-header"
      icon={InboxIcon}
      title={t('reception.title')}
      subtitle={department ? (department.name ?? department.code ?? undefined) : t('reception.allDepartments')}
      onSubtitlePress={() => setPicker('department')}
      subtitleIcon={BuildingIcon}
      right={
        <>
          <HeaderIconButton testID="reception-range" icon={CalendarDaysIcon} label={t('reception.rangeTitle')} badge={range === 'all' ? undefined : 1} onPress={() => setPicker('range')} />
          <HeaderIconButton testID="reception-create" variant="solid" icon={PlusIcon} label={t('reception.create')} onPress={create} />
        </>
      }
      bottom={18}
    >
      <HeaderChips<StatusChip>
        testID="reception-status"
        options={[
          { value: 'all', label: t('reception.allStatuses'), count: counts.all, testID: 'reception-status-all' },
          ...statusChips.map((s) => ({ value: String(s) as StatusChip, label: t(`status.parcel.${s}`), count: counts[String(s) as StatusChip], testID: `reception-status-${s}` })),
        ]}
        value={status === undefined ? 'all' : (String(status) as StatusChip)}
        onChange={(value) => changeFilter(() => setStatus(value === 'all' ? undefined : (Number(value) as ParcelStatus)))}
      />
    </ModuleHeader>
  );

  return (
    <ModuleScreen
      header={header}
      scroll={false}
      overlay={
        selected.length ? (
          <View testID="reception-bulk-bar" className="absolute left-4 right-4 flex-row items-center gap-2 rounded-[16px] py-2.5 pl-4 pr-2.5" style={{ bottom: 16, backgroundColor: '#0F1B2D' }}>
            <Text weight="semibold" numberOfLines={1} className="flex-1 text-body text-white">
              {t('reception.selected', { count: selected.length })}
            </Text>
            <Button size="sm" variant="inverse-soft" label={t('approvals.deselect')} onPress={() => setPicked([])} />
            <Button
              testID="reception-bulk-handover"
              size="sm"
              variant="inverse"
              label={t('reception.handoverSelected')}
              onPress={() => router.push({ pathname: '/parcels/reception/handover', params: { ids: selected.join(',') } })}
            />
          </View>
        ) : null
      }
    >
      <View className="px-4 pb-1 pt-3">
        <TextField
          testID="reception-search"
          leftIcon={SearchIcon}
          value={search}
          onChangeText={setSearch}
          placeholder={t('reception.searchPlaceholder')}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          onEndEditing={() => setPicked([])}
        />
      </View>

      {query.isLoading || capsLoading ? (
        <View className="p-4">
          <ListSkeleton count={3} lines={4} />
        </View>
      ) : query.isError && !items.length ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: CONTENT_PADDING.horizontal, paddingTop: 12, paddingBottom: selected.length ? 110 : CONTENT_PADDING.bottom, gap: CONTENT_PADDING.gap }}
          renderItem={({ item }) => (
            <ReceptionParcelCard
              parcel={item}
              selected={selected.includes(item.id)}
              onToggle={() => toggle(item.id)}
              onPress={() => router.push({ pathname: '/parcels/[id]', params: { id: item.id } })}
            />
          )}
          refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          ListEmptyComponent={
            keyword || status !== undefined || range !== 'all' ? (
              <EmptyState icon={SearchIcon} message={t('reception.empty')} />
            ) : (
              <EmptyState icon={PackageIcon} message={t('reception.empty')} actionLabel={t('reception.create')} onAction={create} />
            )
          }
          ListFooterComponent={query.isFetchingNextPage ? <Text className="py-4 text-center text-meta text-muted">{t('common.loadMore')}</Text> : null}
        />
      )}

      <SelectSheet<string>
        testID="reception-department-sheet"
        visible={picker === 'department'}
        onClose={() => setPicker(null)}
        title={t('reception.chooseDepartment')}
        value={departmentId ?? ''}
        options={[
          { value: '', label: t('reception.allDepartments') },
          ...(departments.data ?? []).map((d) => ({ value: d.id, label: d.name ?? d.code ?? d.id, description: d.fullPathName ?? undefined })),
        ]}
        onSelect={(value) => changeFilter(() => setDepartmentId(value || undefined))}
      />
      <SelectSheet<ReceptionRange>
        visible={picker === 'range'}
        onClose={() => setPicker(null)}
        title={t('reception.rangeTitle')}
        value={range}
        options={(Object.keys(rangeLabels) as ReceptionRange[]).map((value) => ({ value, label: t(rangeLabels[value]) }))}
        onSelect={(value) => changeFilter(() => setRange(value))}
      />
    </ModuleScreen>
  );
}
