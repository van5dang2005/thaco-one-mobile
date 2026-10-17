import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatKey, todayKey, weekdayOf } from '@/core/time/vn';
import { useNow } from '@/shared/hooks/useNow';
import { usePullRefresh } from '@/shared/hooks/usePullRefresh';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { type AppIcon, ChevronRightIcon, CircleCheckIcon, HourglassIcon, ScanQrCodeIcon, UsersIcon } from '@/shared/ui/icons';
import { CardSkeleton } from '@/shared/ui/Skeleton';
import { EmptyState, ErrorState } from '@/shared/ui/StateViews';
import { Text } from '@/shared/ui/Text';
import { type Tone, useToneColors } from '@/shared/ui/tones';

import { GuestPage } from '../components/GuestPage';
import { GuestTopBar } from '../components/GuestTopBar';
import { VisitCard } from '../components/VisitCard';
import { useGuestDashboard } from '../hooks/useGuestDashboard';
import type { GuestScheduleItem } from '../types';
import { byStart, visitStage } from '../utils/dashboard';

/** Visits shown here; "Xem tất cả" opens the day's full list. */
const PREVIEW = 3;

/** The `PREVIEW` visits around now: from the first one not yet gone, topped up with earlier ones near the day's end. */
function previewOf(visits: GuestScheduleItem[]) {
  const firstLive = visits.findIndex((v) => visitStage(v) !== 'left');
  const start = Math.max(0, Math.min(firstLive === -1 ? visits.length : firstLive, visits.length - PREVIEW));
  return visits.slice(start, start + PREVIEW);
}

/**
 * "Lịch khách": the title and date, three KPI cards, the visits around now ("Xem tất cả" opens the day's list), and
 * "Quét mã QR" floating at the bottom, all over the guest screens' full-page background.
 */
export function GuestDashboardScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const now = useNow(60_000);
  const { data, isLoading, isError, error, refetch } = useGuestDashboard();
  const pull = usePullRefresh(refetch);
  const today = todayKey(now);

  const visits = [...(data?.today ?? [])].sort(byStart);
  const bottomEdge = Math.max(insets.bottom, 12);

  return (
    <GuestPage testID="guests-dashboard">
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: bottomEdge + 84 }}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} />}
      >
        <GuestTopBar
          testID="guests-top"
          logo
          title={t('guestSchedule.dashboard.title')}
          subtitle={t('guestSchedule.dashboard.date', { weekday: t(`time.weekday.${String(weekdayOf(today)) as '0'}`), date: formatKey(today) })}
        />

        <View testID="guests-stats" className="mt-6 flex-row gap-2.5">
          <KpiCard tone="wait" icon={UsersIcon} label={t('guestSchedule.dashboard.statTotal')} value={data?.stats.total} />
          <KpiCard tone="warn" icon={HourglassIcon} label={t('guestSchedule.dashboard.statPending')} value={data?.stats.pending} />
          <KpiCard tone="ok" icon={CircleCheckIcon} label={t('guestSchedule.dashboard.statConfirmed')} value={data?.stats.confirmed} />
        </View>

        <View className="mb-3 mt-6 flex-row items-center justify-between gap-3">
          <Text weight="bold" accessibilityRole="header" className="text-ink" style={{ fontSize: 17, lineHeight: 23 }}>
            {t('guestSchedule.dashboard.today')}
          </Text>
          {visits.length ? (
            <Pressable
              testID="guests-see-all"
              accessibilityRole="link"
              hitSlop={10}
              onPress={() => router.push('/guests/list')}
              className="flex-row items-center gap-0.5 active:opacity-70"
            >
              <Text weight="semibold" className="text-primary" style={{ fontSize: 13.5, lineHeight: 18 }}>
                {t('guestSchedule.dashboard.seeAll')}
              </Text>
              <Icon icon={ChevronRightIcon} size={15} color="primary" weight="bold" />
            </Pressable>
          ) : null}
        </View>

        {isLoading ? (
          <>
            <CardSkeleton lines={3} />
            <CardSkeleton lines={3} />
          </>
        ) : isError && !data ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : visits.length ? (
          <View className="gap-2.5">
            {previewOf(visits).map((visit) => (
              <VisitCard key={visit.id} visit={visit} />
            ))}
          </View>
        ) : (
          <EmptyState testID="guests-today-empty" icon={UsersIcon} message={t('guestSchedule.dashboard.todayEmpty')} />
        )}
      </ScrollView>

      <View pointerEvents="box-none" className="absolute bottom-0 left-0 right-0 px-4" style={{ paddingBottom: bottomEdge }}>
        <Button testID="guests-scan" icon={ScanQrCodeIcon} label={t('guestSchedule.dashboard.scan')} onPress={() => router.push('/guests/scan')} />
      </View>
    </GuestPage>
  );
}

/** A counter: white card, the icon in a tinted square, the figure, the label. */
function KpiCard({ tone, icon, label, value }: { tone: Tone; icon: AppIcon; label: string; value?: number }) {
  const c = useToneColors(tone);
  return (
    <Card accessible accessibilityLabel={`${label}: ${value ?? ''}`} className="min-w-0 flex-1 gap-2.5 p-3.5">
      <View className="h-9 w-9 items-center justify-center rounded-[10px]" style={{ backgroundColor: c.tint }}>
        <Icon icon={icon} size={18} rawColor={c.solid} weight="bold" />
      </View>
      <View>
        <Text weight="bold" maxFontSizeMultiplier={1.2} className="text-ink" style={{ fontSize: 24, lineHeight: 29, letterSpacing: -0.4 }}>
          {value === undefined ? '–' : String(value)}
        </Text>
        <Text numberOfLines={1} maxFontSizeMultiplier={1.2} className="text-muted" style={{ fontSize: 12.5, lineHeight: 17 }}>
          {label}
        </Text>
      </View>
    </Card>
  );
}
