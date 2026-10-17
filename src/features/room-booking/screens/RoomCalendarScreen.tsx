import { router, useLocalSearchParams } from 'expo-router';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, G, Line, LinearGradient, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useRoomMe } from '@/core/session/useMe';
import { sameId } from '@/core/session/userTypes';
import type { Palette } from '@/core/theme/palette';
import { useTheme } from '@/core/theme/ThemeProvider';
import { addDays, atMinutes, formatKey, formatMinutes, formatTime, minutesOfDay, parseDateKey, toDateKey, todayKey, weekdayOf, type DateKey } from '@/core/time/vn';
import { useNow } from '@/shared/hooks/useNow';
import { cn } from '@/shared/lib/cn';
import { goBack } from '@/shared/lib/navigation';
import { BottomSheet } from '@/shared/ui/BottomSheet';
import { Button } from '@/shared/ui/Button';
import { DatePickerSheet } from '@/shared/ui/DatePickerSheet';
import { HeaderActionButton } from '@/shared/ui/HeaderBar';
import { Icon } from '@/shared/ui/Icon';
import { type AppIcon, ArrowRightIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, DoorOpenIcon, MapPinIcon, PlusIcon, XIcon } from '@/shared/ui/icons';
import { ModuleScreen } from '@/shared/ui/ModuleScreen';
import { RoundIcon } from '@/shared/ui/RoundIcon';
import { onBlue, useHeaderColors, useLightStatusBar } from '@/shared/ui/ScreenShell';
import { shadows } from '@/shared/ui/shadows';
import { Skeleton } from '@/shared/ui/Skeleton';
import { EmptyState, ErrorState } from '@/shared/ui/StateViews';
import { BookingBadge } from '@/shared/ui/StatusBadge';
import { Text } from '@/shared/ui/Text';
import { toast } from '@/shared/ui/Toast';

import { useAreaPicker } from '../components/AreaPicker';
import { DayStrip } from '../components/DayStrip';
import { AXIS_WIDTH, RoomTimeline, type BlockInfo, type SlotSelection } from '../components/RoomTimeline';
import { useApprovalLevels } from '../hooks/useApprovalLevels';
import { useCrossLevel } from '../hooks/useCrossLevel';
import { useDefaultAreaId } from '../hooks/useDefaultAreaId';
import { useRooms } from '../hooks/useRooms';
import { useSchedule } from '../hooks/useSchedule';
import { defaultDraft, useBookingDraft } from '../store/draftStore';
import { BookingStatus, type BookingDto, type RoomDto } from '../types';
import { BOOKING_HOURS } from '../utils/availability';
import { bookingFrom, bookingPhase, bookingTo, roomDayBlocks, roomHours, type TimelineBlock } from '../utils/booking';
import { weekStartOf } from '../utils/myMeetings';

type Mode = 'day' | 'week';

/** Durations offered by the quick-book chips, in minutes. */
const DURATIONS = [30, 60, 90, 120];

/**
 * 3a: rooms × hours for one day (or the week as an agenda). Tap an empty slot to book it. The header is a picture of
 * an office district at blue hour: Back, the area picker and "Đặt phòng" on top, the month as its headline beside
 * Ngày / Tuần, then the week on a frosted band between ‹ ›. The schedule fills a square-cornered white panel edge to
 * edge below (rounded corners clipped the last room's head).
 */
