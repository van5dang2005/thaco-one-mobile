import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type GestureResponderEvent } from 'react-native';
import Animated, { useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';

import { givenName, sameId } from '@/core/session/userTypes';
import { useTheme } from '@/core/theme/ThemeProvider';
import { withAlpha } from '@/core/theme/palette';
import { formatMinutes, minutesOfDay, todayKey, type DateKey } from '@/core/time/vn';
import { useNow } from '@/shared/hooks/useNow';
import { cn } from '@/shared/lib/cn';
import { initialsOf } from '@/shared/ui/Avatar';
import { Icon } from '@/shared/ui/Icon';
import { CheckIcon, ChevronRightIcon, LockIcon, UsersIcon } from '@/shared/ui/icons';
import { Text } from '@/shared/ui/Text';

import type { RoomDto } from '../types';
import { blockTime, isRoomBusy, roomHours, shortRoomNames, type CrossLevel, type TimelineBlock } from '../utils/booking';

export const HOUR_HEIGHT = 66;
/** Narrowest room column; columns widen to fill the screen (see `columnWidthFor`). */
export const COLUMN_WIDTH = 96;
/** Hour labels column. */
export const AXIS_WIDTH = 42;
/** Minimum height of the column heads. */
const HEAD_HEIGHT = 64;
const BLOCK_INSET = 3;
const FADE_WIDTH = 36;
const TITLE_LINE = 15;

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

function Stripes({ color, background = 'transparent' }: { color: string; background?: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        {/* Diagonal strokes drawn in the tile (a rotated pattern renders as dots on some devices). */}
        <Pattern id="stripes" patternUnits="userSpaceOnUse" width="9" height="9">
          <Path d="M-2,2 L2,-2 M0,9 L9,0 M7,11 L11,7" stroke={color} strokeWidth={2.4} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={background} />
      <Rect width="100%" height="100%" fill="url(#stripes)" />
    </Svg>
  );
}

/**
 * Room schedule of design 3a: time runs down (66pt per hour, dashed half hours), one column per room under a fixed hour
 * axis; column heads follow the horizontal scroll and carry a map of the room's day. Hours already gone are tinted and
 * hours the room is closed are hatched, so neither invites a tap that can only fail. Approved blocks are green with a
 * 3pt left bar, pending ones blue and striped, meetings I am in outlined in blue, the current time a red line.
 */
export function RoomTimeline({ rooms, blocksByRoom, crossLevel, dateKey, startHour, endHour, selection, blockInfo, onPressBlock, onPressSlot, bottomInset = 24 }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const window = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const columnsRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const [viewport, setViewport] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  // Heads grow when a room name wraps; the right-edge "+N" chip centres on them.
  const [headHeight, setHeadHeight] = useState(HEAD_HEIGHT);
  const now = useNow();
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const gridStart = startHour * 60;
  const gridEnd = endHour * 60;
  const height = (endHour - startHour) * HOUR_HEIGHT;
  // Until the heads report their width, the window gives a close enough guess (no jump on first layout).
  const width = viewport || window.width - AXIS_WIDTH;
  const column = columnWidthFor(width, rooms.length);
  const columnsWidth = rooms.length * column;
  const today = todayKey(now);
  const isToday = dateKey === today;
  const isPastDay = dateKey < today;
  const nowMin = minutesOfDay(now);
  const y = (minute: number) => ((minute - gridStart) / 60) * HOUR_HEIGHT;
  const showNow = isToday && nowMin >= gridStart && nowMin <= gridEnd;
  const nowY = y(nowMin);
  // Everything above this minute is over: the whole day before today, up to now today.
  const pastEnd = isPastDay ? gridEnd : isToday ? Math.min(Math.max(nowMin, gridStart), gridEnd) : gridStart;
  // Rooms not fully in view yet: the "+N" chip at the right edge.
  const hidden = Math.max(0, rooms.length - Math.floor((offsetX + width + 8) / column));
  // Only what tells the rooms apart: "Phòng họp 18.1" heads as "18.1", on one line like the design's names.
  const names = shortRoomNames(rooms);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
  });
  const headStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -scrollX.get() }] }));

  // Scroll to an hour before now (or to the first hour) whenever the day changes.
  useEffect(() => {
    const target = isToday ? nowMin - 60 : gridStart;
    const timer = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, y(target)), animated: false }), 60);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, startHour]);

  const onColumnPress = (room: RoomDto) => (event: GestureResponderEvent) => {
    const minute = gridStart + Math.floor(((event.nativeEvent.locationY / HOUR_HEIGHT) * 60) / 30) * 30;
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
    <View className="flex-1">
      {/* Column heads: fixed vertically, follow the horizontal scroll of the grid. */}
      <View className="flex-row border-b border-line" style={{ minHeight: HEAD_HEIGHT }} onLayout={(e) => setHeadHeight(e.nativeEvent.layout.height)}>
        <View className="items-center justify-center border-r border-line-2" style={{ width: AXIS_WIDTH }}>
          <Text mono maxFontSizeMultiplier={1} className="text-subtle" style={{ fontSize: 9.5, lineHeight: 12 }}>
            {t('rooms.timezone')}
          </Text>
        </View>
        <View className="flex-1 overflow-hidden" onLayout={(e) => setViewport(e.nativeEvent.layout.width)}>
          <Animated.View style={[{ flexDirection: 'row', minHeight: HEAD_HEIGHT }, headStyle]}>
            {rooms.map((room) => (
              <RoomHead
                key={room.id}
                room={room}
                name={names[room.id] || room.name || ''}
                width={column}
                blocks={blocksByRoom[room.id] ?? []}
                locked={crossLevel(room) === 'blocked'}
                selected={!!selection && sameId(selection.roomId, room.id)}
                isToday={isToday}
                isPastDay={isPastDay}
                nowMin={nowMin}
                gridStart={gridStart}
                gridEnd={gridEnd}
              />
            ))}
          </Animated.View>
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingTop: 10, paddingBottom: bottomInset }} showsVerticalScrollIndicator={false}>
        <View style={{ height: height + 10, flexDirection: 'row' }}>
          {/* Hour axis, labels right-aligned against the grid. */}
          <View style={{ width: AXIS_WIDTH, height }}>
            {hours.map((hour) => {
              const top = y(hour * 60);
              const covered = showNow && Math.abs(top - nowY) < 14;
              return covered ? null : (
                <Text
                  key={hour}
                  mono
                  numberOfLines={1}
                  maxFontSizeMultiplier={1}
                  className="absolute"
                  style={{ top: top - 7, left: 0, width: AXIS_WIDTH - 6, textAlign: 'right', fontSize: 10.5, lineHeight: 14, color: hour * 60 < pastEnd ? colors.faint : colors.subtle }}
                >
                  {`${String(hour).padStart(2, '0')}:00`}
                </Text>
              );
            })}
          </View>

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
              {/* Hours already gone, under the lines. */}
              {pastEnd > gridStart ? <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: y(pastEnd), backgroundColor: colors.panel }} /> : null}
              {/* Hour lines, dashed half hours, column separators. */}
              {hours.map((hour) => (
                <View key={`h-${hour}`} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: y(hour * 60), height: 1, backgroundColor: colors.line }} />
              ))}
              {hours.slice(0, -1).map((hour) => (
                <View
                  key={`m-${hour}`}
                  pointerEvents="none"
                  style={{ position: 'absolute', left: 0, right: 0, top: y(hour * 60 + 30), height: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors['line-2'] }}
                />
              ))}
              {rooms.map((room, index) => (
                <View key={`sep-${room.id}`} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: (index + 1) * column - 1, width: 1, backgroundColor: colors['line-2'] }} />
              ))}

              {rooms.map((room, index) => {
                const locked = crossLevel(room) === 'blocked';
                const { open, close } = roomHours(room);
                // Closed hours inside the grid, hatched like a locked room: tapping them only explains why.
                const closed = [
                  [gridStart, Math.min(open, gridEnd)],
                  [Math.max(close, gridStart), gridEnd],
                ].filter(([from, to]) => to - from >= 15);
                return (
                  <View key={room.id} style={{ position: 'absolute', top: 0, left: index * column + 4, width: column - 9, height }}>
                    {locked ? (
                      <View className="flex-1 overflow-hidden rounded-[10px]" style={{ marginVertical: BLOCK_INSET }}>
                        <Stripes color={colors.line} />
                      </View>
                    ) : (
                      <>
                        {closed.map(([from, to]) => (
                          <View
                            key={from}
                            pointerEvents="none"
                            className="overflow-hidden rounded-[10px]"
                            style={{ position: 'absolute', left: 0, right: 0, top: y(from) + BLOCK_INSET, height: Math.max(0, y(to) - y(from) - BLOCK_INSET * 2) }}
                          >
                            <Stripes color={colors['line-2']} />
                          </View>
                        ))}
                        <Pressable
                          testID={`timeline-column-${index}`}
                          accessibilityRole="button"
                          accessibilityLabel={room.name ?? ''}
                          accessibilityHint={t('booking.ghostBook')}
                          onPress={onColumnPress(room)}
                          style={StyleSheet.absoluteFill}
                        />
                      </>
                    )}

                    {(blocksByRoom[room.id] ?? [])
                      .filter((block) => block.endMin > gridStart && block.startMin < gridEnd)
                      .map((block) => (
                        <Block
                          key={block.key}
                          block={block}
                          info={blockInfo(block)}
                          top={y(Math.max(block.startMin, gridStart)) + BLOCK_INSET}
                          // Clipped to the shown hours: a meeting may start before or end after them.
                          height={Math.max(26, y(Math.min(block.endMin, gridEnd)) - y(Math.max(block.startMin, gridStart)) - BLOCK_INSET * 2)}
                          past={isPastDay || (isToday && block.endMin <= nowMin)}
                          live={isToday && nowMin >= block.startMin && nowMin < block.endMin}
                          onPress={() => onPressBlock(block)}
                        />
                      ))}

                    {selection && sameId(selection.roomId, room.id) ? (
                      <View
                        pointerEvents="none"
                        testID="timeline-selection"
                        className="justify-center gap-0.5 px-2"
                        style={{
                          position: 'absolute',
                          top: y(selection.startMin) + BLOCK_INSET,
                          left: -2,
                          right: -2,
                          height: Math.max(44, y(selection.endMin) - y(selection.startMin) - BLOCK_INSET * 2),
                          borderRadius: 10,
                          backgroundColor: colors.primary,
                          boxShadow: '0px 8px 20px rgba(0, 83, 155, 0.28)',
                        }}
                      >
                        <View className="absolute -top-1 left-1/2 h-1.5 w-5 rounded-full bg-white" style={{ marginLeft: -10 }} />
                        <View className="flex-row items-center gap-1">
                          <Icon icon={CheckIcon} size={11} weight="bold" color="on-primary" />
                          <Text weight="bold" numberOfLines={1} className="text-on-primary" style={{ fontSize: 11.5, lineHeight: 14 }}>
                            {t('rooms.selecting')}
                          </Text>
                        </View>
                        <Text mono weight="semibold" numberOfLines={1} className="text-on-primary" style={{ fontSize: 10.5, lineHeight: 13 }}>
                          {`${formatMinutes(selection.startMin)}–${formatMinutes(selection.endMin)}`}
                        </Text>
                        <View className="absolute -bottom-1 left-1/2 h-1.5 w-5 rounded-full bg-white" style={{ marginLeft: -10 }} />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </Animated.ScrollView>

          {/* "Now": red line across the columns, its time in a red tab on the axis. */}
          {showNow ? (
            <>
              <View pointerEvents="none" style={{ position: 'absolute', left: AXIS_WIDTH, right: 0, top: nowY - 1, height: 2, backgroundColor: colors.danger }} />
              <View
                testID="timeline-now"
                pointerEvents="none"
                className="absolute items-center justify-center rounded-l-[6px] rounded-r-[3px] bg-danger"
                style={{ left: 3, width: AXIS_WIDTH - 3, top: nowY - 8, height: 16 }}
              >
                <Text mono weight="bold" maxFontSizeMultiplier={1} style={{ fontSize: 10, lineHeight: 13, color: '#FFFFFF' }}>
                  {formatMinutes(nowMin)}
                </Text>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* Right edge, heads included: a fade and the "+N" chip that brings the next rooms in. */}
      {hidden > 0 ? (
        <>
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: FADE_WIDTH }}>
            <Svg width={FADE_WIDTH} height="100%">
              <Defs>
                <LinearGradient id="timelineFade" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={colors.elevated} stopOpacity={0} />
                  <Stop offset="1" stopColor={colors.elevated} stopOpacity={0.95} />
                </LinearGradient>
              </Defs>
              <Rect width={FADE_WIDTH} height="100%" fill="url(#timelineFade)" />
            </Svg>
          </View>
          <Pressable
            testID="timeline-more"
            accessibilityRole="button"
            accessibilityLabel={t('rooms.moreRooms', { count: hidden })}
            onPress={showMoreRooms}
            hitSlop={8}
            className="absolute right-2 h-7 flex-row items-center gap-0.5 rounded-full bg-inverse pl-2 pr-1 active:opacity-80"
            style={{ top: (headHeight - 28) / 2, boxShadow: '0px 4px 12px rgba(15, 27, 45, 0.22)' }}
          >
            <Text weight="bold" maxFontSizeMultiplier={1} className="text-on-inverse" style={{ fontSize: 11.5, lineHeight: 14 }}>
              {`+${hidden}`}
            </Text>
            <Icon icon={ChevronRightIcon} size={13} weight="bold" color="on-inverse" />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

type RoomHeadProps = {
  room: RoomDto;
  name: string;
  width: number;
  blocks: TimelineBlock[];
  locked: boolean;
  selected: boolean;
  isToday: boolean;
  isPastDay: boolean;
  nowMin: number;
  gridStart: number;
  gridEnd: number;
};

/** One column head: the short name and seats, a status tag (now for today, the day's count otherwise), the day's map. */
function RoomHead({ room, name, width, blocks, locked, selected, isToday, isPastDay, nowMin, gridStart, gridEnd }: RoomHeadProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { open, close } = roomHours(room);
  const count = blocks.reduce((sum, b) => sum + b.bookings.length, 0);
  const tag: { label: string; tone: 'ok' | 'danger' | 'off' | 'wait' } = locked
    ? { label: t('rooms.restricted'), tone: 'off' }
    : isToday
      ? isRoomBusy(blocks, nowMin)
        ? { label: t('rooms.inUse'), tone: 'danger' }
        : nowMin < open || nowMin >= close
          ? { label: t('booking.closedNow'), tone: 'off' }
          : { label: t('rooms.free'), tone: 'ok' }
      : count
        ? { label: t('rooms.dayBookings', { count }), tone: isPastDay ? 'off' : 'wait' }
        : { label: t('rooms.free'), tone: isPastDay ? 'off' : 'ok' };
  const tone = {
    ok: { bg: colors['success-tint'], fg: colors['success-text'], dot: colors.success },
    danger: { bg: colors['danger-tint'], fg: colors['danger-text'], dot: colors.danger },
    wait: { bg: colors['primary-tint'], fg: colors['primary-tint-text'], dot: colors.primary },
    off: { bg: colors['off-tint'], fg: colors['off-text'], dot: colors.subtle },
  }[tag.tone];
  const span = gridEnd - gridStart;
  const at = (minute: number) => `${((Math.min(Math.max(minute, gridStart), gridEnd) - gridStart) / span) * 100}%` as const;
  const widthOf = (from: number, to: number) => `${((Math.min(to, gridEnd) - Math.max(from, gridStart)) / span) * 100}%` as const;

  return (
    <View
      testID={`timeline-head-${room.id}`}
      accessibilityLabel={`${room.name ?? ''}, ${t('rooms.seats', { seats: room.numberOfSeats ?? 0 })}, ${tag.label}`}
      style={{ width }}
      className={cn('justify-center gap-1 border-r border-line-2 px-2 py-2', selected && 'bg-primary-tint')}
    >
      <View className="flex-row items-center gap-1">
        {locked ? <Icon icon={LockIcon} size={11} weight="bold" color="subtle" /> : null}
        <Text weight="bold" numberOfLines={1} maxFontSizeMultiplier={1.15} className="flex-shrink" style={{ fontSize: 13.5, lineHeight: 18, color: locked ? colors.subtle : selected ? colors.primary : colors.ink }}>
          {name}
        </Text>
        <View className="ml-auto flex-row items-center gap-0.5 pl-0.5">
          <Icon icon={UsersIcon} size={10} color="subtle" />
          <Text numeric weight="medium" maxFontSizeMultiplier={1.1} className="text-subtle" style={{ fontSize: 10.5, lineHeight: 13 }}>
            {String(room.numberOfSeats ?? 0)}
          </Text>
        </View>
      </View>
      <View className="h-4 flex-row items-center gap-1 self-start rounded-full px-1.5" style={{ backgroundColor: tone.bg, maxWidth: '100%' }}>
        <View className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: tone.dot }} />
        <Text weight="bold" numberOfLines={1} maxFontSizeMultiplier={1.1} className="flex-shrink" style={{ fontSize: 9.5, lineHeight: 12, color: tone.fg }}>
          {tag.label}
        </Text>
      </View>
      {/* The room's day at a glance: booked stretches on a thin track, the current time as a red tick. */}
      <View className="mt-0.5 h-1 overflow-hidden rounded-full" style={{ backgroundColor: locked ? colors['line-2'] : colors.line }}>
        {locked
          ? null
          : blocks
              .filter((b) => b.endMin > gridStart && b.startMin < gridEnd)
              .map((b) => (
                <View
                  key={b.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: at(b.startMin),
                    width: widthOf(b.startMin, b.endMin),
                    backgroundColor: b.kind === 'approved' ? colors.success : b.kind === 'finished' ? colors.subtle : withAlpha(colors.primary, 0.55),
                  }}
                />
              ))}
        {isToday && nowMin > gridStart && nowMin < gridEnd ? <View style={{ position: 'absolute', top: 0, bottom: 0, left: at(nowMin), width: 2, backgroundColor: colors.danger }} /> : null}
      </View>
    </View>
  );
}

type BlockProps = {
  block: TimelineBlock;
  info: BlockInfo;
  top: number;
  height: number;
  /** Over already: dimmed. */
  past: boolean;
  /** Under way: a red dot before its time. */
  live: boolean;
  onPress: () => void;
};

/** One meeting (or a stack of overlapping requests) in a room column. Its title takes every line the height allows. */
function Block({ block, info, top, height, past, live, onPress }: BlockProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const pending = block.kind === 'pending' || block.kind === 'cluster';
  const finished = block.kind === 'finished';
  const cluster = block.kind === 'cluster';
  const fg = pending ? colors['primary-tint-text'] : finished ? colors['off-text'] : colors['approved-block-text'];
  const title = cluster ? t('rooms.pendingCluster', { count: block.bookings.length }) : info.title;
  const roomy = height >= 48;
  const creators = block.bookings.map((b) => b.user?.fullname).filter((name): name is string => !!name);
  const footer = height >= 76 && creators.length > 0;
  const footerLabel = cluster ? t('rooms.pendingClusterSub') : pending ? t('rooms.legendPending') : info.mine ? t('rooms.withMe') : givenName(creators[0]);
  const lines = Math.max(1, Math.floor((height - (roomy ? 12 : 6) - (roomy ? 15 : 0) - (footer ? 24 : 0)) / TITLE_LINE));
  const a11y = [title, `${formatMinutes(block.startMin)}–${formatMinutes(block.endMin)}`, pending ? t('rooms.legendPending') : null, info.mine ? t('rooms.withMe') : null].filter(Boolean).join(', ');

  return (
    <>
      {/* A stack of requests for the same hours shows a second card behind the first. */}
      {cluster ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: top + 4, left: 4, right: -3, height, borderRadius: 10, backgroundColor: colors['primary-tint-2'], borderWidth: 1, borderColor: colors.elevated, opacity: past ? 0.7 : 1 }}
        />
      ) : null}
      <Pressable
        testID={`timeline-block-${block.bookings[0]?.code ?? block.key}`}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={onPress}
        // A plain object: NativeWind drops a style function on Pressable.
        style={{
          position: 'absolute',
          top,
          left: 0,
          right: 0,
          height,
          borderRadius: 10,
          overflow: 'hidden',
          paddingLeft: pending ? 7 : 9,
          paddingRight: 6,
          paddingVertical: roomy ? 6 : 3,
          gap: 2,
          backgroundColor: pending ? colors['primary-tint'] : finished ? colors['off-tint'] : colors['approved-tint'],
          borderWidth: info.mine ? 1.5 : 0,
          borderColor: colors.primary,
          opacity: past ? 0.7 : 1,
        }}
      >
        {pending ? <Stripes color={colors.elevated} background={colors['primary-tint']} /> : null}
        {!pending ? <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: finished ? colors.subtle : colors.success }} /> : null}
        <View className="flex-row items-start gap-1">
          {info.hidden && !cluster ? (
            <View style={{ marginTop: 2 }}>
              <Icon icon={LockIcon} size={10} weight="bold" rawColor={fg} />
            </View>
          ) : null}
          <Text weight="bold" numberOfLines={lines} maxFontSizeMultiplier={1.1} className="flex-1" style={{ fontSize: 12, lineHeight: TITLE_LINE, color: fg }}>
            {title}
          </Text>
        </View>
        {roomy ? (
          <View className="flex-row items-center gap-1">
            {live && !pending ? <View className="h-1.5 w-1.5 rounded-full bg-danger" /> : null}
            <Text mono weight="medium" numberOfLines={1} maxFontSizeMultiplier={1.1} style={{ fontSize: 10, lineHeight: 13, color: fg, opacity: 0.85 }}>
              {blockTime(block)}
            </Text>
          </View>
        ) : null}
        {footer ? (
          <View className="mt-auto flex-row items-center gap-1.5">
            <View className="flex-row">
              {creators.slice(0, cluster ? 3 : 1).map((name, i) => (
                <View
                  key={`${name}-${i}`}
                  className="h-[18px] w-[18px] items-center justify-center rounded-full bg-elevated"
                  style={{ marginLeft: i ? -6 : 0, borderWidth: cluster ? 1 : 0, borderColor: colors['primary-tint'] }}
                >
                  <Text weight="bold" maxFontSizeMultiplier={1} style={{ fontSize: 8, lineHeight: 10, color: fg }}>
                    {initialsOf(name)}
                  </Text>
                </View>
              ))}
            </View>
            <Text weight="semibold" numberOfLines={1} maxFontSizeMultiplier={1.1} className="flex-shrink" style={{ fontSize: 10, lineHeight: 12, color: info.mine && !pending ? colors.primary : fg }}>
              {footerLabel}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </>
  );
}
