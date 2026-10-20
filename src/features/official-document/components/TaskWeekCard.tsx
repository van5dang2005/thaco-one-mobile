import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useTheme } from '@/core/theme/ThemeProvider';
import { parseDateKey, weekdayOf, type DateKey } from '@/core/time/vn';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon } from '@/shared/ui/icons';
import { Text } from '@/shared/ui/Text';

import { useTaskToneColors } from '../hooks/useTaskToneColors';
import type { DocTask } from '../types';
import { addMonths, dayTones, inMonth, monthWeeks, weekOf, type TaskTone } from '../utils/tasks';

const LEGEND: TaskTone[] = ['chu_tri', 'phoi_hop', 'de_biet', 'done'];
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;
/** The picker's 12 months, four to a row. */
const MONTH_ROWS = [0, 1, 2].map((row) => [1, 2, 3, 4].map((col) => row * 4 + col));
const FADE = FadeIn.duration(180);

/** `week`: the selected week (default) · `month`: the whole month · `pick`: year and the 12 months. */
export type TaskCalendarMode = 'week' | 'month' | 'pick';

/** What the arrows step in each mode (accessibility labels under `documents.tasks`). */
const STEP_LABELS = {
  week: ['prevWeek', 'nextWeek'],
  month: ['prevMonth', 'nextMonth'],
  pick: ['prevYear', 'nextYear'],
} as const;

type Props = {
  tasks: DocTask[];
  value: DateKey;
  onChange: (day: DateKey) => void;
  today: DateKey;
  onWeek: (delta: -1 | 1) => void;
  /** Held by the screen, which loads the months on show. */
  mode: TaskCalendarMode;
  onModeChange: (mode: TaskCalendarMode) => void;
};

/**
 * Calendar of "Việc của tôi": the selected week with role dots under days with work; the handle at the bottom
 * expands it to the whole month, and the month title opens a year / month picker. Arrows step a week, a month or a year.
 */
