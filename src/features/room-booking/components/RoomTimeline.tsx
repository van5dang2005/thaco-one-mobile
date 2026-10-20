import * as Haptics from 'expo-haptics';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, useWindowDimensions, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { givenName, sameId } from '@/core/session/userTypes';
import { useTheme } from '@/core/theme/ThemeProvider';
import { withAlpha } from '@/core/theme/palette';
import { formatMinutes, minutesOfDay, todayKey, type DateKey } from '@/core/time/vn';
import { useNow } from '@/shared/hooks/useNow';
import { initialsOf } from '@/shared/ui/Avatar';
import { Icon } from '@/shared/ui/Icon';
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, ChevronRightIcon, FoldVerticalIcon, HourglassIcon, LockIcon, PlusIcon, UnfoldVerticalIcon, UsersIcon } from '@/shared/ui/icons';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Text } from '@/shared/ui/Text';

import type { RoomDto } from '../types';
import { splitDuration } from '../utils/availability';
import { dragSelection, freeGaps, isRoomBusy, roomHours, roomLabels, type CrossLevel, type DragHandle, type TimelineBlock } from '../utils/booking';

/** Height of an hour as the schedule opens; pinching (or the corner button) steps through the zoom levels. */
export const HOUR_HEIGHT = 66;
/** The closest zoom level. */
const HOUR_HEIGHT_DETAIL = 100;
/** The farthest zoom level fits the whole day on screen, within these bounds. */
const HOUR_HEIGHT_FIT = { min: 28, max: 56 };
/** Kept clear under the last hour when the whole day is fitted: the grid's 10pt foot and the home indicator's inset. */
const FIT_RESERVE = 56;
/** A pinch steps one zoom level each time it grows or shrinks by this factor. */
const PINCH_STEP = 1.3;
/** Narrowest room column; columns widen to fill the screen (see `columnWidthFor`). */
export const COLUMN_WIDTH = 96;
/** Hour labels column: "07:00" keeps a clear margin from the screen's edge. */
export const AXIS_WIDTH = 50;
/** Minimum height of the head row. */
const HEAD_HEIGHT = 78;
/** Space above the first hour inside the scroll view. */
const GRID_TOP = 10;
/** Blocks sit this far inside the hairlines between rooms… */
const INSET_X = 3;
/** …and this far inside their hours, so back-to-back meetings stay 2pt apart. */
const INSET_Y = 1;
const BLOCK_RADIUS = 8;
/** The status bar down the left edge of a block. */
const ACCENT = 3;
const TITLE_LINE = 16;
/** Half-hour lines show once an hour is this tall (not on the whole-day zoom). */
const HALF_HOUR_MIN = 48;
const FADE_WIDTH = 36;
/** The heads fade wider than the grid, so the "+N" chip sits on a clear patch instead of over a cut-off name. */
const HEAD_FADE_WIDTH = 76;
/** Light mode: the heads cast a soft shadow on the grid scrolling under them (dark mode keeps the hairline alone). */
const HEAD_SHADOW = { boxShadow: '0px 6px 14px rgba(15, 27, 45, 0.06)' };
/** The selection glides and stretches when it moves or its duration changes. */
const GLIDE = LinearTransition.duration(180);
/** The selection moves and stretches in steps of this many minutes. */
const SNAP = 15;
/** Touch room above and below the selection's card, so its edges are easy to catch. */
const GRAB = 10;
/** A label pinned to the top of the schedule keeps this far below it. */
const STICKY_GAP = 8;

/** The zoom level last picked, so the schedule reopens at it (for this session). */
let lastZoom = 1;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type SlotSelection = { roomId: string; startMin: number; endMin: number };

/** What the screen knows about a block's first booking: its shown title, whether I am in it, whether the title is hidden. */
export type BlockInfo = { title: string; mine: boolean; hidden: boolean };

type Props = {
  rooms: RoomDto[];
  blocksByRoom: Record<string, TimelineBlock[]>;
  crossLevel: (room: RoomDto) => CrossLevel;
  dateKey: DateKey;
  startHour: number;
  endHour: number;
  selection: SlotSelection | null;
  /** The free stretch around the selection, which it may be dragged in: from what ends before it to what starts after it. */
  selectionLimits?: { minStart: number; maxEnd: number };
  /** The selection dragged to new hours; without it the selection stays put. */
  onChangeSelection?: (selection: SlotSelection) => void;
  /** The selection tapped: let it go. */
  onClearSelection?: () => void;
  blockInfo: (block: TimelineBlock) => BlockInfo;
  onPressBlock: (block: TimelineBlock) => void;
  onPressSlot: (room: RoomDto, minute: number) => void;
  /** Bottom padding so the last hour can scroll above overlays. */
  bottomInset?: number;
};

/**
 * Rooms that fit share the whole width; otherwise as many 96pt+ columns as fit, plus half of the next one peeking at
 * the right edge so the row reads as scrollable.
 */
function columnWidthFor(viewport: number, count: number) {
  if (count * COLUMN_WIDTH <= viewport) return viewport / Math.max(1, count);
  const full = Math.max(1, Math.floor(viewport / COLUMN_WIDTH - 0.5));
  return viewport / (full + 0.5);
}

/**
 * The schedule's paper (white by day, a step above the canvas at night) and the wash over hours that cannot be
 * booked: gone already, or outside a room's opening hours.
 */
function usePaper() {
  const { colors, scheme } = useTheme();
  return scheme === 'dark'
    ? { paper: colors['surface-2'], wash: withAlpha(colors.bg, 0.85) }
    : { paper: colors.elevated, wash: withAlpha(colors.canvas, 0.7) };
}

/** Diagonal hatching `gap` apart: pending requests, rooms I may not book. */
function Stripes({ color, background = 'transparent', weight = 1.5, gap = 7 }: { color: string; background?: string; weight?: number; gap?: number }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        {/* Diagonal strokes drawn in the tile (a rotated pattern renders as dots on some devices). */}
        <Pattern id="stripes" patternUnits="userSpaceOnUse" width={gap} height={gap}>
          <Path d={`M-2,2 L2,-2 M0,${gap} L${gap},0 M${gap - 2},${gap + 2} L${gap + 2},${gap - 2}`} stroke={color} strokeWidth={weight} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={background} />
      <Rect width="100%" height="100%" fill="url(#stripes)" />
    </Svg>
  );
}

