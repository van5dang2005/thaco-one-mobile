import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { flattenPages } from '@/core/api/types';
import { useTheme } from '@/core/theme/ThemeProvider';
import { formatKey, todayKey, weekdayOf } from '@/core/time/vn';
import { useNow } from '@/shared/hooks/useNow';
import { usePullRefresh } from '@/shared/hooks/usePullRefresh';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { type AppIcon, ChevronRightIcon, CircleCheckIcon, HourglassIcon, ScanQrCodeIcon, UsersIcon } from '@/shared/ui/icons';
import { CardSkeleton } from '@/shared/ui/Skeleton';
import { EmptyState, ErrorState } from '@/shared/ui/StateViews';
import { Text } from '@/shared/ui/Text';
import { type Tone, useToneColors } from '@/shared/ui/tones';

import { GlassCard } from '../components/GlassCard';
import { GuestPage, guestPageColors } from '../components/GuestPage';
import { GuestScene, useGuestScene } from '../components/GuestScene';
import { GuestTopBar } from '../components/GuestTopBar';
import { VisitCard } from '../components/VisitCard';
import { VisitDetailSheet } from '../components/VisitDetailSheet';
import { useGuestSchedules } from '../hooks/useGuestSchedules';
import type { GuestScheduleItem } from '../types';
import { byStart, visitStage } from '../utils/dashboard';

/** Visits shown here; "Xem tất cả" opens the day's full list. */
const PREVIEW = 3;
/** The counter strip at the default text size: 14 padding, 36 icon, 10 gap, 29 figure, 17 label, 14 padding. */
const STATS_HEIGHT = 120;
/** Height of the toolbar (`GuestTopBar`). */
const TOOLBAR_HEIGHT = 150;
/** Least picture kept above and below the counters. */
const STATS_GAP = 20;
/** Extra picture kept above the counters, so the gate and the minibus driving in show whole over them. */
const STATS_SHIFT = 14;

/** The `PREVIEW` visits around now: from the first one not yet gone, topped up with earlier ones near the day's end. */
function previewOf(visits: GuestScheduleItem[]) {
  const firstLive = visits.findIndex((v) => visitStage(v) !== 'left');
  const start = Math.max(0, Math.min(firstLive === -1 ? visits.length : firstLive, visits.length - PREVIEW));
  return visits.slice(start, start + PREVIEW);
}

/**
 * "Lịch khách": the title and date on the picture of the plant's gate, with a square strip of three counters centred on
 * it, the visits around now on a grey panel with a straight top edge under it ("Xem tất cả" opens the day's list), and
 * "Quét mã QR" floating at the bottom. A visit opens its details in a sheet.
 */
