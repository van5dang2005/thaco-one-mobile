import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';
import { formatTime } from '@/core/time/vn';
import { bookingFrom } from '@/features/room-booking/utils/booking';
import { useNow } from '@/shared/hooks/useNow';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { ArrowUpRightIcon, CalendarIcon, ChevronRightIcon, ClockIcon, DoorOpenIcon } from '@/shared/ui/icons';
import { RoundIcon } from '@/shared/ui/RoundIcon';
import { shadows } from '@/shared/ui/shadows';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Text } from '@/shared/ui/Text';

import { useModuleLabel } from '../../hooks/useModules';
import { pickNextMeeting, useFreeRooms, useTodayMeetings, useTodoItems } from '../../hooks/useSignals';
import type { HomeModule } from '../../modules';
import { todoTones, useVisibleTodos } from '../TodoTiles';
import { chunk, type LayoutProps, ModuleIcon, RowPadding, SectionHeader, TileMarker, useGroupTone, useHomeCardEdge, useTileA11yLabel } from './shared';

/**
 * "Thẻ" (2g): to-do card (left, two rows tall), today's meetings and free rooms (right), then every service as a
 * 2-column card with its summary, in the user's order ("Tùy chỉnh" arranges them, as in "Lưới").
 */
export function CardLayout({ modules, signals, onOpen, showTodo, onCustomize }: LayoutProps) {
  const { t } = useTranslation();
  const todos = useVisibleTodos(modules);
  const rooms = modules.some((m) => m.permission?.service === 'room');
  const left = showTodo && todos.length ? <TodoCard todos={todos} onOpen={onOpen} /> : null;
  const right = rooms ? [<TodayCard key="today" />, <FreeRoomsCard key="free" />] : [];

  return (
    <View className="gap-4">
      {left || right.length ? (
        left ? (
          <View className="flex-row gap-3">
            <View className="flex-1">{left}</View>
            {right.length ? <View className="flex-1 gap-3">{right}</View> : null}
          </View>
        ) : (
          <View className="flex-row gap-3">{right.map((card) => <View key={card.key} className="flex-1">{card}</View>)}</View>
        )
      ) : null}

      <View className="gap-2.5">
        <SectionHeader testID="home-customize" title={t('home.utilities')} action={t('home.customize')} onAction={onCustomize} />
        {chunk(modules, 2).map((row, index) => (
          <View key={index} className="flex-row gap-2.5">
            {row.map((module) => (
              <ModuleCard key={module.id} module={module} summary={signals[module.id]?.summary} count={signals[module.id]?.badge?.data} onOpen={onOpen} />
            ))}
            <RowPadding count={2 - row.length} />
          </View>
        ))}
      </View>
    </View>
  );
}

function WidgetCard({ testID, onPress, label, children }: { testID: string; onPress?: () => void; label: string; children: ReactNode }) {
  const edge = useHomeCardEdge();
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} disabled={!onPress} onPress={onPress} className="active:opacity-80">
      <Card className="gap-2.5 overflow-visible p-3.5" style={edge}>
        {children}
      </Card>
    </Pressable>
  );
}

