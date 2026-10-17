import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

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
import { GuestPage } from '../components/GuestPage';
import { GuestScene, useGuestScene } from '../components/GuestScene';
import { GuestTopBar } from '../components/GuestTopBar';
import { VisitCard } from '../components/VisitCard';
import { useGuestDashboard } from '../hooks/useGuestDashboard';
import type { GuestScheduleItem } from '../types';
import { byStart, visitStage } from '../utils/dashboard';

/** Visits shown here; "Xem tất cả" opens the day's full list. */
const PREVIEW = 3;
/** A counter card at the default text size: 14 padding, 36 icon, 10 gap, 29 figure, 17 label, 14 padding. */
const STATS_HEIGHT = 120;
/** Height of the toolbar (`GuestTopBar`). */
const TOOLBAR_HEIGHT = 150;
/** Least picture kept above and below the counters. */
const STATS_GAP = 20;
/** How far the panel's rounded top reaches up over the picture (its corner radius). */
const PANEL_OVERLAP = 28;

/** The `PREVIEW` visits around now: from the first one not yet gone, topped up with earlier ones near the day's end. */
function previewOf(visits: GuestScheduleItem[]) {
  const firstLive = visits.findIndex((v) => visitStage(v) !== 'left');
  const start = Math.max(0, Math.min(firstLive === -1 ? visits.length : firstLive, visits.length - PREVIEW));
  return visits.slice(start, start + PREVIEW);
}

/**
 * "Lịch khách": the title and date on the office picture with three KPI cards centred on it, the visits around now on a coloured
 * panel under it ("Xem tất cả" opens the day's list), and "Quét mã QR" floating at the bottom, all over the guest
 * screens' full-page background.
 */
export function GuestDashboardScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scene = useGuestScene();
  /** Height of the pinned counters, measured; starts at their usual height so nothing jumps on the first frame. */
  const [statsHeight, setStatsHeight] = useState(STATS_HEIGHT);
  const now = useNow(60_000);
  const { data, isLoading, isError, error, refetch } = useGuestDashboard();
  const pull = usePullRefresh(refetch);
  const today = todayKey(now);

  const visits = [...(data?.today ?? [])].sort(byStart);
  const bottomEdge = Math.max(insets.bottom, 12);
  // The picture shown from the toolbar's top down to the panel: the drawing, made taller with ground if the counters need it.
  const picture = Math.max(scene.height - scene.lift - PANEL_OVERLAP, TOOLBAR_HEIGHT + statsHeight + STATS_GAP * 2);
  const statsTop = TOOLBAR_HEIGHT + (picture - TOOLBAR_HEIGHT - statsHeight) / 2;

  return (
    <GuestPage testID="guests-dashboard">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 8, paddingHorizontal: 16 }}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={() => void pull.onRefresh()} />}
      >
        {/* The picture, edge to edge: the toolbar on it and the counters pinned in the middle of what is left under it. */}
        <View className="-mx-4 px-4" style={{ minHeight: picture + PANEL_OVERLAP }}>
          <GuestScene />
          <GuestTopBar
            testID="guests-top"
            logo
            title={t('guestSchedule.dashboard.title')}
            subtitle={t('guestSchedule.dashboard.date', { weekday: t(`time.weekday.${String(weekdayOf(today)) as '0'}`), date: formatKey(today) })}
          />
          <View
            testID="guests-stats"
            onLayout={(e) => setStatsHeight(e.nativeEvent.layout.height)}
            className="absolute left-4 right-4 flex-row gap-2.5"
            style={{ top: statsTop }}
          >
            <KpiCard tone="wait" icon={UsersIcon} label={t('guestSchedule.dashboard.statTotal')} value={data?.stats.total} />
            <KpiCard tone="warn" icon={HourglassIcon} label={t('guestSchedule.dashboard.statPending')} value={data?.stats.pending} />
            <KpiCard tone="ok" icon={CircleCheckIcon} label={t('guestSchedule.dashboard.statConfirmed')} value={data?.stats.confirmed} />
          </View>
        </View>

        <TodayPanel
          bottom={bottomEdge + 84}
          header={
            <View className="flex-row items-center justify-between gap-3">
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
                <VisitCard key={visit.id} visit={visit} />
              ))}
            </View>
          ) : (
            <EmptyState testID="guests-today-empty" icon={UsersIcon} message={t('guestSchedule.dashboard.todayEmpty')} />
          )}
        </TodayPanel>
      </ScrollView>

      <View pointerEvents="box-none" className="absolute bottom-0 left-0 right-0 px-4" style={{ paddingBottom: bottomEdge }}>
        <Button testID="guests-scan" icon={ScanQrCodeIcon} label={t('guestSchedule.dashboard.scan')} onPress={() => router.push('/guests/scan')} />
      </View>
    </GuestPage>
  );
}

