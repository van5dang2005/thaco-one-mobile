import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { HeaderActionButton, HeaderTitleIcon } from '@/shared/ui/HeaderBar';
import { Icon } from '@/shared/ui/Icon';
import { type AppIcon, ArrowRightIcon, ChartGanttIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, DoorOpenIcon, MapPinIcon, PlusIcon, XIcon } from '@/shared/ui/icons';
import { ModuleScreen } from '@/shared/ui/ModuleScreen';
import { RoundIcon } from '@/shared/ui/RoundIcon';
import { onBlue, useHeaderColors, useLightStatusBar } from '@/shared/ui/ScreenShell';
import { shadows } from '@/shared/ui/shadows';
import { EmptyState, ErrorState } from '@/shared/ui/StateViews';
import { BookingBadge } from '@/shared/ui/StatusBadge';
import { Text } from '@/shared/ui/Text';
import { toast } from '@/shared/ui/Toast';

import { useAreaPicker } from '../components/AreaPicker';
import { CalendarHeaderArt } from '../components/CalendarHeaderArt';
import { DayStrip } from '../components/DayStrip';
import { RoomTimeline, TimelineSkeleton, type BlockInfo, type SlotSelection } from '../components/RoomTimeline';
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
 * Gap between the toolbar and the area, where the header's picture shows: 28pt on today's phones, down to 10pt on a
 * 667pt-tall screen (iPhone SE), so a short screen keeps its hours for the schedule.
 */
/** Backdrop of the week band: the header's own blue (navy at night), deepened, over the picture. */
const WEEK_BAND = { light: 'rgba(0, 48, 100, 0.62)', dark: 'rgba(5, 11, 22, 0.66)' };

const pictureGap = (windowHeight: number) => Math.round(Math.min(28, Math.max(10, 10 + (windowHeight - 667) / 6)));

/**
 * 3a: rooms × hours for one day (or the week as an agenda). Tap an empty slot to book it. The header is a picture of
 * an office district, by day or by night with the theme (`CalendarHeaderArt`): Back, the title and "Đặt phòng" on
 * top, the picture between them and the area picker, the month as the headline under it beside Ngày / Tuần, then the
 * week on a frosted band between ‹ ›. The schedule fills a square-cornered panel edge to edge below (rounded corners
 * clipped the last room's head): white paper with a column per room.
 */