export function TaskWeekCard({ tasks, value, onChange, today, onWeek, mode, onModeChange }: Props) {
  const { t } = useTranslation();
  const toneColors = useTaskToneColors();
  const [pickYear, setPickYear] = useState(() => parseDateKey(value).year);

  const week = weekOf(value);
  // The week strip names the month most of its days fall in; the month grid the selected day's month.
  const shown = parseDateKey(mode === 'week' ? week[3] : value);

  const step = (delta: -1 | 1) => {
    if (mode === 'week') onWeek(delta);
    else if (mode === 'month') onChange(addMonths(value, delta));
    else setPickYear((y) => y + delta);
  };
  const togglePicker = () => {
    setPickYear(shown.year);
    onModeChange(mode === 'pick' ? 'month' : 'pick');
  };

  return (
    <Card className="gap-3 p-3.5 pb-1" testID="tasks-week">
      <View className="flex-row items-center justify-between">
        <Pressable
          testID="tasks-month-title"
          accessibilityRole="button"
          accessibilityLabel={t('documents.tasks.pickMonth')}
          accessibilityState={{ expanded: mode === 'pick' }}
          onPress={togglePicker}
          hitSlop={8}
          className="flex-row items-center gap-1 active:opacity-70"
        >
          <Text weight="bold" accessibilityRole="header" style={{ fontSize: 15, lineHeight: 20 }}>
            {mode === 'pick' ? String(pickYear) : t('time.month', { month: shown.month, year: shown.year })}
          </Text>
          <Icon icon={mode === 'pick' ? ChevronUpIcon : ChevronDownIcon} size={16} color="muted" weight="bold" />
        </Pressable>
        <View className="flex-row items-center gap-1">
          {value !== today && mode !== 'pick' ? (
            <Pressable testID="tasks-go-today" accessibilityRole="button" onPress={() => onChange(today)} hitSlop={6} className="mr-1 h-8 justify-center rounded-full bg-primary-tint px-3 active:opacity-70">
              <Text weight="semibold" className="text-primary-tint-text" style={{ fontSize: 12.5, lineHeight: 16 }}>
                {t('documents.tasks.today')}
              </Text>
            </Pressable>
          ) : null}
          {([-1, 1] as const).map((delta) => (
            <Pressable
              key={delta}
              testID={`tasks-step-${delta < 0 ? 'prev' : 'next'}`}
              accessibilityRole="button"
              accessibilityLabel={t(`documents.tasks.${STEP_LABELS[mode][delta < 0 ? 0 : 1]}`)}
              onPress={() => step(delta)}
              className="h-11 w-11 items-center justify-center rounded-[12px] active:bg-panel"
            >
              <Icon icon={delta < 0 ? ChevronLeftIcon : ChevronRightIcon} size={18} color="ink-2" />
            </Pressable>
          ))}
        </View>
      </View>

      {mode === 'pick' ? (
        <Animated.View key="pick" entering={FADE} className="gap-2" testID="tasks-month-picker">
          {MONTH_ROWS.map((months) => (
            <View key={months[0]} className="flex-row gap-2">
              {months.map((month) => (
                <MonthChip
                  key={month}
                  label={t('documents.tasks.monthName', { month })}
                  selected={pickYear === parseDateKey(value).year && month === parseDateKey(value).month}
                  current={pickYear === parseDateKey(today).year && month === parseDateKey(today).month}
                  onPress={() => {
                    onChange(inMonth(value, pickYear, month));
                    onModeChange('month');
                  }}
                  testID={`tasks-month-${month}`}
                />
              ))}
            </View>
          ))}
        </Animated.View>
      ) : (
        <Animated.View key={mode} entering={FADE} className="gap-1">
          {mode === 'month' ? (
            <View className="flex-row gap-1">
              {WEEKDAYS.map((weekday) => (
                <Text key={weekday} weight="medium" className="flex-1 text-center text-muted" maxFontSizeMultiplier={1.2} style={{ fontSize: 11, lineHeight: 14 }}>
                  {t(`time.weekdayShort.${String(weekday) as '0'}`)}
                </Text>
              ))}
            </View>
          ) : null}
          {(mode === 'month' ? monthWeeks(shown.year, shown.month) : [week]).map((days) => (
            <View key={days[0]} className="flex-row gap-1" accessibilityRole="tablist">
              {days.map((day) => (
                <DayCell
                  key={day}
                  day={day}
                  tones={dayTones(tasks, day, today)}
                  toneColors={toneColors}
                  selected={day === value}
                  isToday={day === today}
                  outside={mode === 'month' && parseDateKey(day).month !== shown.month}
                  compact={mode === 'month'}
                  onPress={() => onChange(day)}
                />
              ))}
            </View>
          ))}
        </Animated.View>
      )}

      {mode === 'pick' ? null : (
        <View className="flex-row flex-wrap gap-x-3.5 gap-y-1">
          {LEGEND.map((tone) => (
            <View key={tone} className="flex-row items-center gap-1.5">
              <View className="h-2 w-2 rounded-full" style={{ backgroundColor: toneColors[tone] }} />
              <Text className="text-muted" style={{ fontSize: 12, lineHeight: 16 }}>
                {t(`documents.role.${tone}`)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Pressable
        testID="tasks-calendar-toggle"
        accessibilityRole="button"
        accessibilityState={{ expanded: mode !== 'week' }}
        onPress={() => onModeChange(mode === 'week' ? 'month' : 'week')}
        className="h-9 flex-row items-center justify-center gap-1 border-t border-line-2 active:opacity-60"
      >
        <Text weight="semibold" className="text-muted" style={{ fontSize: 12.5, lineHeight: 16 }}>
          {mode === 'week' ? t('documents.tasks.expand') : t('documents.tasks.collapse')}
        </Text>
        <Icon icon={mode === 'week' ? ChevronDownIcon : ChevronUpIcon} size={15} color="muted" weight="bold" />
      </Pressable>
    </Card>
  );
}

type DayCellProps = {
  day: DateKey;
  tones: TaskTone[];
  toneColors: Record<TaskTone, string>;
  selected: boolean;
  isToday: boolean;
  /** A neighbouring month's day padding the month grid: dimmed, still selectable. */
  outside: boolean;
  /** Month grid: no weekday label, shorter cell. */
  compact: boolean;
  onPress: () => void;
};

/** A day: weekday (week strip only), the date (selected = primary, today = tint) and the role dots of its tasks. */
function DayCell({ day, tones, toneColors, selected, isToday, outside, compact, onPress }: DayCellProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const weekday = weekdayOf(day);
  const date = parseDateKey(day).day;
  const ink = selected ? colors['on-primary'] : outside ? colors.faint : colors.ink;
  return (
    <Pressable
      testID={`tasks-day-${day}`}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={`${t(`time.weekday.${String(weekday) as '0'}`)} ${date}${tones.length ? `, ${t('documents.tasks.hasTasks')}` : ''}`}
      onPress={onPress}
      className={compact ? 'min-h-[44px] flex-1 items-center justify-center gap-1 rounded-[12px] active:opacity-80' : 'min-h-[60px] flex-1 items-center justify-center gap-1 rounded-[14px] active:opacity-80'}
      style={{ backgroundColor: selected ? colors.primary : isToday ? colors['primary-tint'] : 'transparent' }}
    >
      {compact ? null : (
        <Text weight="medium" maxFontSizeMultiplier={1.2} style={{ fontSize: 11, lineHeight: 14, color: selected ? colors['on-primary'] : colors.muted }}>
          {t(`time.weekdayShort.${String(weekday) as '0'}`)}
        </Text>
      )}
      <Text mono weight="bold" maxFontSizeMultiplier={1.2} style={{ fontSize: compact ? 14 : 16, lineHeight: compact ? 18 : 20, color: ink }}>
        {String(date).padStart(2, '0')}
      </Text>
      <View className="h-1.5 flex-row gap-[3px]" style={{ opacity: outside && !selected ? 0.45 : 1 }}>
        {tones.map((tone) => (
          <View key={tone} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: selected ? colors['on-primary'] : toneColors[tone] }} />
        ))}
      </View>
    </Pressable>
  );
}

/** One of the 12 months of the picker: selected = primary, the current month = tint. */
function MonthChip({ label, selected, current, onPress, testID }: { label: string; selected: boolean; current: boolean; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className="h-11 flex-1 items-center justify-center rounded-[12px] active:opacity-80"
      style={{ backgroundColor: selected ? colors.primary : current ? colors['primary-tint'] : colors.panel }}
    >
      <Text weight={selected ? 'bold' : 'semibold'} maxFontSizeMultiplier={1.2} style={{ fontSize: 13, lineHeight: 17, color: selected ? colors['on-primary'] : current ? colors['primary-tint-text'] : colors.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}