/**
 * Room schedule of design 3a: time runs down (66pt per hour) under a fixed hour axis, one column per room on white
 * paper, split by hairlines. Hour lines run across (half hours fainter); the hours that cannot be booked, gone already or
 * outside the room's opening hours, are washed grey, and a room I may not book is hatched; each stretch still free to
 * book is a clean card ringed in faint blue marked "+ Trống" with its hours. Heads show the room's name large with
 * its seats, its status (now for today, the day's count otherwise) and its whole day as a thin bar; the room being
 * booked has its name in blue and its head and column tinted. The hour axis shows each hour in ink with a quieter ":00".
 *
 * Blocks are softly tinted cards with a 3pt status edge, the title over the time: approved green, pending blue with
 * faint hatching and an hourglass, meetings I am in outlined in blue, the past ones faded. The current time is a red
 * line with a breathing halo; scrolled out of view, a "Bây giờ" chip brings it back. Blocks fade in with each day; the
 * selection pops in and glides to its new slot or length.
 *
 * A long block keeps its title and time pinned under the top edge while it scrolls past. The selection can be dragged:
 * the card moves it, its top or bottom edge stretches it, in 15-minute steps with a tick each, inside the free stretch
 * around it; a tap lets it go. Pinching steps the hour height between the whole day on one screen, the default and a
 * closer look, keeping the hour under the fingers in place; the corner button above the hours switches between the
 * whole day and the default.
 */