/**
 * Colours of the "Lịch khách hôm nay" panel: one even colour under its heading; under the list a quiet wash from that
 * colour and two faint glows of the same blue (right, then bottom left).
 */
const panelTones = {
  light: {
    base: '#DDE9F7',
    wash: ['#DDE9F7', '#D6E4F5'],
    glows: [
      { color: '#5B9BE6', opacity: 0.14, cx: '90%', cy: '30%', r: 220 },
      { color: '#5B9BE6', opacity: 0.12, cx: '10%', cy: '90%', r: 260 },
    ],
  },
  dark: {
    base: '#12294A',
    wash: ['#12294A', '#0F2140'],
    glows: [
      { color: '#2A6DC4', opacity: 0.16, cx: '90%', cy: '30%', r: 220 },
      { color: '#2A6DC4', opacity: 0.14, cx: '10%', cy: '90%', r: 260 },
    ],
  },
};

/**
 * The sheet holding the day's visits: rounded on top over the picture's last `PANEL_OVERLAP`, edge to edge, its heading
 * on the even colour and the list (`children`) on the wash, which runs down to the page's end.
 */
function TodayPanel({ header, bottom, children }: { header: ReactNode; bottom: number; children: ReactNode }) {
  const c = panelTones[useTheme().scheme];
  return (
    <View
      testID="guests-today"
      className="-mx-4 flex-grow overflow-hidden rounded-t-[28px]"
      style={{ marginTop: -PANEL_OVERLAP, backgroundColor: c.base }}
    >
      <View className="px-4 pb-3 pt-5">{header}</View>
      <View testID="guests-today-list" className="flex-grow px-4" style={{ paddingBottom: bottom }}>
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="todayWash" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.wash[0]} />
              <Stop offset="1" stopColor={c.wash[1]} />
            </LinearGradient>
            {c.glows.map((g, i) => (
              <RadialGradient key={i} id={`todayGlow${i}`}>
                <Stop offset="0" stopColor={g.color} stopOpacity={g.opacity} />
                <Stop offset="1" stopColor={g.color} stopOpacity={0} />
              </RadialGradient>
            ))}
          </Defs>
          <Rect width="100%" height="100%" fill="url(#todayWash)" />
          {c.glows.map((g, i) => (
            <Circle key={i} cx={g.cx} cy={g.cy} r={g.r} fill={`url(#todayGlow${i})`} />
          ))}
        </Svg>
        {children}
      </View>
    </View>
  );
}

/** A counter: glass drop over the picture, the icon in a tinted square, the figure, the label. */
function KpiCard({ tone, icon, label, value }: { tone: Tone; icon: AppIcon; label: string; value?: number }) {
  const c = useToneColors(tone);
  return (
    <GlassCard accessible accessibilityLabel={`${label}: ${value ?? ''}`} style={{ flex: 1, minWidth: 0, gap: 10, padding: 14 }}>
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
    </GlassCard>
  );
}