export function RoomCalendarScreen() {
  const { t } = useTranslation();
  const { scheme } = useTheme();
  const { fg } = useHeaderColors();
  const params = useLocalSearchParams<{ date?: string }>();
  const me = useRoomMe();
  const now = useNow();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
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

  /**
   * The free stretch around a slot starting at `start`, which the selection may be dragged in: from the end of the taken
   * block before it (or opening time, or today's current quarter hour) to the start of the next one (or closing time).
   */
  const limitsFor = (room: RoomDto, start: number) => {
    const { open } = roomHours(room);
    const earliest = isToday ? Math.floor(nowMin / 15) * 15 : open;
    const before = takenBlocks(room)
      .filter((b) => b.endMin <= start)
      .map((b) => b.endMin);
    return { minStart: Math.min(start, Math.max(open, earliest, ...before)), maxEnd: endFor(room, start, 24 * 60) };
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
    void Haptics.selectionAsync();
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
      <CalendarHeaderArt />
      <View className="min-h-11 flex-row items-center gap-3">
        <GlassButton testID="rooms-header-leading" icon={ChevronLeftIcon} label={t('common.back')} onPress={() => goBack()} />
        <HeaderTitleIcon icon={ChartGanttIcon} size={36} />
        <Text weight="bold" numberOfLines={1} accessibilityRole="header" className="min-w-0 flex-1" style={{ fontSize: 18, lineHeight: 23, letterSpacing: -0.2, color: fg }}>
          {t('rooms.title')}
        </Text>
        {/* Up here instead of floating over the schedule's last hours. */}
        <HeaderActionButton testID="rooms-book" icon={PlusIcon} label={t('rooms.book')} onPress={book} />
      </View>
      {/* The area in a frosted pill over the month, where the picture leaves room for a long name. */}
      <Pressable
        testID="rooms-header-subtitle"
        accessibilityRole="button"
        accessibilityLabel={area.name}
        accessibilityHint={t('rooms.chooseArea')}
        onPress={area.open}
        hitSlop={6}
        className="h-7 max-w-full flex-row items-center gap-1 self-start rounded-full pl-2.5 pr-2 active:opacity-70"
        style={{ marginTop: pictureGap(windowHeight), backgroundColor: onBlue(0.16), borderWidth: 1, borderColor: onBlue(0.2) }}
      >
        <Icon icon={MapPinIcon} size={14} rawColor={fg} />
        <Text weight="semibold" numberOfLines={1} maxFontSizeMultiplier={1.2} className="flex-shrink" style={{ fontSize: 13, lineHeight: 17, color: fg }}>
          {area.name}
        </Text>
        <Icon icon={ChevronDownIcon} size={14} weight="bold" rawColor={onBlue(0.75)} />
      </Pressable>
      <View className="mt-2 flex-row items-center justify-between gap-3">
        <MonthTitle dateKey={dateKey} onPress={() => setDatePicker(true)} />
        <ModeSwitch
          mode={mode}
          onChange={(m) => {
            setMode(m);
            setSelection(null);
          }}
        />
      </View>
      {/* The week on a deep frosted band: the towers only show faintly through it, so the dates (weekends at 45%) stay clear. */}
      <View className="mt-4 flex-row items-center rounded-[16px] p-1" style={{ backgroundColor: scheme === 'dark' ? WEEK_BAND.dark : WEEK_BAND.light, borderWidth: 1, borderColor: onBlue(0.16) }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('rooms.previousDay')} onPress={() => shift(-1)} hitSlop={4} className="h-14 w-7 items-center justify-center active:opacity-60">
          <Icon icon={ChevronLeftIcon} size={17} weight="bold" rawColor={onBlue(0.8)} />
        </Pressable>
        <View className="flex-1">
          <DayStrip testID="rooms-day" variant="calendar" value={dateKey} today={today} onChange={selectDay} start={weekStart} marked={busyDays} className="" />
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
                onPress={() => {
                  void Haptics.selectionAsync();
                  setSelection({ ...selection, endMin: selection.startMin + minutes });
                }}
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
          selectionLimits={selection && selectedRoom ? limitsFor(selectedRoom, selection.startMin) : undefined}
          onChangeSelection={setSelection}
          onClearSelection={() => setSelection(null)}
          blockInfo={blockInfo}
          onPressBlock={onPressBlock}
          onPressSlot={onPressSlot}
          bottomInset={scrollBottom}
        />
      </>
    );

  return (
    <ModuleScreen header={header} footer={footer} footerNote={footerNote} scroll={false}>
      <View className={cn('flex-1 bg-canvas', scheme === 'dark' && 'border-t border-line')} style={shadows.footer}>
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

/**
 * Ngày / Tuần on the picture: black 14% track like HeaderSegmented by day, frosted like the week band at night (black
 * vanishes on the night sky); the selected segment white with header-blue text, like the selected day.
 */
function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const { fg, soft } = useHeaderColors();
  return (
    <View
      className="h-7 flex-row rounded-full p-[2px]"
      style={scheme === 'dark' ? { backgroundColor: onBlue(0.1), borderWidth: 1, borderColor: onBlue(0.16) } : { backgroundColor: 'rgba(0, 0, 0, 0.14)' }}
    >
      {(['day', 'week'] as const).map((m) => {
        const active = m === mode;
        return (
          <Pressable
            key={m}
            testID={`rooms-mode-${m}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(m)}
            hitSlop={{ top: 8, bottom: 8 }}
            className="justify-center rounded-full px-2.5 active:opacity-80"
            style={active ? [shadows.raised, { backgroundColor: fg }] : undefined}
          >
            <Text weight={active ? 'bold' : 'semibold'} style={{ fontSize: 11.5, lineHeight: 14, color: active ? colors.header : soft }}>
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
      style={{ backgroundColor: colors.elevated, borderWidth: mine ? 1.5 : 1, borderColor: mine ? colors.primary : colors.line }}
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