export function RoomTimeline({
  rooms,
  blocksByRoom,
  crossLevel,
  dateKey,
  startHour,
  endHour,
  selection,
  selectionLimits,
  onChangeSelection,
  onClearSelection,
  blockInfo,
  onPressBlock,
  onPressSlot,
  bottomInset = 24,
}: Props) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const { paper, wash } = usePaper();
  const window = useWindowDimensions();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const columnsRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const scrollHeight = useSharedValue(0);
  const [viewport, setViewport] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  // Heads grow when a room name wraps; the right-edge "+N" chip centres on them.
  const [headHeight, setHeadHeight] = useState(HEAD_HEIGHT);
  // Where today's red line went while it is scrolled out of view; the chip that brings it back points there.
  const [nowAway, setNowAway] = useState<'above' | 'below' | null>(null);
  // The tallest the schedule has been: the selected slot's bar only ever takes height away, so the fitted day stays put.
  const [fullHeight, setFullHeight] = useState(0);
  const [zoom, setZoom] = useState(lastZoom);
  // The minute to keep at `offset` from the top of the schedule once a new zoom level has laid out.
  const anchor = useRef<{ minute: number; offset: number } | null>(null);
  const now = useNow();
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const gridStart = startHour * 60;
  const gridEnd = endHour * 60;
  const fitHeight = fullHeight
    ? Math.min(HOUR_HEIGHT_FIT.max, Math.max(HOUR_HEIGHT_FIT.min, (fullHeight - GRID_TOP - FIT_RESERVE) / Math.max(1, endHour - startHour)))
    : HOUR_HEIGHT_FIT.min;
  const levels = [fitHeight, HOUR_HEIGHT, HOUR_HEIGHT_DETAIL];
  const hourHeight = levels[zoom];
  const height = (endHour - startHour) * hourHeight;
  // Until the heads report their width, the window gives a close enough guess (no jump on first layout).
  const width = viewport || window.width - AXIS_WIDTH;
  const column = columnWidthFor(width, rooms.length);
  const columnsWidth = rooms.length * column;
  const today = todayKey(now);
  const isToday = dateKey === today;
  const isPastDay = dateKey < today;
  const nowMin = minutesOfDay(now);
  const y = (minute: number) => ((minute - gridStart) / 60) * hourHeight;
  const showNow = isToday && nowMin >= gridStart && nowMin <= gridEnd;
  const nowY = y(nowMin);
  // Everything above this minute is over: the whole day before today, up to now today.
  const pastEnd = isPastDay ? gridEnd : isToday ? Math.min(Math.max(nowMin, gridStart), gridEnd) : gridStart;
  // Rooms not fully in view yet: the "+N" chip at the right edge.
  const hidden = Math.max(0, rooms.length - Math.floor((offsetX + width + 8) / column));
  // Only what tells the rooms apart, under what they share: "MAZDA_Phòng họp 1" heads as MAZDA / 1, "Phòng họp 18.1" as Phòng họp / 18.1.
  const labels = roomLabels(rooms);
  const selectedIndex = selection ? rooms.findIndex((room) => sameId(room.id, selection.roomId)) : -1;

  /** The stretches of a room's column that cannot be booked: before it opens (or before now) and after it closes. */
  const unbookable = (room: RoomDto): [number, number][] => {
    const { open, close } = roomHours(room);
    const from = Math.min(gridEnd, Math.max(gridStart, open, pastEnd));
    const to = Math.max(from, Math.min(gridEnd, close));
    return (
      [
        [gridStart, from],
        [to, gridEnd],
      ] as [number, number][]
    ).filter(([a, b]) => b > a);
  };

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
  });
  const onScrollY = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });
  const headStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -scrollX.get() }] }));

  // The two scroll views as gestures, so a drag on the selection can hold them still.
  const verticalScroll = useMemo(() => Gesture.Native(), []);
  const horizontalScroll = useMemo(() => Gesture.Native(), []);

  // Scroll to an hour before now (or to the first hour) whenever the day changes.
  useEffect(() => {
    const target = isToday ? nowMin - 60 : gridStart;
    const timer = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, y(target)), animated: false }), 60);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, startHour]);

  // Is the red line above or below what the scroll view shows? Worked out on the UI thread; re-renders only on a change.
  useAnimatedReaction(
    () => {
      const line = nowY + GRID_TOP;
      const top = scrollY.get();
      if (!showNow || !scrollHeight.get()) return null;
      return line < top + 4 ? 'above' : line > top + scrollHeight.get() - 4 ? 'below' : null;
    },
    (side, previous) => {
      if (side !== previous) scheduleOnRN(setNowAway, side);
    },
    [showNow, nowY],
  );

  /** Switch to zoom level `next`, keeping the minute `offset` below the top of the schedule where it is. */
  const zoomTo = (next: number, offset: number) => {
    const level = Math.min(levels.length - 1, Math.max(0, next));
    if (level === zoom) return;
    anchor.current = { minute: gridStart + ((scrollY.get() + offset - GRID_TOP) / hourHeight) * 60, offset };
    lastZoom = level;
    setZoom(level);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const zoomStep = (direction: 1 | -1, focalY: number) => zoomTo(zoom + direction, focalY);

  // The new zoom level is laid out: put the anchored minute back under the fingers (or the middle of the schedule).
  useLayoutEffect(() => {
    const target = anchor.current;
    if (!target) return;
    anchor.current = null;
    const max = Math.max(0, GRID_TOP + height + 10 + bottomInset - scrollHeight.get());
    scrollRef.current?.scrollTo({ y: Math.min(max, Math.max(0, GRID_TOP + y(target.minute) - target.offset)), animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hourHeight]);

  // Pinch out for a closer look, in for more of the day: one level each time the pinch grows or shrinks by PINCH_STEP.
  const pinchBase = useSharedValue(1);
  const pinch = Gesture.Pinch()
    .simultaneousWithExternalGesture(verticalScroll)
    .onStart(() => {
      pinchBase.set(1);
    })
    .onUpdate((e) => {
      const ratio = e.scale / pinchBase.get();
      if (ratio > PINCH_STEP || ratio < 1 / PINCH_STEP) {
        pinchBase.set(e.scale);
        scheduleOnRN(zoomStep, ratio > 1 ? 1 : -1, e.focalY);
      }
    });

  /** The stretches of a room still free to book: open, not gone yet, under no meeting. */
  const gapsFor = (room: RoomDto) => {
    const { open, close } = roomHours(room);
    return freeGaps(blocksByRoom[room.id] ?? [], Math.max(open, pastEnd, gridStart), Math.min(close, gridEnd));
  };

  /** A column read out: the room and the stretches still free to book ("Trống 12:00–14:00, 16:00–20:00"). */
  const columnLabel = (room: RoomDto) => {
    const free = gapsFor(room)
      .map((gap) => `${formatMinutes(gap.startMin)}–${formatMinutes(gap.endMin)}`)
      .join(', ');
    return [room.name ?? '', free ? `${t('rooms.free')} ${free}` : null].filter(Boolean).join(', ');
  };

  const onColumnPress = (room: RoomDto) => (event: GestureResponderEvent) => {
    const minute = gridStart + Math.floor(((event.nativeEvent.locationY / hourHeight) * 60) / 30) * 30;
    onPressSlot(room, minute);
  };

  /** The "+N" chip: the next screenful of rooms, starting at the first one not fully shown. */
  const showMoreRooms = () => {
    const first = Math.floor((offsetX + width + 8) / column);
    const x = Math.min(first * column, columnsWidth - width);
    columnsRef.current?.scrollTo({ x, animated: true });
    setOffsetX(x);
  };

  return (
    <View className="flex-1" style={{ backgroundColor: paper }}>
      {/* Column heads: fixed vertically, follow the horizontal scroll of the grid; a soft shadow lifts them over it. */}
      <View
        className="z-10 flex-row"
        style={[{ minHeight: HEAD_HEIGHT, backgroundColor: paper, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line }, scheme === 'dark' ? null : HEAD_SHADOW]}
        onLayout={(e) => setHeadHeight(e.nativeEvent.layout.height)}
      >
        {/* Over the hours: the zoom switch (whole day ↔ default), the time zone under it. */}
        <View className="items-center justify-center gap-1" style={{ width: AXIS_WIDTH }}>
          <Pressable
            testID="timeline-zoom"
            accessibilityRole="button"
            accessibilityLabel={zoom === 0 ? t('rooms.zoomIn') : t('rooms.zoomOut')}
            onPress={() => zoomTo(zoom === 0 ? 1 : 0, scrollHeight.get() / 2)}
            hitSlop={8}
            className="h-7 w-7 items-center justify-center rounded-full bg-primary-tint active:opacity-70"
          >
            <Icon icon={zoom === 0 ? UnfoldVerticalIcon : FoldVerticalIcon} size={14} weight="bold" color="primary" />
          </Pressable>
          <Text numeric weight="medium" maxFontSizeMultiplier={1} className="text-subtle" style={{ fontSize: 9, lineHeight: 11 }}>
            {t('rooms.timezone')}
          </Text>
        </View>
        <View className="flex-1 overflow-hidden" onLayout={(e) => setViewport(e.nativeEvent.layout.width)}>
          <Animated.View style={[{ flexDirection: 'row', minHeight: HEAD_HEIGHT }, headStyle]}>
            {rooms.map((room, index) => (
              <RoomHead
                key={room.id}
                room={room}
                label={labels[room.id] ?? { group: '', name: room.name ?? '' }}
                width={column}
                first={index === 0}
                blocks={blocksByRoom[room.id] ?? []}
                locked={crossLevel(room) === 'blocked'}
                selected={index === selectedIndex}
                isToday={isToday}
                isPastDay={isPastDay}
                nowMin={nowMin}
                gridStart={gridStart}
                gridEnd={gridEnd}
                pastEnd={pastEnd}
              />
            ))}
          </Animated.View>
        </View>
      </View>

      <GestureDetector gesture={pinch}>
        <View className="flex-1" collapsable={false}>
          <GestureDetector gesture={verticalScroll}>
            <Animated.ScrollView
              ref={scrollRef}
              contentContainerStyle={{ paddingTop: GRID_TOP, paddingBottom: bottomInset }}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={onScrollY}
              onLayout={(e) => {
                const measured = e.nativeEvent.layout.height;
                scrollHeight.set(measured);
                setFullHeight((tallest) => Math.max(tallest, measured));
              }}
            >
              <View style={{ height: height + 10, flexDirection: 'row' }}>
                {/* Hour axis: one label per hour line, the hour in ink and its ":00" quieter, the hours gone faint; the red "now" tab takes the one it covers. */}
                <View style={{ width: AXIS_WIDTH, height }}>
                  {hours.map((hour) => {
                    const top = y(hour * 60);
                    if (showNow && Math.abs(top - nowY) < 22) return null;
                    const past = hour * 60 < pastEnd;
                    return (
                      <Text
                        key={hour}
                        numeric
                        numberOfLines={1}
                        maxFontSizeMultiplier={1}
                        className="absolute"
                        style={{ top: top - 8, left: 0, width: AXIS_WIDTH - 10, textAlign: 'right', fontSize: 11.5, lineHeight: 16 }}
                      >
                        <Text numeric weight="semibold" maxFontSizeMultiplier={1} style={{ fontSize: 11.5, lineHeight: 16, color: past ? colors.faint : colors['ink-2'] }}>
                          {String(hour).padStart(2, '0')}
                        </Text>
                        <Text numeric weight="medium" maxFontSizeMultiplier={1} style={{ fontSize: 11.5, lineHeight: 16, color: past ? colors.faint : colors.subtle }}>
                          :00
                        </Text>
                      </Text>
                    );
                  })}
                </View>

                <GestureDetector gesture={horizontalScroll}>
                  <Animated.ScrollView
                    ref={columnsRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    onScroll={onScroll}
                    onMomentumScrollEnd={(e) => setOffsetX(e.nativeEvent.contentOffset.x)}
                    onScrollEndDrag={(e) => setOffsetX(e.nativeEvent.contentOffset.x)}
                    scrollEventThrottle={16}
                    snapToInterval={column}
                    decelerationRate="fast"
                    contentContainerStyle={{ width: columnsWidth }}
                  >
                    <View style={{ width: columnsWidth, height }}>
                      {/* What cannot be booked is washed grey (a room I may not book is hatched as well): the white is what a tap books. */}
                      {rooms.map((room, index) =>
                        crossLevel(room) === 'blocked' ? (
                          <View key={room.id} pointerEvents="none" style={{ position: 'absolute', left: index * column, width: column, top: 0, height, backgroundColor: wash }}>
                            <Stripes color={colors.line} weight={1} gap={8} />
                          </View>
                        ) : (
                          unbookable(room).map(([from, to]) => (
                            <View
                              key={`${room.id}-${from}`}
                              pointerEvents="none"
                              style={{ position: 'absolute', left: index * column, width: column, top: y(from), height: y(to) - y(from), backgroundColor: wash }}
                            />
                          ))
                        ),
                      )}
                      {/* The room being booked: its column tinted, under its blue-underlined head. */}
                      {selectedIndex >= 0 ? (
                        <Animated.View
                          entering={FadeIn.duration(160)}
                          pointerEvents="none"
                          style={{ position: 'absolute', left: selectedIndex * column, width: column, top: 0, height, backgroundColor: withAlpha(colors.primary, scheme === 'dark' ? 0.07 : 0.035) }}
                        />
                      ) : null}
                      {/* Hour lines across, fainter half hours, hairlines between the rooms. */}
                      {hours.map((hour) => (
                        <Fragment key={`h-${hour}`}>
                          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: y(hour * 60), height: StyleSheet.hairlineWidth, backgroundColor: colors.line }} />
                          {hour < endHour && hourHeight >= HALF_HOUR_MIN ? (
                            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: y(hour * 60 + 30), height: StyleSheet.hairlineWidth, backgroundColor: colors['line-2'] }} />
                          ) : null}
                        </Fragment>
                      ))}
                      {rooms.slice(1).map((room, i) => (
                        <View key={`v-${room.id}`} pointerEvents="none" style={{ position: 'absolute', top: 0, left: (i + 1) * column, width: StyleSheet.hairlineWidth, height, backgroundColor: colors.line }} />
                      ))}

                      {rooms.map((room, index) => (
                        <View key={room.id} style={{ position: 'absolute', top: 0, left: index * column, width: column, height }}>
                          {crossLevel(room) === 'blocked' ? null : (
                            <Pressable
                              testID={`timeline-column-${index}`}
                              accessibilityRole="button"
                              accessibilityLabel={columnLabel(room)}
                              accessibilityHint={t('booking.ghostBook')}
                              onPress={onColumnPress(room)}
                              style={StyleSheet.absoluteFill}
                            />
                          )}
                          {crossLevel(room) === 'blocked'
                            ? null
                            : gapsFor(room).map((gap, i) => (
                                // By position, not by time: today's first gap starts at the current minute and must not remount each minute.
                                <FreeSlot
                                  key={i}
                                  startMin={gap.startMin}
                                  endMin={gap.endMin}
                                  fromNow={isToday && gap.startMin === nowMin}
                                  top={y(gap.startMin) + INSET_Y}
                                  height={y(gap.endMin) - y(gap.startMin) - INSET_Y * 2}
                                  scrollY={scrollY}
                                />
                              ))}

                          {(blocksByRoom[room.id] ?? [])
                            .filter((block) => block.endMin > gridStart && block.startMin < gridEnd)
                            .map((block) => {
                              // Clipped to the shown hours: a meeting may start before or end after them.
                              const from = Math.max(block.startMin, gridStart);
                              const to = Math.min(block.endMin, gridEnd);
                              return (
                                <Block
                                  key={block.key}
                                  block={block}
                                  info={blockInfo(block)}
                                  top={y(from) + INSET_Y}
                                  // 26pt at least while that stays inside the hour; zoomed out, a short meeting is a thin card.
                                  height={Math.max(Math.min(26, hourHeight * 0.4), y(to) - y(from) - INSET_Y * 2)}
                                  past={isPastDay || (isToday && block.endMin <= nowMin)}
                                  live={isToday && nowMin >= block.startMin && nowMin < block.endMin}
                                  scrollY={scrollY}
                                  onPress={() => onPressBlock(block)}
                                />
                              );
                            })}

                          {selection && index === selectedIndex ? (
                            <SelectionCard
                              selection={selection}
                              top={y(selection.startMin) + INSET_Y}
                              height={Math.max(Math.min(44, hourHeight * 0.67), y(selection.endMin) - y(selection.startMin) - INSET_Y * 2)}
                              hourHeight={hourHeight}
                              minStart={Math.max(gridStart, Math.min(selection.startMin, selectionLimits?.minStart ?? selection.startMin))}
                              maxEnd={Math.min(gridEnd, Math.max(selection.endMin, selectionLimits?.maxEnd ?? selection.endMin))}
                              scrolls={[verticalScroll, horizontalScroll]}
                              onChange={onChangeSelection}
                              onClear={onClearSelection}
                            />
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </Animated.ScrollView>
                </GestureDetector>

                {/* "Now": red line across the rooms, its time in a red tab on the axis with a breathing halo. */}
                {showNow ? (
                  <>
                    <View pointerEvents="none" style={{ position: 'absolute', left: AXIS_WIDTH - 4, right: 0, top: nowY - 0.75, height: 1.5, backgroundColor: colors.danger }} />
                    <NowPulse top={nowY} />
                    <View
                      testID="timeline-now"
                      pointerEvents="none"
                      className="absolute items-center justify-center rounded-full bg-danger"
                      style={{ left: 5, width: AXIS_WIDTH - 8, top: nowY - 10, height: 20 }}
                    >
                      <Text numeric weight="bold" maxFontSizeMultiplier={1} style={{ fontSize: 11, lineHeight: 14, color: '#FFFFFF' }}>
                        {formatMinutes(nowMin)}
                      </Text>
                    </View>
                  </>
                ) : null}
              </View>
            </Animated.ScrollView>
          </GestureDetector>
        </View>
      </GestureDetector>

      {/* Right edge: a fade over the grid, a wider one over the heads, and the "+N" chip that brings the next rooms in. */}
      {hidden > 0 ? (
        <>
          <EdgeFade id="timelineFade" color={paper} width={FADE_WIDTH} />
          <EdgeFade id="timelineHeadFade" color={paper} width={HEAD_FADE_WIDTH} height={headHeight - 1} solidFrom={0.55} />
          <Pressable
            testID="timeline-more"
            accessibilityRole="button"
            accessibilityLabel={t('rooms.moreRooms', { count: hidden })}
            onPress={showMoreRooms}
            hitSlop={8}
            className="absolute right-2.5 z-20 h-7 flex-row items-center gap-0.5 rounded-full bg-primary pl-2.5 pr-1.5 active:opacity-80"
            style={{ top: (headHeight - 28) / 2, boxShadow: '0px 4px 10px rgba(0, 83, 155, 0.26)' }}
          >
            <Text numeric weight="bold" maxFontSizeMultiplier={1} className="text-on-primary" style={{ fontSize: 12, lineHeight: 15 }}>
              {`+${hidden}`}
            </Text>
            <Icon icon={ChevronRightIcon} size={13} weight="bold" color="on-primary" />
          </Pressable>
        </>
      ) : null}

      {/* Today's red line out of view: a chip at the edge it went past brings it back. */}
      {nowAway ? (
        <Animated.View
          key={nowAway}
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
          pointerEvents="box-none"
          style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, alignItems: 'center', ...(nowAway === 'above' ? { top: headHeight + 10 } : { bottom: 14 }) }}
        >
          <Pressable
            testID="timeline-back-to-now"
            accessibilityRole="button"
            accessibilityLabel={`${t('rooms.backToNow')}, ${formatMinutes(nowMin)}`}
            onPress={() => scrollRef.current?.scrollTo({ y: Math.max(0, nowY - 60), animated: true })}
            hitSlop={6}
            className="h-8 flex-row items-center gap-1.5 rounded-full bg-elevated pl-2.5 pr-3 active:opacity-80"
            style={{ boxShadow: '0px 4px 14px rgba(15, 27, 45, 0.18)', borderWidth: scheme === 'dark' ? 1 : 0, borderColor: colors.line }}
          >
            <Icon icon={nowAway === 'above' ? ArrowUpIcon : ArrowDownIcon} size={14} weight="bold" color="danger" />
            <Text weight="semibold" maxFontSizeMultiplier={1.2} className="text-ink" style={{ fontSize: 12.5, lineHeight: 16 }}>
              {t('rooms.backToNow')}
            </Text>
            <Text numeric weight="bold" maxFontSizeMultiplier={1.2} style={{ fontSize: 12.5, lineHeight: 16, color: colors.danger }}>
              {formatMinutes(nowMin)}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Loading: the timeline's shape on its paper (heads between hairlines, a few blocks) rather than generic bars. */
export function TimelineSkeleton() {
  const { colors } = useTheme();
  const { paper } = usePaper();
  const hairline = { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: colors.line };
  return (
    <View className="flex-1" style={{ backgroundColor: paper }} accessibilityLabel="loading">
      <View className="flex-row" style={{ minHeight: HEAD_HEIGHT, paddingLeft: AXIS_WIDTH, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line }}>
        {[0, 1, 2].map((i) => (
          <View key={i} className="flex-1 justify-center gap-2 px-2" style={i ? hairline : null}>
            <Skeleton width="50%" height={16} />
            <Skeleton width="40%" height={10} />
            <Skeleton height={5} radius={3} />
          </View>
        ))}
      </View>
      <View className="flex-1 flex-row" style={{ paddingLeft: AXIS_WIDTH }}>
        {[
          [24, 110],
          [80, 180],
          [8, 90],
        ].map(([top, height], i) => (
          <View key={i} className="flex-1" style={[{ paddingTop: GRID_TOP + top, paddingHorizontal: INSET_X }, i ? hairline : null]}>
            <Skeleton height={height} radius={BLOCK_RADIUS} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** A red halo breathing out from the right end of the "now" tab, so the current time reads as live. */
function NowPulse({ top }: { top: number }) {
  const { colors } = useTheme();
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false));
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: 0.4 * (1 - pulse.get()), transform: [{ scale: 0.6 + pulse.get() * 1.6 }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: AXIS_WIDTH - 9, top: top - 9, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger }, style]}
    />
  );
}

type RoomHeadProps = {
  room: RoomDto;
  /** The short name, and the group it belongs to (a brand, or the words every room shares). */
  label: { group: string; name: string };
  width: number;
  /** The first head has no hairline on its left. */
  first: boolean;
  blocks: TimelineBlock[];
  locked: boolean;
  selected: boolean;
  isToday: boolean;
  isPastDay: boolean;
  nowMin: number;
  gridStart: number;
  gridEnd: number;
  pastEnd: number;
};

/**
 * One column head over its room, split from the next by the grid's hairline, read like a door sign: the group in small
 * capitals with the seats across from it, the short name large under it, the status as a dot and a word (now for today,
 * the day's count otherwise; the dot breathes while the room is in use), and the room's whole day as a thin bar at the
 * foot. The room being booked has its name in blue and its head tinted like its column; a locked room shows a lock.
 */
function RoomHead({ room, label, width, first, blocks, locked, selected, isToday, isPastDay, nowMin, gridStart, gridEnd, pastEnd }: RoomHeadProps) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const { paper } = usePaper();
  const { open, close } = roomHours(room);
  const count = blocks.reduce((sum, b) => sum + b.bookings.length, 0);
  const busy = !locked && isToday && isRoomBusy(blocks, nowMin);
  const tag: { label: string; tone: 'ok' | 'danger' | 'off' | 'wait' } = locked
    ? { label: t('rooms.restricted'), tone: 'off' }
    : isToday
      ? busy
        ? { label: t('rooms.inUse'), tone: 'danger' }
        : nowMin < open || nowMin >= close
          ? { label: t('booking.closedNow'), tone: 'off' }
          : { label: t('rooms.free'), tone: 'ok' }
      : count
        ? { label: t('rooms.dayBookings', { count }), tone: isPastDay ? 'off' : 'wait' }
        : { label: t('rooms.free'), tone: isPastDay ? 'off' : 'ok' };
  const tone = {
    ok: { fg: colors['success-text'], dot: colors.success },
    danger: { fg: colors['danger-text'], dot: colors.danger },
    wait: { fg: colors['primary-tint-text'], dot: colors.primary },
    off: { fg: colors['off-text'], dot: colors.subtle },
  }[tag.tone];

  return (
    <View
      testID={`timeline-head-${room.id}`}
      accessibilityLabel={`${room.name ?? ''}, ${t('rooms.seats', { seats: room.numberOfSeats ?? 0 })}, ${tag.label}`}
      className="justify-center px-2 pb-2 pt-[7px]"
      style={{
        width,
        borderLeftWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderColor: colors.line,
        backgroundColor: selected ? withAlpha(colors.primary, scheme === 'dark' ? 0.07 : 0.035) : undefined,
      }}
    >
      {label.group ? (
        <Text
          weight="bold"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          maxFontSizeMultiplier={1.1}
          style={{ fontSize: 10, lineHeight: 13, letterSpacing: 0.6, color: selected ? withAlpha(colors.primary, 0.75) : colors.subtle }}
        >
          {label.group.toUpperCase()}
        </Text>
      ) : (
        // No group line (Thiso Myanmar's city names): the lock and seats go up here, so the name has the whole width.
        <View className="h-[13px] flex-row items-center gap-[3px]">
          {locked ? <Icon icon={LockIcon} size={11} weight="bold" color="subtle" /> : null}
          <Icon icon={UsersIcon} size={11} color="subtle" />
          <Text numeric weight="medium" maxFontSizeMultiplier={1.1} className="text-subtle" style={{ fontSize: 11, lineHeight: 13 }}>
            {String(room.numberOfSeats ?? 0)}
          </Text>
        </View>
      )}
      <View className="flex-row items-center gap-1">
        {locked && label.group ? <Icon icon={LockIcon} size={13} weight="bold" color="subtle" /> : null}
        <Text
          weight="bold"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          maxFontSizeMultiplier={1.15}
          className="flex-shrink"
          style={{ fontSize: 18, lineHeight: 22, letterSpacing: -0.4, color: selected ? colors.primary : locked ? colors.muted : colors.ink }}
        >
          {label.name}
        </Text>
        {label.group ? (
          <View className="ml-auto flex-row items-center gap-[3px] pl-0.5">
            <Icon icon={UsersIcon} size={11} color="subtle" />
            <Text numeric weight="medium" maxFontSizeMultiplier={1.1} className="text-subtle" style={{ fontSize: 11, lineHeight: 14 }}>
              {String(room.numberOfSeats ?? 0)}
            </Text>
          </View>
        ) : null}
      </View>
      <View className="mb-1.5 mt-px flex-row items-center gap-[5px]">
        <StatusDot color={tone.dot} live={busy} />
        <Text weight="semibold" numberOfLines={1} maxFontSizeMultiplier={1.1} className="flex-shrink" style={{ fontSize: 11.5, lineHeight: 15, color: tone.fg }}>
          {tag.label}
        </Text>
      </View>
      <DayMap
        open={Math.max(open, gridStart)}
        close={Math.min(close, gridEnd)}
        blocks={blocks}
        locked={locked}
        gridStart={gridStart}
        gridEnd={gridEnd}
        pastEnd={pastEnd}
        nowMin={isToday ? nowMin : null}
        card={paper}
      />
    </View>
  );
}

/**
 * A label that stays in sight while its card runs past the top of the schedule: it slides down with the scroll, never
 * past the card's foot. `top` is where the label sits in the grid, `room` how far it may slide before it reaches the foot.
 */
function useStickyLabel(scrollY: SharedValue<number>, top: number, room: number) {
  const size = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, Math.min(scrollY.get() + STICKY_GAP - GRID_TOP - top, room - size.get())) }],
  }));
  return { style, onLayout: (e: LayoutChangeEvent) => size.set(e.nativeEvent.layout.height) };
}