/** Total, a three-color ratio bar and one row per kind. */
function TodoCard({ todos, onOpen }: { todos: ReturnType<typeof useVisibleTodos>; onOpen: (m: HomeModule) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const items = useTodoItems();
  const counts = todos.map(({ kind }) => items[kind].count ?? 0);
  const total = counts.reduce((a, b) => a + b, 0);
  const loading = todos.some(({ kind }) => items[kind].isLoading && items[kind].count === undefined);
  const edge = useHomeCardEdge();

  return (
    <Card testID="home-card-todo" className="flex-1 gap-3 overflow-visible p-3.5" style={edge}>
      <View className="flex-row items-center justify-between">
        <RoundIcon icon={ClockIcon} tone="danger" size={36} />
        <Icon icon={ChevronRightIcon} size={16} color="subtle" />
      </View>
      <View>
        <View className="flex-row items-baseline gap-1.5">
          {loading ? (
            <Skeleton width={34} height={32} radius={6} />
          ) : (
            <Text mono weight="bold" maxFontSizeMultiplier={1.15} className="text-ink" style={{ fontSize: 32, lineHeight: 38 }}>
              {String(total)}
            </Text>
          )}
          <Text className="text-muted" style={{ fontSize: 13, lineHeight: 17 }}>
            {t('home.todo.unit')}
          </Text>
        </View>
        <Text weight="bold" className="text-ink" style={{ fontSize: 13.5, lineHeight: 18 }}>
          {t('home.todo.title')}
        </Text>
      </View>
      <View className="h-1.5 flex-row gap-1 overflow-hidden rounded-full">
        {todos.map(({ kind }, i) =>
          total ? (
            counts[i] ? <View key={kind} className="h-full rounded-full" style={{ flex: counts[i], backgroundColor: colors[todoTones[kind].solid] }} /> : null
          ) : (
            <View key={kind} className="h-full flex-1 rounded-full bg-line-2" />
          ),
        )}
      </View>
      <View className="mt-auto">
        {todos.map(({ kind, module }, i) => (
          <Pressable
            key={kind}
            testID={`home-card-todo-${kind}`}
            accessibilityRole="button"
            accessibilityLabel={`${t(`home.todo.${kind}`)}, ${counts[i]}`}
            onPress={() => onOpen(module)}
            className={`min-h-[40px] flex-row items-center gap-2 active:opacity-60 ${i > 0 ? 'border-t border-line-2' : ''}`}
          >
            <View className="h-2 w-2 rounded-[3px]" style={{ backgroundColor: colors[todoTones[kind].solid] }} />
            <Text weight="medium" numberOfLines={1} className="flex-1 text-ink" style={{ fontSize: 13, lineHeight: 17 }}>
              {t(`home.todo.${kind}`)}
            </Text>
            <Text mono weight="bold" className="text-ink" style={{ fontSize: 13, lineHeight: 17 }}>
              {String(counts[i])}
            </Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

/** My meetings today and the next start time. */
function TodayCard() {
  const { t } = useTranslation();
  const meetings = useTodayMeetings();
  const now = useNow();
  const next = pickNextMeeting(meetings.data, now);
  const count = meetings.data?.length;
  return (
    <WidgetCard testID="home-card-today" label={`${t('home.cards.today')}, ${count ?? 0}`} onPress={() => router.push('/calendar')}>
      <View className="flex-row items-center justify-between">
        <RoundIcon icon={CalendarIcon} tone="wait" size={36} />
        <Icon icon={ChevronRightIcon} size={16} color="subtle" />
      </View>
      <View>
        <View className="flex-row items-baseline gap-1.5">
          {count === undefined ? (
            <Skeleton width={22} height={24} radius={6} />
          ) : (
            <Text mono weight="bold" className="text-ink" style={{ fontSize: 22, lineHeight: 27 }}>
              {String(count)}
            </Text>
          )}
          <Text className="text-muted" style={{ fontSize: 12.5, lineHeight: 16 }}>
            {t('home.cards.meetingsUnit')}
          </Text>
        </View>
        <Text weight="bold" className="text-ink" style={{ fontSize: 13.5, lineHeight: 18 }}>
          {t('home.cards.today')}
        </Text>
        <Text numberOfLines={1} className="text-muted" style={{ fontSize: 11.5, lineHeight: 15 }}>
          {next ? `${t('home.cards.next')} ` : t('home.cards.noNext')}
          {next ? (
            <Text mono weight="bold" className="text-primary" style={{ fontSize: 11.5 }}>
              {formatTime(bookingFrom(next.booking))}
            </Text>
          ) : null}
        </Text>
      </View>
    </WidgetCard>
  );
}

/** Rooms of my area free right now: "4 /6 phòng" and one bar per room (green = free). */
function FreeRoomsCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const rooms = useFreeRooms(true);
  const data = rooms.data;
  return (
    <WidgetCard testID="home-card-free-rooms" label={`${t('home.cards.freeRooms')}, ${data?.free ?? 0}/${data?.total ?? 0}`} onPress={() => router.push('/rooms')}>
      <View className="flex-row items-center justify-between">
        <RoundIcon icon={DoorOpenIcon} tone="ok" size={36} />
        <View className="h-[22px] flex-row items-center gap-1 rounded-full bg-success-tint px-2">
          <View className="h-1.5 w-1.5 rounded-full bg-success" />
          <Text weight="bold" className="text-success-text" style={{ fontSize: 10.5, lineHeight: 13 }}>
            {t('home.cards.now')}
          </Text>
        </View>
      </View>
      <View>
        <View className="flex-row items-baseline gap-1">
          {!data ? (
            <Skeleton width={22} height={24} radius={6} />
          ) : (
            <Text mono weight="bold" className="text-ink" style={{ fontSize: 22, lineHeight: 27 }}>
              {String(data.free)}
            </Text>
          )}
          <Text className="text-muted" style={{ fontSize: 12.5, lineHeight: 16 }}>
            {t('home.cards.roomsTotal', { total: data?.total ?? 0 })}
          </Text>
        </View>
        <Text weight="bold" className="text-ink" style={{ fontSize: 13.5, lineHeight: 18 }}>
          {t('home.cards.freeRooms')}
        </Text>
      </View>
      {data?.rooms.length ? (
        <View className="h-1.5 flex-row gap-1">
          {data.rooms.map((free, i) => (
            <View key={i} className="h-full flex-1 rounded-full" style={{ backgroundColor: free ? colors.success : colors.line }} />
          ))}
        </View>
      ) : null}
    </WidgetCard>
  );
}

/**
 * Horizontal service card: tinted 36pt icon box with its red count, label, one-line summary (portal description for
 * web apps), ↗ for other apps. A non-zero count on an `urgentWhenBadged` module turns the border and summary red.
 */
function ModuleCard({ module, summary, count, onOpen }: { module: HomeModule; summary?: { data?: string; isLoading: boolean }; count?: number; onOpen: (m: HomeModule) => void }) {
  const tone = useGroupTone(module.group);
  const label = useModuleLabel();
  const a11y = useTileA11yLabel();
  const { colors } = useTheme();
  const { t } = useTranslation();
  // Portal apps have no summary hook: their description, else where they open.
  const opensIn = module.opensApp ? t('home.summary.phoneApp') : module.externalUrl ? t('home.summary.webApp') : undefined;
  const note = summary?.data ?? (summary?.isLoading ? undefined : module.description ?? opensIn);
  const urgent = !!count && !!module.urgentWhenBadged;
  const edge = useHomeCardEdge();
  return (
    <Pressable
      testID={`home-module-${module.id}`}
      accessibilityRole="button"
      accessibilityLabel={a11y(module, label(module), count, note)}
      onPress={() => onOpen(module)}
      className="min-h-[58px] min-w-0 flex-1 flex-row items-center gap-2.5 rounded-[16px] bg-elevated px-3 py-2.5 active:opacity-80"
      style={[shadows.card, edge, urgent ? { borderWidth: 1.5, borderColor: colors['danger-border'] } : null]}
    >
      <View className="h-9 w-9 items-center justify-center rounded-[11px]" style={tone.box}>
        <ModuleIcon module={module} size={18} color={tone.icon} />
        {module.externalUrl ? null : <TileMarker module={module} count={count} className="-right-2 -top-2" />}
      </View>
      <View className="min-w-0 flex-1">
        <Text weight="bold" numberOfLines={1} className="text-ink" style={{ fontSize: 13.5, lineHeight: 18 }}>
          {label(module, true)}
        </Text>
        {note ? (
          <Text numberOfLines={1} weight={urgent ? 'semibold' : undefined} className={urgent ? 'text-danger-text' : 'text-muted'} style={{ fontSize: 11.5, lineHeight: 15 }}>
            {note}
          </Text>
        ) : summary?.isLoading ? (
          <Skeleton width="70%" height={10} radius={4} />
        ) : null}
      </View>
      {module.externalUrl ? <Icon icon={ArrowUpRightIcon} size={15} rawColor={colors.subtle} /> : null}
    </Pressable>
  );
}