export function RoomCalendarScreen() {
  const { t } = useTranslation();
  const { scheme } = useTheme();
  const { fg } = useHeaderColors();
  const params = useLocalSearchParams<{ date?: string }>();
  const me = useRoomMe();
  const now = useNow();
  const insets = useSafeAreaInsets();
  useLightStatusBar();
  const defaultAreaId = useDefaultAreaId();
  const [areaChoice, setAreaChoice] = useState<string | undefined>();
  const areaId = areaChoice ?? defaultAreaId;
  const today = todayKey(now);
  const [dateKey, setDateKey] = useState<DateKey>(params.date ?? today);
  const [mode, setMode] = useState<Mode>('day');
  const [datePicker, setDatePicker] = useState(false);
  const [selection, setSelection] = useState<SlotSelection | null>(null);
  const [cluster, setCluster] = useState<BookingDto[] | null>(null);
  const startDraft = useBookingDraft((s) => s.start);
  const area = useAreaPicker(areaId, (value) => {
    setAreaChoice(value);
    setSelection(null);
  }, 'rooms-area');

  const weekStart = weekStartOf(dateKey);
  const rooms = useRooms(areaId);
  const crossLevel = useCrossLevel();
  const levels = useApprovalLevels();
  // The shown week: week agenda and the dots of the strip.
  const schedule = useSchedule({
    fromDate: atMinutes(weekStart, 0).toISOString(),
    toDate: atMinutes(addDays(weekStart, 7), 0).toISOString(),
    areaId,
  });
  // The selected day: fetched again every time the day changes.
  const daySchedule = useSchedule(
    {
      fromDate: atMinutes(dateKey, 0).toISOString(),
      toDate: atMinutes(addDays(dateKey, 1), 0).toISOString(),
      areaId,
    },
    mode === 'day',
    { staleTime: 0 },
  );

  const roomList = rooms.data ?? [];
  const weekBookings = schedule.data ?? [];
  // Until the day answers, the grid shows what the week already has for it.
  const dayBookings = (daySchedule.data ?? weekBookings).filter((b) => toDateKey(bookingFrom(b) ?? new Date(0)) === dateKey);
  const busyDays = new Set(weekBookings.filter((b) => b.status === BookingStatus.Approved || b.status === BookingStatus.Waiting).map((b) => toDateKey(bookingFrom(b) ?? new Date(0))));

  const blocksByRoom: Record<string, TimelineBlock[]> = {};
  roomList.forEach((room) => {
    blocksByRoom[room.id] = roomDayBlocks(dayBookings.filter((b) => sameId(b.roomId ?? b.room?.id, room.id)), dateKey);
  });

  const isToday = dateKey === today;
  const nowMin = minutesOfDay(now);

  /** I booked it or take part in it. */
  const involved = (b: BookingDto) => sameId(b.user?.id, me.data?.id) || (b.participants ?? []).some((p) => sameId(p.userId, me.data?.id));
  // Confidential meetings hide their content from anyone not involved.
  const isHidden = (b: BookingDto) => !!b.isConfidentialContent && !involved(b);
  const visibleTitle = (b: BookingDto) => (isHidden(b) ? t('meeting.confidentialHidden') : (b.content ?? b.code ?? ''));
  const blockInfo = (block: TimelineBlock): BlockInfo => ({ title: visibleTitle(block.bookings[0]), mine: block.bookings.some(involved), hidden: isHidden(block.bookings[0]) });

  const selectDay = (key: DateKey) => {
    setDateKey(key);
    setSelection(null);
  };
  const shift = (direction: 1 | -1) => selectDay(addDays(dateKey, direction * (mode === 'week' ? 7 : 1)));

  const takenBlocks = (room: RoomDto) =>
    // Waiting requests only block rooms that refuse overlapping bookings.
    (blocksByRoom[room.id] ?? []).filter((b) => b.kind === 'approved' || b.kind === 'finished' || (!!room.isDisableOverlappingTimes && (b.kind === 'pending' || b.kind === 'cluster')));

  /** Longest end ≤ start + `minutes` before the room closes or the next taken block. */
  const endFor = (room: RoomDto, start: number, minutes: number) => {
    const { close } = roomHours(room);
    const nextStart = Math.min(...takenBlocks(room).filter((b) => b.startMin > start).map((b) => b.startMin), Infinity);
    return Math.min(start + minutes, close, nextStart);
  };

  const onPressSlot = (room: RoomDto, minute: number) => {
    const { open, close } = roomHours(room);
    if (minute < open || minute + 30 > close) {
      toast.info(t('rooms.outsideHours', { open: formatMinutes(open), close: formatMinutes(close) }));
      return;
    }
    if (dateKey < today || (isToday && minute + 30 <= nowMin)) {
      toast.info(t('booking.timeInPast'));
      return;
    }
    if (takenBlocks(room).some((b) => minute >= b.startMin && minute < b.endMin)) {
      toast.info(t('rooms.slotTaken'));
      return;
    }
    const end = endFor(room, minute, 60);
    if (end - minute < 15) {
      toast.info(t('rooms.slotTaken'));
      return;
    }
    setSelection((current) => (current && sameId(current.roomId, room.id) && current.startMin === minute ? null : { roomId: room.id, startMin: minute, endMin: end }));
  };

  const onPressBlock = (block: TimelineBlock) => {
    if (block.bookings.length > 1) setCluster(block.bookings);
    else router.push({ pathname: '/rooms/bookings/[id]', params: { id: block.bookings[0].id } });
  };

  const selectedRoom = selection ? roomList.find((r) => sameId(r.id, selection.roomId)) : undefined;

  /**
   * The quick-book chips: the standard durations (those running into the next meeting or closing time disabled), plus
   * the selected one when the slot only fits a shorter stretch (45 phút before the next meeting).
   */
  const durations =
    selection && selectedRoom
      ? [...new Set([...DURATIONS, selection.endMin - selection.startMin])]
          .sort((a, b) => a - b)
          .map((minutes) => ({ minutes, fits: endFor(selectedRoom, selection.startMin, minutes) - selection.startMin >= minutes }))
      : [];

  /** Book the selected slot: the wizard opens at B3 with room and time filled in. */
  const quickBook = () => {
    if (!selection) return;
    startDraft({
      ...defaultDraft(),
      areaId,
      dateKey,
      untilKey: addDays(dateKey, 28),
      startMin: selection.startMin,
      endMin: selection.endMin,
      roomId: selection.roomId,
      people: Math.min(selectedRoom?.numberOfSeats ?? 2, 2),
    });
    setSelection(null);
    router.push('/rooms/book/details');
  };

  /** Book without a slot: the wizard opens at B1 in this area, on the shown day when it is a later one. */
  const book = () => {
    const draft = defaultDraft();
    const later = dateKey > draft.dateKey ? { dateKey, untilKey: addDays(dateKey, 28), startMin: 8 * 60, endMin: 9 * 60 } : null;
    startDraft({ ...draft, ...later, areaId });
    router.push('/rooms/book');
  };

  const header = (
    <View testID="rooms-header" style={{ paddingTop: insets.top + 6, paddingHorizontal: 16, paddingBottom: 16 }}>
      <HeaderArt />
      <View className="min-h-11 flex-row items-center gap-3">
        <GlassButton testID="rooms-header-leading" icon={ChevronLeftIcon} label={t('common.back')} onPress={() => goBack()} />
        {/* No title: the area picker stands in for it (screen readers still hear "Lịch phòng"). */}
        <View className="min-w-0 flex-1">
          <Pressable
            testID="rooms-header-subtitle"
            accessibilityRole="button"
            accessibilityLabel={`${t('rooms.title')}, ${area.name}`}
            accessibilityHint={t('rooms.chooseArea')}
            onPress={area.open}
            hitSlop={8}
            className="flex-row items-center gap-1.5 self-start active:opacity-70"
          >
            <Icon icon={MapPinIcon} size={16} rawColor={fg} />
            <Text weight="semibold" numberOfLines={1} maxFontSizeMultiplier={1.2} className="flex-shrink" style={{ fontSize: 14, lineHeight: 19, color: fg }}>
              {area.name}
            </Text>
            <Icon icon={ChevronDownIcon} size={15} weight="bold" rawColor={onBlue(0.7)} />
          </Pressable>
        </View>
        {/* Up here instead of floating over the schedule's last hours. */}
        <HeaderActionButton testID="rooms-book" icon={PlusIcon} label={t('rooms.book')} onPress={book} />
      </View>
      <View className="mt-5 flex-row items-center justify-between gap-3">
        <MonthTitle dateKey={dateKey} onPress={() => setDatePicker(true)} />
        <ModeSwitch
          mode={mode}
          onChange={(m) => {
            setMode(m);
            setSelection(null);
          }}
        />
      </View>
      {/* The week on a frosted band, so the picture never competes with the dates. */}
      <View className="mt-4 flex-row items-center rounded-[16px] p-1" style={{ backgroundColor: onBlue(0.1), borderWidth: 1, borderColor: onBlue(0.16) }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('rooms.previousDay')} onPress={() => shift(-1)} hitSlop={4} className="h-14 w-7 items-center justify-center active:opacity-60">
          <Icon icon={ChevronLeftIcon} size={17} weight="bold" rawColor={onBlue(0.8)} />
        </Pressable>
        <View className="flex-1">
          <DayStrip testID="rooms-day" value={dateKey} today={today} onChange={selectDay} start={weekStart} marked={busyDays} className="" />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('rooms.nextDay')} onPress={() => shift(1)} hitSlop={4} className="h-14 w-7 items-center justify-center active:opacity-60">
          <Icon icon={ChevronRightIcon} size={17} weight="bold" rawColor={onBlue(0.8)} />
        </Pressable>
      </View>
    </View>
  );

  const footer =
    selection && selectedRoom ? (
      <>
        <RoundIcon icon={DoorOpenIcon} size={44} square />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text weight="bold" numberOfLines={1} className="text-ink" style={{ fontSize: 15, lineHeight: 20 }}>
            {selectedRoom.name}
          </Text>
          <Text numberOfLines={1} className="text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
            <Text numeric weight="semibold" className="text-ink-2" style={{ fontSize: 12 }}>
              {`${t(`time.weekdayShort.${String(weekdayOf(dateKey)) as '0'}`)} ${formatKey(dateKey, false)} · ${formatMinutes(selection.startMin)}–${formatMinutes(selection.endMin)}`}
            </Text>
            {selectedRoom.numberOfSeats ? ` · ${t('rooms.seats', { seats: selectedRoom.numberOfSeats })}` : ''}
            {levels(selectedRoom.id) === 0 ? ` · ${t('booking.tagNoApproval')}` : ''}
          </Text>
        </View>
        <Button testID="rooms-quickbook" label={t('rooms.book')} onPress={quickBook} trailing={<Icon icon={ArrowRightIcon} size={16} weight="bold" color="on-primary" />} />
      </>
    ) : undefined;

  // Above the selected slot's bar: how long, and a way out without hunting for the slot again.
  const footerNote =
    selection && selectedRoom ? (
      <View className="flex-row items-center gap-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1" contentContainerClassName="gap-1.5">
          {durations.map(({ minutes, fits }) => {
            const active = minutes === selection.endMin - selection.startMin;
            return (
              <Pressable
                key={minutes}
                testID={`rooms-duration-${minutes}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: active, disabled: !fits }}
                disabled={!fits}
                onPress={() => setSelection({ ...selection, endMin: selection.startMin + minutes })}
                className={cn('h-8 justify-center rounded-full px-3 active:opacity-70', active ? 'bg-primary' : 'border border-input-border', !fits && 'opacity-40')}
              >
                <Text numeric weight={active ? 'bold' : 'semibold'} numberOfLines={1} className={active ? 'text-on-primary' : 'text-ink-2'} style={{ fontSize: 12.5, lineHeight: 16 }}>
                  {t('rooms.duration', { count: minutes })}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable
          testID="rooms-clear-selection"
          accessibilityRole="button"
          accessibilityLabel={t('rooms.clearSelection')}
          onPress={() => setSelection(null)}
          hitSlop={6}
          className="h-8 w-8 items-center justify-center rounded-full bg-off-tint active:opacity-70"
        >
          <Icon icon={XIcon} size={15} weight="bold" color="muted" />
        </Pressable>
      </View>
    ) : undefined;

  // Without the selected slot's bar the schedule runs to the bottom edge, so its last hour clears the home indicator.
  const scrollBottom = footer ? 24 : Math.max(insets.bottom, 12) + 8;

  const body =
    rooms.isLoading ? (
      <TimelineSkeleton />
    ) : rooms.isError ? (
      <View className="p-4">
        <ErrorState error={rooms.error} onRetry={() => void rooms.refetch()} />
      </View>
    ) : roomList.length === 0 ? (
      <View className="p-4">
        <EmptyState icon={DoorOpenIcon} message={t('rooms.noRooms')} />
      </View>
    ) : mode === 'week' ? (
      <ScrollView contentContainerStyle={{ paddingBottom: scrollBottom }}>
        <WeekAgenda
          weekStart={weekStart}
          today={today}
          now={now}
          bookings={weekBookings}
          rooms={roomList}
          title={visibleTitle}
          isMine={involved}
          onOpen={(b) => router.push({ pathname: '/rooms/bookings/[id]', params: { id: b.id } })}
          onPickDay={(day) => {
            setMode('day');
            selectDay(day);
          }}
        />
      </ScrollView>
    ) : (
      <>
        {daySchedule.isError ? <ErrorState compact error={daySchedule.error} onRetry={() => void daySchedule.refetch()} /> : null}
        <RoomTimeline
          rooms={roomList}
          blocksByRoom={blocksByRoom}
          crossLevel={crossLevel}
          dateKey={dateKey}
          startHour={BOOKING_HOURS.start}
          endHour={BOOKING_HOURS.end}
          selection={selection}
          blockInfo={blockInfo}
          onPressBlock={onPressBlock}
          onPressSlot={onPressSlot}
          bottomInset={scrollBottom}
        />
      </>
    );

  return (
    <ModuleScreen header={header} footer={footer} footerNote={footerNote} scroll={false} background="elevated">
      <View className={cn('flex-1 bg-elevated', scheme === 'dark' && 'border-t border-line')} style={shadows.footer}>
        {body}
      </View>

      {area.sheet}
      <DatePickerSheet visible={datePicker} onClose={() => setDatePicker(false)} title={t('rooms.chooseDate')} value={dateKey} onSelect={selectDay} />

      <BottomSheet visible={!!cluster} onClose={() => setCluster(null)} title={t('rooms.clusterTitle')} scrollable>
        <View className="gap-2">
          {(cluster ?? []).map((b) => (
            <AgendaCard
              key={b.id}
              booking={b}
              title={visibleTitle(b)}
              mine={involved(b)}
              now={now}
              onPress={() => {
                setCluster(null);
                router.push({ pathname: '/rooms/bookings/[id]', params: { id: b.id } });
              }}
            />
          ))}
        </View>
      </BottomSheet>
    </ModuleScreen>
  );
}

/** Picture geometry in its 400×300 box, ground (y = 300) on the panel's top edge: towers as [x, width, height]. */
const FAR_TOWERS: [number, number, number][] = [
  [0, 18, 78], [16, 14, 98], [30, 22, 68], [50, 16, 107], [64, 24, 83], [86, 14, 112], [98, 20, 77], [116, 18, 98], [132, 26, 88], [156, 14, 114], [168, 22, 81], [188, 16, 104],
  [202, 24, 91], [224, 14, 109], [236, 20, 79], [254, 18, 98], [270, 26, 86], [294, 16, 110], [308, 22, 82], [328, 14, 103], [340, 24, 88], [362, 16, 108], [376, 24, 83],
];
/** Mid towers gather around the glass tower on the right; the left half, behind the text, keeps only the far line. */
const MID_TOWERS: [number, number, number][] = [
  [150, 44, 64], [192, 30, 86], [226, 40, 124], [264, 46, 94], [372, 34, 134],
];
const GLASS_TOWER: [number, number, number] = [316, 58, 232];

/** A sparse few lit panes per tower on a 7 × 9 grid (panes at +2/+2, 3 × 4), all above the week band (y ≤ 204). */
function litPanes(towers: [number, number, number][], seed: number) {
  const panes: [number, number][] = [];
  towers.forEach(([x, w, h], index) => {
    for (let px = Math.ceil(x / 7) * 7 + 2; px + 3 <= x + w - 2; px += 7) {
      for (let py = Math.ceil((300 - h) / 9) * 9 + 2; py <= 204; py += 9) {
        if ((px * 31 + py * 17 + index * 7 + seed) % 13 === 0) panes.push([px, py]);
      }
    }
  });
  return panes;
}
const LIT_MID = litPanes(MID_TOWERS, 3);

/**
 * The header's picture: an office district at blue hour. A low, hazy skyline runs along the bottom; on the right a glass
 * tower catches a glow among a few mid towers with sparse lit windows, so the left half behind the text stays calm. A
 * scrim at the top keeps the status bar and toolbar readable; night dims the whole picture.
 */
const HeaderArt = memo(function HeaderArt() {
  const { scheme } = useTheme();
  const [gx, gw, gh] = GLASS_TOWER;
  const gTop = 300 - gh;
  return (
    // Sized by absoluteFill alone: percentage sizes on an absolute child resolve against the header's padded content box.
    <Svg pointerEvents="none" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="artSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#03204A" />
          <Stop offset="0.55" stopColor="#0A4A8E" />
          <Stop offset="1" stopColor="#1263B5" />
        </LinearGradient>
        <LinearGradient id="artSide" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#2C8BE6" stopOpacity={0} />
          <Stop offset="1" stopColor="#2C8BE6" stopOpacity={0.35} />
        </LinearGradient>
        <RadialGradient id="artGlow" cx="330" cy="130" r="190" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#7BC0FF" stopOpacity={0.32} />
          <Stop offset="1" stopColor="#7BC0FF" stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="artGlass" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#1A64B0" />
          <Stop offset="1" stopColor="#0A3D78" />
        </LinearGradient>
        <LinearGradient id="artGleam" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.22} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="artScrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#021733" stopOpacity={0.6} />
          <Stop offset="0.4" stopColor="#021733" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width={400} height={300} fill="url(#artSky)" />
      <Rect width={400} height={300} fill="url(#artSide)" />
      <Rect width={400} height={300} fill="url(#artGlow)" />
      <G fill="#4F8FD6" fillOpacity={0.16}>
        {FAR_TOWERS.map(([x, w, h]) => (
          <Rect key={x} x={x} y={300 - h} width={w} height={h} />
        ))}
      </G>
      <G fill="#0B3A72" fillOpacity={0.85}>
        {MID_TOWERS.map(([x, w, h]) => (
          <Rect key={x} x={x} y={300 - h} width={w} height={h} />
        ))}
      </G>
      <G fill="#DCEBFF" fillOpacity={0.5}>
        {LIT_MID.map(([px, py]) => (
          <Rect key={`${px}-${py}`} x={px} y={py} width={3} height={4} />
        ))}
      </G>
      {/* Glass tower: spire, facade grid, a diagonal gleam and a lit roof edge. */}
      <Rect x={gx + gw / 2 - 1} y={gTop - 20} width={2} height={20} fill="#7DB8F5" fillOpacity={0.6} />
      <Rect x={gx} y={gTop} width={gw} height={gh} fill="url(#artGlass)" />
      <G stroke="#8CC4FA" strokeOpacity={0.22} strokeWidth={0.8}>
        {Array.from({ length: Math.floor(gw / 6) }, (_, i) => (
          <Line key={i} x1={gx + 6 * (i + 1)} x2={gx + 6 * (i + 1)} y1={gTop} y2={300} />
        ))}
      </G>
      <G stroke="#8CC4FA" strokeOpacity={0.12} strokeWidth={0.8}>
        {Array.from({ length: Math.floor(gh / 9) }, (_, i) => (
          <Line key={i} x1={gx} x2={gx + gw} y1={gTop + 9 * (i + 1)} y2={gTop + 9 * (i + 1)} />
        ))}
      </G>
      <Polygon points={`${gx + 4},${gTop} ${gx + 26},${gTop} ${gx + gw},${gTop + 96} ${gx + gw},${gTop + 136}`} fill="url(#artGleam)" />
      <Rect x={gx} y={gTop} width={gw} height={2} fill="#9CD0FF" fillOpacity={0.5} />
      <Rect width={400} height={300} fill="url(#artScrim)" />
      {scheme === 'dark' ? <Rect width={400} height={300} fill="#000814" fillOpacity={0.35} /> : null}
    </Svg>
  );
});

/** Frosted round button on the blue: white 16% with a 24% white hairline. */
function GlassButton({ icon, label, onPress, testID }: { icon: AppIcon; label: string; onPress: () => void; testID?: string }) {
  const { fg } = useHeaderColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
      style={{ backgroundColor: onBlue(0.16), borderWidth: 1, borderColor: onBlue(0.24) }}
    >
      <Icon icon={icon} size={19} weight="bold" rawColor={fg} />
    </Pressable>
  );
}

/** Ngày / Tuần on the blue: black 14% track like HeaderSegmented, the selected segment white with primary text. */
function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { fg, soft } = useHeaderColors();
  return (
    <View className="h-9 flex-row rounded-full p-[3px]" style={{ backgroundColor: 'rgba(0, 0, 0, 0.14)' }}>
      {(['day', 'week'] as const).map((m) => {
        const active = m === mode;
        return (
          <Pressable
            key={m}
            testID={`rooms-mode-${m}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(m)}
            className="justify-center rounded-full px-3.5 active:opacity-80"
            style={active ? [shadows.raised, { backgroundColor: fg }] : undefined}
          >
            <Text weight={active ? 'bold' : 'semibold'} style={{ fontSize: 12.5, lineHeight: 16, color: active ? colors.primary : soft }}>
              {m === 'day' ? t('rooms.dayMode') : t('rooms.weekMode')}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The month as the header's headline: "Tháng 10" with the year lighter beside it; opens the date picker. */
function MonthTitle({ dateKey, onPress }: { dateKey: DateKey; onPress: () => void }) {
  const { t } = useTranslation();
  const { fg } = useHeaderColors();
  const { month, year } = parseDateKey(dateKey);
  return (
    <Pressable
      testID="rooms-date"
      accessibilityRole="button"
      accessibilityLabel={`${t('rooms.chooseDate')}: ${formatKey(dateKey)}`}
      onPress={onPress}
      hitSlop={8}
      className="min-w-0 flex-shrink flex-row items-center gap-1.5 active:opacity-70"
    >
      {/* Each span repeats the size: <Text> adds the 14/20 body class, which would clip the headline. */}
      <Text numberOfLines={1} className="flex-shrink" style={{ fontSize: 24, lineHeight: 30, letterSpacing: -0.5 }}>
        <Text weight="bold" style={{ fontSize: 24, lineHeight: 30, color: fg }}>
          {t('rooms.month', { month })}
        </Text>
        <Text weight="medium" style={{ fontSize: 24, lineHeight: 30, color: onBlue(0.55) }}>{` ${year}`}</Text>
      </Text>
      <Icon icon={ChevronDownIcon} size={16} weight="bold" rawColor={onBlue(0.7)} />
    </Pressable>
  );
}

type WeekAgendaProps = {
  weekStart: DateKey;
  today: DateKey;
  now: Date;
  bookings: BookingDto[];
  rooms: RoomDto[];
  title: (b: BookingDto) => string;
  isMine: (b: BookingDto) => boolean;
  onOpen: (b: BookingDto) => void;
  /** The date on the left, or an empty day: that day in Ngày mode. */
  onPickDay: (day: DateKey) => void;
};

/** Week mode: a date rail on the left (today on a blue disc), each day's bookings as cards in time order on the right. */
function WeekAgenda({ weekStart, today, now, bookings, rooms, title, isMine, onOpen, onPickDay }: WeekAgendaProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const roomIds = new Set(rooms.map((r) => r.id.toLowerCase()));
  return (
    <>
      {days.map((day, index) => {
        const items = bookings
          .filter((b) => toDateKey(bookingFrom(b) ?? new Date(0)) === day && roomIds.has(String(b.roomId ?? b.room?.id ?? '').toLowerCase()))
          .sort((a, b) => (a.from ?? '').localeCompare(b.from ?? ''));
        const isToday = day === today;
        const past = day < today;
        const weekday = String(weekdayOf(day)) as '0';
        return (
          <View key={day} testID={`rooms-week-${day}`} className={cn('flex-row gap-3 px-4 py-3', index > 0 && 'border-t border-line-2')}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${isToday ? t('rooms.today') : t(`time.weekday.${weekday}`)}, ${formatKey(day)}`}
              accessibilityHint={t('rooms.openDay')}
              onPress={() => onPickDay(day)}
              hitSlop={4}
              className="w-10 items-center gap-1 active:opacity-70"
            >
              <Text weight="semibold" maxFontSizeMultiplier={1.2} style={{ fontSize: 11, lineHeight: 14, color: isToday ? colors.primary : colors.muted }}>
                {t(`time.weekdayShort.${weekday}`)}
              </Text>
              <View className="h-9 w-9 items-center justify-center rounded-full" style={isToday ? [shadows.primary, { backgroundColor: colors.primary }] : undefined}>
                <Text numeric weight="bold" maxFontSizeMultiplier={1.2} style={{ fontSize: 17, lineHeight: 22, color: isToday ? colors['on-primary'] : past ? colors.subtle : colors.ink }}>
                  {String(parseDateKey(day).day)}
                </Text>
              </View>
            </Pressable>
            <View className="min-w-0 flex-1 gap-2 pt-0.5">
              {items.length ? (
                items.map((b) => <AgendaCard key={b.id} booking={b} title={title(b)} mine={isMine(b)} now={now} onPress={() => onOpen(b)} />)
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onPickDay(day)}
                  className="h-11 flex-row items-center gap-2 rounded-[12px] border border-dashed border-line px-3 active:opacity-70"
                >
                  <Text className="flex-1 text-subtle" style={{ fontSize: 12.5, lineHeight: 16 }}>
                    {t('rooms.noBookingsDay')}
                  </Text>
                  {past ? null : (
                    <>
                      <Text weight="semibold" className="text-primary" style={{ fontSize: 12.5, lineHeight: 16 }}>
                        {t('rooms.openDay')}
                      </Text>
                      <Icon icon={ChevronRightIcon} size={14} weight="bold" color="primary" />
                    </>
                  )}
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </>
  );
}

/** The left stroke of an agenda card: the status badge's tone (CLAUDE.md §5) in one line. */
function statusStroke(status: BookingStatus | null | undefined, colors: Palette) {
  if (status === BookingStatus.Approved) return colors.success;
  if (status === BookingStatus.Waiting) return colors.primary;
  if (status === BookingStatus.Rejected) return colors.danger;
  return colors.subtle;
}

/** One booking as a card: a status bar on the left, from / to, title, room and booker, the status (live while it runs). */
function AgendaCard({ booking, title, mine, now, onPress }: { booking: BookingDto; title: string; mine: boolean; now: Date; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const bar = statusStroke(booking.status, colors);
  const live = booking.status === BookingStatus.Approved && bookingPhase(booking, now) === 'live';
  const over = booking.status === BookingStatus.Canceled || booking.status === BookingStatus.Rejected || booking.status === BookingStatus.Finished;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row overflow-hidden rounded-[12px] active:opacity-75"
      style={{ backgroundColor: colors.panel, borderWidth: mine ? 1.5 : 1, borderColor: mine ? colors.primary : colors.line }}
    >
      <View style={{ width: 3, backgroundColor: bar }} />
      <View className="min-w-0 flex-1 flex-row items-center gap-2.5 py-2.5 pl-2.5 pr-3" style={{ opacity: over ? 0.7 : 1 }}>
        <View style={{ width: 44 }}>
          <Text numeric weight="bold" numberOfLines={1} maxFontSizeMultiplier={1.2} className="text-ink" style={{ fontSize: 13, lineHeight: 17 }}>
            {formatTime(bookingFrom(booking))}
          </Text>
          <Text numeric numberOfLines={1} maxFontSizeMultiplier={1.2} className="text-subtle" style={{ fontSize: 11.5, lineHeight: 15 }}>
            {formatTime(bookingTo(booking))}
          </Text>
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text weight="semibold" numberOfLines={1} className="text-ink" style={{ fontSize: 13.5, lineHeight: 18 }}>
            {title}
          </Text>
          <Text numberOfLines={1} className="text-muted" style={{ fontSize: 11.5, lineHeight: 15 }}>
            {mine ? <Text weight="semibold" className="text-primary" style={{ fontSize: 11.5 }}>{`${t('rooms.withMe')} · `}</Text> : null}
            {[booking.room?.name, booking.user?.fullname].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <BookingBadge status={booking.status ?? 1} live={live} />
      </View>
    </Pressable>
  );
}

/** Loading: the timeline's shape (heads with their day map, a few blocks) rather than generic bars. */
function TimelineSkeleton() {
  return (
    <View className="flex-1" accessibilityLabel="loading">
      <View className="flex-row gap-3 border-b border-line py-3 pr-4" style={{ paddingLeft: AXIS_WIDTH + 8 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} className="flex-1 gap-1.5">
            <Skeleton width="55%" height={14} />
            <Skeleton width="45%" height={14} radius={8} />
            <Skeleton height={4} radius={2} />
          </View>
        ))}
      </View>
      <View className="flex-row gap-3 pr-4 pt-4" style={{ paddingLeft: AXIS_WIDTH + 8 }}>
        {[
          [16, 120],
          [70, 190],
          [0, 96],
        ].map(([top, height], i) => (
          <View key={i} className="flex-1" style={{ paddingTop: top }}>
            <Skeleton height={height} radius={10} />
          </View>
        ))}
      </View>
    </View>
  );
}