type SelectionCardProps = {
  selection: SlotSelection;
  top: number;
  height: number;
  hourHeight: number;
  /** The free stretch the card may be dragged in. */
  minStart: number;
  maxEnd: number;
  /** The scroll views a drag on the card holds still. */
  scrolls: GestureType[];
  onChange?: (selection: SlotSelection) => void;
  onClear?: () => void;
};

/**
 * The slot being picked: a blue card with a grab handle on each edge, its hours and (when tall enough) its length.
 * Dragging the card moves it; dragging near an edge moves that edge, in 15-minute steps with a tick each, inside the free
 * stretch around it. It lifts while held and glides to each new place; a tap lets it go. Screen readers adjust its end.
 */
function SelectionCard({ selection, top, height, hourHeight, minStart, maxEnd, scrolls, onChange, onClear }: SelectionCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { startMin, endMin } = selection;
  // The touch area reaches GRAB past both edges, where the handles stick out of the card.
  const box = height + GRAB * 2;
  const handle = useSharedValue<DragHandle>('move');
  const origin = useSharedValue([startMin, endMin]);
  const shown = useSharedValue([startMin, endMin]);
  const lifted = useSharedValue(0);
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + lifted.get() * 0.04 }] }));
  const range = `${formatMinutes(startMin)}–${formatMinutes(endMin)}`;
  const { hours, minutes } = splitDuration(endMin - startMin);
  const length = hours && minutes ? t('time.hoursMinutes', { hours, minutes }) : hours ? t('time.hours', { count: hours }) : t('time.minutes', { count: minutes });

  const change = (start: number, end: number) => {
    void Haptics.selectionAsync();
    onChange?.({ ...selection, startMin: start, endMin: end });
  };
  const clear = () => {
    void Haptics.selectionAsync();
    onClear?.();
  };

  const drag = Gesture.Pan()
    .enabled(!!onChange)
    .minDistance(3)
    .blocksExternalGesture(...scrolls)
    .onBegin((e) => {
      const edge = Math.min(GRAB + 16, box / 3);
      handle.set(e.y < edge ? 'start' : e.y > box - edge ? 'end' : 'move');
      origin.set([startMin, endMin]);
      shown.set([startMin, endMin]);
      lifted.set(withTiming(1, { duration: 120 }));
    })
    .onUpdate((e) => {
      const [from, to] = origin.get();
      const next = dragSelection(handle.get(), from, to, (e.translationY / hourHeight) * 60, minStart, maxEnd, SNAP);
      const [lastStart, lastEnd] = shown.get();
      if (next.startMin !== lastStart || next.endMin !== lastEnd) {
        shown.set([next.startMin, next.endMin]);
        scheduleOnRN(change, next.startMin, next.endMin);
      }
    })
    .onFinalize(() => {
      lifted.set(withTiming(0, { duration: 160 }));
    });
  const tap = Gesture.Tap()
    .enabled(!!onClear)
    .onEnd((_e, success) => {
      if (success) scheduleOnRN(clear);
    });

  return (
    <GestureDetector gesture={Gesture.Race(drag, tap)}>
      <Animated.View
        testID="timeline-selection"
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${t('rooms.selecting')}, ${range}, ${length}`}
        accessibilityHint={onChange ? t('rooms.dragHint') : undefined}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'activate' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'activate') clear();
          else if (onChange) {
            const next = dragSelection('end', startMin, endMin, e.nativeEvent.actionName === 'increment' ? SNAP : -SNAP, minStart, maxEnd, SNAP);
            if (next.endMin !== endMin) change(next.startMin, next.endMin);
          }
        }}
        entering={ZoomIn.duration(160)}
        exiting={FadeOut.duration(120)}
        layout={GLIDE}
        style={{ position: 'absolute', top: top - GRAB, left: INSET_X - 1, right: INSET_X - 1, height: box, paddingVertical: GRAB }}
      >
        <Animated.View
          className="flex-1 justify-center gap-0.5 px-2.5"
          style={[{ borderRadius: 10, backgroundColor: colors.primary, boxShadow: '0px 8px 20px rgba(0, 83, 155, 0.28)' }, liftStyle]}
        >
          <View className="absolute -top-1 left-1/2 h-2 w-6 rounded-full bg-white" style={{ marginLeft: -12, borderWidth: 1.5, borderColor: colors.primary }} />
          {height >= 40 ? (
            <>
              <View className="flex-row items-center gap-1">
                <Icon icon={CheckIcon} size={11} weight="bold" color="on-primary" />
                <Text weight="bold" numberOfLines={1} className="text-on-primary" style={{ fontSize: 11.5, lineHeight: 14 }}>
                  {t('rooms.selecting')}
                </Text>
              </View>
              <Text numeric weight="semibold" numberOfLines={1} className="text-on-primary" style={{ fontSize: 10.5, lineHeight: 13 }}>
                {range}
              </Text>
              {height >= 62 ? (
                <Text numeric weight="medium" numberOfLines={1} style={{ fontSize: 10.5, lineHeight: 13, color: withAlpha(colors['on-primary'], 0.75) }}>
                  {length}
                </Text>
              ) : null}
            </>
          ) : (
            <Text numeric weight="bold" numberOfLines={1} className="text-on-primary" style={{ fontSize: 10.5, lineHeight: 13 }}>
              {range}
            </Text>
          )}
          <View className="absolute -bottom-1 left-1/2 h-2 w-6 rounded-full bg-white" style={{ marginLeft: -12, borderWidth: 1.5, borderColor: colors.primary }} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

type DayMapProps = {
  open: number;
  close: number;
  blocks: TimelineBlock[];
  locked: boolean;
  gridStart: number;
  gridEnd: number;
  pastEnd: number;
  nowMin: number | null;
  /** The head's colour, washed over the hours already gone. */
  card: string;
};

/**
 * The room's day under its name, a miniature of its column on the same hours as the grid (so the bars line up across
 * rooms): grey over the open hours, meetings in their block colours, the hours gone washed out, now as a red tick.
 */
function DayMap({ open, close, blocks, locked, gridStart, gridEnd, pastEnd, nowMin, card }: DayMapProps) {
  const { colors } = useTheme();
  const colorOf = (kind: TimelineBlock['kind']) =>
    kind === 'pending' || kind === 'cluster' ? withAlpha(colors.primary, 0.55) : kind === 'finished' ? colors.subtle : colors.success;
  const span = Math.max(gridEnd - gridStart, 60);
  const at = (minute: number) => (Math.min(Math.max(minute, gridStart), gridEnd) - gridStart) / span;
  const bar = (from: number, to: number, color: string, key?: string) =>
    at(to) > at(from) ? (
      <View key={key} className="absolute bottom-0 top-0" style={{ left: `${at(from) * 100}%`, width: `${(at(to) - at(from)) * 100}%`, backgroundColor: color }} />
    ) : null;

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="h-[5px] overflow-hidden rounded-full" style={{ backgroundColor: colors['line-2'] }}>
      {locked ? null : bar(open, close, colors.track)}
      {blocks.map((b) => bar(b.startMin, b.endMin, colorOf(b.kind), b.key))}
      {bar(gridStart, pastEnd, withAlpha(card, 0.6))}
      {nowMin != null && nowMin >= gridStart && nowMin <= gridEnd ? (
        <View className="absolute bottom-0 top-0" style={{ left: `${at(nowMin) * 100}%`, width: 2, marginLeft: -1, backgroundColor: colors.danger }} />
      ) : null}
    </View>
  );
}

/** A status dot; `live` makes a halo breathe out of it (a room in use right now). */
function StatusDot({ color, live }: { color: string; live: boolean }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set(live ? withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false) : 0);
  }, [live, pulse]);
  // At rest the halo sits exactly on the dot.
  const halo = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - pulse.get()), transform: [{ scale: 1 + pulse.get() * 1.6 }] }));
  return (
    <View className="h-1.5 w-1.5">
      <Animated.View style={[{ position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: color }, halo]} />
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

type FreeSlotProps = { startMin: number; endMin: number; fromNow: boolean; top: number; height: number; scrollY: SharedValue<number> };

/**
 * A stretch still free to book: a clean card ringed in faint blue that hides the grid lines under it, "+ Trống" and its
 * hours at the top (as much as its height allows, pinned in sight while a long one scrolls past); the one starting now
 * reads "→ 14:00". The tap that books it lands on the column under it.
 */
function FreeSlot({ startMin, endMin, fromNow, top, height, scrollY }: FreeSlotProps) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const sticky = useStickyLabel(scrollY, top + 6, height - 12);
  if (height < 12) return null;
  const labelled = height >= 30;
  const ranged = height >= 50;
  const plus = (
    <View className="h-4 w-4 items-center justify-center rounded-full" style={{ backgroundColor: colors['primary-tint'] }}>
      <Icon icon={PlusIcon} size={10} weight="bold" color="primary" />
    </View>
  );

  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(220)}
      style={{
        position: 'absolute',
        top,
        left: INSET_X,
        right: INSET_X,
        height,
        borderRadius: BLOCK_RADIUS,
        borderWidth: 1,
        borderColor: withAlpha(colors.primary, scheme === 'dark' ? 0.3 : 0.16),
        backgroundColor: colors.elevated,
        overflow: 'hidden',
        ...(labelled ? { paddingHorizontal: 6, paddingTop: 6 } : { alignItems: 'center', justifyContent: 'center' }),
      }}
    >
      {labelled ? (
        <Animated.View onLayout={sticky.onLayout} style={[{ gap: 2 }, sticky.style]}>
          <View className="flex-row items-center gap-1">
            {plus}
            <Text weight="semibold" numberOfLines={1} maxFontSizeMultiplier={1.1} className="flex-shrink" style={{ fontSize: 11.5, lineHeight: 15, color: colors['primary-tint-text'] }}>
              {t('rooms.free')}
            </Text>
          </View>
          {ranged ? (
            <Text
              numeric
              weight="medium"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              maxFontSizeMultiplier={1.1}
              className="text-subtle"
              style={{ fontSize: 10.5, lineHeight: 14, paddingLeft: 1 }}
            >
              {fromNow ? `→ ${formatMinutes(endMin)}` : `${formatMinutes(startMin)}–${formatMinutes(endMin)}`}
            </Text>
          ) : null}
        </Animated.View>
      ) : height >= 18 ? (
        plus
      ) : null}
    </Animated.View>
  );
}

/** Fades the right edge into the paper: over the whole timeline, or over the heads (`height`). */
function EdgeFade({ id, color, width, height, solidFrom = 1 }: { id: string; color: string; width: number; height?: number; solidFrom?: number }) {
  return (
    // Above the heads, which sit at z-10 to shadow the grid.
    <View pointerEvents="none" style={{ position: 'absolute', zIndex: 20, top: 0, right: 0, width, ...(height == null ? { bottom: 0 } : { height }) }}>
      <Svg width={width} height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset={solidFrom} stopColor={color} stopOpacity={0.95} />
            <Stop offset="1" stopColor={color} stopOpacity={0.95} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

type BlockProps = {
  block: TimelineBlock;
  info: BlockInfo;
  top: number;
  height: number;
  /** Over already: faded. */
  past: boolean;
  /** Under way: a red dot before its time. */
  live: boolean;
  /** The schedule's scroll, which a long block's title and time follow down. */
  scrollY: SharedValue<number>;
  onPress: () => void;
};

/**
 * One meeting (or a stack of overlapping requests) in a room's column: a softly tinted card with a 3pt status edge,
 * the title in the tone's deep shade over the time (a short block has room for the title only, a thin one for nothing),
 * the booker at the foot. The title takes every line the height allows; title and time stay in sight while a long block
 * scrolls past. Pending requests are faintly hatched with an hourglass by their time. It fades in, so a new day's
 * meetings settle in rather than blink, and sinks a little under a press.
 */
function Block({ block, info, top, height, past, live, scrollY, onPress }: BlockProps) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const pressed = useSharedValue(0);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - pressed.get() * 0.03 }] }));
  const pending = block.kind === 'pending' || block.kind === 'cluster';
  const finished = block.kind === 'finished';
  const cluster = block.kind === 'cluster';
  const tone = pending
    ? { fill: colors['primary-tint'], edge: withAlpha(colors.primary, 0.6), title: colors['primary-tint-deep'], time: colors['primary-tint-text'] }
    : finished
      ? { fill: colors['off-tint'], edge: colors.subtle, title: colors['ink-2'], time: colors.muted }
      : { fill: colors['approved-tint'], edge: colors.success, title: colors['success-deep'], time: colors['success-text'] };
  const title = cluster ? t('rooms.pendingCluster', { count: block.bookings.length }) : info.title;
  const roomy = height >= 44;
  const padding = roomy ? 6 : 3;
  const creators = block.bookings.map((b) => b.user?.fullname).filter((name): name is string => !!name);
  const footer = height >= 84 && creators.length > 0;
  const footerLabel = cluster ? t('rooms.pendingClusterSub') : info.mine ? t('rooms.withMe') : givenName(creators[0]);
  const titled = height >= 20;
  const timed = height >= 40;
  const lines = Math.max(1, Math.floor((height - padding * 2 - (timed ? 15 : 0) - (footer ? 24 : 0)) / TITLE_LINE));
  const sticky = useStickyLabel(scrollY, top + padding, height - padding * 2 - (footer ? 24 : 0));
  const time = `${formatMinutes(block.startMin)}–${formatMinutes(block.endMin)}`;
  const a11y = [title, time, live ? t('rooms.inUse') : null, pending ? t('rooms.legendPending') : null, info.mine ? t('rooms.withMe') : null].filter(Boolean).join(', ');

  return (
    <>
      {/* A stack of requests for the same hours shows a second card behind the first. */}
      {cluster ? (
        <Animated.View
          pointerEvents="none"
          entering={FadeIn.duration(220)}
          style={{
            position: 'absolute',
            top: top + 4,
            left: INSET_X + 4,
            right: INSET_X - 2,
            height,
            borderRadius: BLOCK_RADIUS,
            backgroundColor: colors['primary-tint-2'],
            borderWidth: 1,
            borderColor: colors.elevated,
            opacity: past ? 0.6 : 1,
          }}
        />
      ) : null}
      <AnimatedPressable
        testID={`timeline-block-${block.bookings[0]?.code ?? block.key}`}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={onPress}
        onPressIn={() => pressed.set(withTiming(1, { duration: 90 }))}
        onPressOut={() => pressed.set(withTiming(0, { duration: 160 }))}
        entering={FadeIn.duration(220)}
        // Plain objects: NativeWind drops a style function on Pressable.
        style={[
          {
            position: 'absolute',
            top,
            left: INSET_X,
            right: INSET_X,
            height,
            borderRadius: BLOCK_RADIUS,
            overflow: 'hidden',
            paddingLeft: ACCENT + 6,
            paddingRight: 5,
            paddingVertical: padding,
            backgroundColor: tone.fill,
            // Mine: outlined in blue.
            borderWidth: info.mine ? 1.5 : 0,
            borderColor: colors.primary,
            opacity: past ? 0.6 : 1,
          },
          pressStyle,
        ]}
      >
        {pending ? <Stripes color={scheme === 'dark' ? withAlpha(colors.primary, 0.1) : withAlpha(colors.elevated, 0.75)} background={tone.fill} weight={1.5} gap={7} /> : null}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: ACCENT, backgroundColor: tone.edge }} />
        {titled ? (
          <Animated.View onLayout={sticky.onLayout} style={[{ gap: 1 }, sticky.style]}>
            <View className="flex-row items-start gap-1">
              {info.hidden && !cluster ? (
                <View style={{ marginTop: 3 }}>
                  <Icon icon={LockIcon} size={10} weight="bold" rawColor={tone.title} />
                </View>
              ) : null}
              <Text weight="semibold" numberOfLines={lines} maxFontSizeMultiplier={1.1} className="flex-1" style={{ fontSize: 12.5, lineHeight: TITLE_LINE, letterSpacing: -0.1, color: tone.title }}>
                {title}
              </Text>
            </View>
            {timed ? (
              <View className="flex-row items-center gap-1">
                {live && !pending ? <View className="h-1.5 w-1.5 rounded-full bg-danger" /> : null}
                {pending ? <Icon icon={HourglassIcon} size={10} weight="bold" rawColor={tone.time} /> : null}
                <Text
                  numeric
                  weight="medium"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  maxFontSizeMultiplier={1.1}
                  className="flex-shrink"
                  style={{ fontSize: 10.5, lineHeight: 14, color: tone.time }}
                >
                  {time}
                </Text>
              </View>
            ) : null}
          </Animated.View>
        ) : null}
        {footer ? (
          <View className="mt-auto flex-row items-center gap-1">
            <View className="flex-row">
              {creators.slice(0, cluster ? 3 : 1).map((name, i) => (
                <View
                  key={`${name}-${i}`}
                  className="h-[18px] w-[18px] items-center justify-center rounded-full bg-elevated"
                  style={{ marginLeft: i ? -6 : 0, borderWidth: cluster ? 1 : 0, borderColor: tone.fill }}
                >
                  <Text weight="bold" maxFontSizeMultiplier={1} style={{ fontSize: 8, lineHeight: 10, color: tone.time }}>
                    {initialsOf(name)}
                  </Text>
                </View>
              ))}
            </View>
            <Text weight="medium" numberOfLines={1} maxFontSizeMultiplier={1.1} className="flex-shrink" style={{ fontSize: 10.5, lineHeight: 13, color: info.mine ? colors.primary : colors.muted }}>
              {footerLabel}
            </Text>
          </View>
        ) : null}
      </AnimatedPressable>
    </>
  );
}