export function GuestDashboardScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scene = useGuestScene();
  /** Height of the pinned counters, measured; starts at their usual height so nothing jumps on the first frame. */
  const [statsHeight, setStatsHeight] = useState(STATS_HEIGHT);
  const [selected, setSelected] = useState<GuestScheduleItem | null>(null);
  const now = useNow(60_000);
  const today = todayKey(now);
  const { data, isLoading, isError, error, refetch } = useGuestSchedules({ day: today, tab: 'all' });
  const pull = usePullRefresh(refetch);

  const counts = data?.pages[0]?.counts;
  const visits = flattenPages(data?.pages).sort(byStart);
  const bottomEdge = Math.max(insets.bottom, 12);
  // The picture shown from the toolbar's top down to the panel: the drawing, made taller with yard if the counters need it.
  const picture = Math.max(scene.height - scene.lift, TOOLBAR_HEIGHT + STATS_SHIFT + statsHeight + STATS_GAP * 2);
  const statsTop = TOOLBAR_HEIGHT + STATS_SHIFT + (picture - TOOLBAR_HEIGHT - STATS_SHIFT - statsHeight) / 2;

  return (
    <GuestPage testID="guests-dashboard">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 8, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} />}
      >
        {/* The picture, edge to edge: the toolbar on it and the counters pinned in the middle of what is left under it. */}
        <View className="-mx-4 px-4" style={{ minHeight: picture }}>
          <GuestScene />
          <GuestTopBar
            testID="guests-top"
            logo
            title={t('guestSchedule.dashboard.title')}
            subtitle={t('guestSchedule.dashboard.date', { weekday: t(`time.weekday.${String(weekdayOf(today)) as '0'}`), date: formatKey(today) })}
          />
          <View testID="guests-stats" onLayout={(e) => setStatsHeight(e.nativeEvent.layout.height)} className="absolute left-4 right-4" style={{ top: statsTop }}>
            <GlassCard style={{ flexDirection: 'row' }}>
              <KpiCell tone="wait" icon={UsersIcon} label={t('guestSchedule.dashboard.statTotal')} value={counts?.total} />
              <StatRule />
              <KpiCell tone="warn" icon={HourglassIcon} label={t('guestSchedule.dashboard.statPending')} value={counts?.pending} />
              <StatRule />
              <KpiCell tone="ok" icon={CircleCheckIcon} label={t('guestSchedule.dashboard.statConfirmed')} value={counts?.confirmed} />
            </GlassCard>
          </View>
        </View>

        <TodayPanel
          bottom={bottomEdge + 84}
          header={
            <View className="flex-row items-center justify-between gap-3">
              <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
                <View className="h-[18px] w-1 rounded-full bg-primary" />
                <Text weight="bold" accessibilityRole="header" numberOfLines={1} className="flex-shrink text-ink" style={{ fontSize: 17, lineHeight: 23 }}>
                  {t('guestSchedule.dashboard.today')}
                </Text>
              </View>
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
          }
        >
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
                <VisitCard key={visit.id} visit={visit} onPress={() => setSelected(visit)} />
              ))}
            </View>
          ) : (
            <EmptyState testID="guests-today-empty" icon={UsersIcon} message={t('guestSchedule.dashboard.todayEmpty')} />
          )}
        </TodayPanel>
      </ScrollView>

      <View pointerEvents="box-none" className="absolute bottom-0 left-0 right-0 px-4" style={{ paddingBottom: bottomEdge }}>
        <Button
          testID="guests-scan"
          icon={ScanQrCodeIcon}
          label={t('guestSchedule.dashboard.scan')}
          onPress={() => router.push('/guests/scan')}
        />
      </View>
      <VisitDetailSheet visit={selected} onClose={() => setSelected(null)} />
    </GuestPage>
  );
}

/**
 * The panel holding the day's visits under the picture: square-topped and edge to edge in the page's grey, its heading,
 * then the list (`children`), which runs down to the page's end.
 */
function TodayPanel({ header, bottom, children }: { header: ReactNode; bottom: number; children: ReactNode }) {
  const { scheme } = useTheme();
  return (
    <View testID="guests-today" className="-mx-4 flex-grow" style={{ backgroundColor: guestPageColors[scheme] }}>
      <View className="px-4 pb-3 pt-5">{header}</View>
      <View testID="guests-today-list" className="flex-grow px-4" style={{ paddingBottom: bottom }}>
        {children}
      </View>
    </View>
  );
}

/** A hairline between two counters of the strip. */
function StatRule() {
  const { scheme } = useTheme();
  return <View style={{ width: StyleSheet.hairlineWidth, marginVertical: 14, backgroundColor: scheme === 'dark' ? 'rgba(255, 255, 255, 0.16)' : 'rgba(15, 27, 45, 0.14)' }} />;
}

/** A counter of the strip: the icon in a tinted square, the figure, the label. */
function KpiCell({ tone, icon, label, value }: { tone: Tone; icon: AppIcon; label: string; value?: number }) {
  const c = useToneColors(tone);
  return (
    <View accessible accessibilityLabel={`${label}: ${value ?? ''}`} style={{ flex: 1, minWidth: 0, gap: 10, padding: 14 }}>
      <View className="h-9 w-9 items-center justify-center rounded-[10px]" style={{ backgroundColor: c.tint }}>
        <Icon icon={icon} size={18} rawColor={c.solid} weight="bold" />
      </View>
      <View>
        <Text weight="bold" numeric maxFontSizeMultiplier={1.2} className="text-ink" style={{ fontSize: 24, lineHeight: 29, letterSpacing: -0.4 }}>
          {value === undefined ? '–' : String(value)}
        </Text>
        <Text numberOfLines={1} maxFontSizeMultiplier={1.2} className="text-muted" style={{ fontSize: 12.5, lineHeight: 17 }}>
          {label}
        </Text>
      </View>
    </View>
  );
}
