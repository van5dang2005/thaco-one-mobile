import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';
import { addDays, formatKey, parseDateKey, todayKey, weekdayOf, type DateKey } from '@/core/time/vn';
import { cn } from '@/shared/lib/cn';

import { BottomSheet } from './BottomSheet';
import { Icon } from './Icon';
import { CalendarDaysIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon } from './icons';
import { Text } from './Text';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  value: DateKey | undefined;
  onSelect: (value: DateKey) => void;
  minDate?: DateKey;
  maxDate?: DateKey;
  testID?: string;
};

const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * Month grid in Vietnam time, Monday first, under the same compact icon heading as the area sheet (the chosen day as
 * its second line). Days outside [minDate, maxDate] are disabled. Tapping "Tháng 10, 2026 ⌄" swaps the days for the
 * twelve months of a year, ‹ › then step a year, so a far month is two taps away; "Hôm nay" jumps back.
 */
export function DatePickerSheet({ visible, onClose, title, value, onSelect, minDate, maxDate, testID }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const initial = parseDateKey(value ?? todayKey());
  const [cursor, setCursor] = useState({ year: initial.year, month: initial.month });
  const [months, setMonths] = useState(false);
  const [lastValue, setLastValue] = useState(value);
  const [lastVisible, setLastVisible] = useState(visible);

  // Re-center on the selected month whenever the sheet is reopened with another value.
  if (value !== lastValue) {
    setLastValue(value);
    if (value) {
      const p = parseDateKey(value);
      setCursor({ year: p.year, month: p.month });
    }
  }
  // Every opening starts on the days.
  if (visible !== lastVisible) {
    setLastVisible(visible);
    if (visible) setMonths(false);
  }

  const first: DateKey = `${cursor.year}-${pad(cursor.month)}-01`;
  const firstWeekday = new Date(Date.UTC(cursor.year, cursor.month - 1, 1)).getUTCDay();
  const offset = (firstWeekday + 6) % 7; // Monday-first grid
  const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month, 0)).getUTCDate();
  const cells: (DateKey | null)[] = [...Array.from({ length: offset }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i))];
  while (cells.length % 7) cells.push(null);
  const today = todayKey();
  const now = parseDateKey(today);
  const picked = value ? parseDateKey(value) : undefined;
  const outside = (key: DateKey) => (!!minDate && key < minDate) || (!!maxDate && key > maxDate);
  /** A month none of whose days can be picked. */
  const monthOutside = (year: number, month: number) => {
    const last: DateKey = `${year}-${pad(month)}-${pad(new Date(Date.UTC(year, month, 0)).getUTCDate())}`;
    return (!!minDate && last < minDate) || (!!maxDate && `${year}-${pad(month)}-01` > maxDate);
  };

  const shift = (delta: number) =>
    setCursor(({ year, month }) => {
      if (months) return { year: year + delta, month };
      const m = month + delta;
      return m < 1 ? { year: year - 1, month: 12 } : m > 12 ? { year: year + 1, month: 1 } : { year, month: m };
    });

  const pick = (key: DateKey) => {
    onSelect(key);
    onClose();
  };

  const weekdayOrder = ['1', '2', '3', '4', '5', '6', '0'] as const;
  const subtitle = value ? `${t(`time.weekday.${String(weekdayOf(value)) as '0'}`)}, ${formatKey(value)}` : undefined;
  const showToday = value !== today && !outside(today);

  /** ‹ or ›: a month at a time over the days, a year at a time over the months. */
  const arrow = (direction: -1 | 1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(months ? (direction < 0 ? 'time.previousYear' : 'time.nextYear') : direction < 0 ? 'time.previousMonth' : 'time.nextMonth')}
      onPress={() => shift(direction)}
      hitSlop={6}
      className="h-8 w-8 items-center justify-center rounded-[10px] active:opacity-70"
      style={{ backgroundColor: colors.field }}
    >
      <Icon icon={direction < 0 ? ChevronLeftIcon : ChevronRightIcon} size={15} weight="bold" color="ink-2" />
    </Pressable>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} subtitle={subtitle} icon={CalendarDaysIcon} iconTone="brand" compact testID={testID}>
      <View className="flex-row items-center gap-1.5">
        <Pressable
          testID={testID ? `${testID}-months` : undefined}
          accessibilityRole="button"
          accessibilityLabel={t('time.chooseMonth')}
          accessibilityState={{ expanded: months }}
          onPress={() => setMonths((m) => !m)}
          hitSlop={4}
          className="h-8 flex-row items-center gap-1 rounded-[10px] pl-2.5 pr-2 active:opacity-70"
          style={{ backgroundColor: months ? colors['primary-tint'] : colors.field }}
        >
          <Text weight="bold" numeric className={months ? 'text-primary' : 'text-ink'} style={{ fontSize: 14, lineHeight: 18 }}>
            {months ? String(cursor.year) : t('time.month', { month: cursor.month, year: cursor.year })}
          </Text>
          <Icon icon={months ? ChevronUpIcon : ChevronDownIcon} size={14} weight="bold" color={months ? 'primary' : 'muted'} />
        </Pressable>
        <View className="flex-1" />
        {showToday && !months ? (
          <Pressable accessibilityRole="button" onPress={() => pick(today)} hitSlop={4} className="h-8 justify-center rounded-[10px] px-2.5 active:opacity-70" style={{ backgroundColor: colors['primary-tint'] }}>
            <Text weight="semibold" className="text-primary" style={{ fontSize: 12.5, lineHeight: 16 }}>
              {t('time.today')}
            </Text>
          </Pressable>
        ) : null}
        {arrow(-1)}
        {arrow(1)}
      </View>

      {months ? (
        <View className="flex-row flex-wrap" style={{ rowGap: 6 }}>
          {MONTHS.map((month) => {
            const selected = picked?.year === cursor.year && picked.month === month;
            const current = now.year === cursor.year && now.month === month;
            const disabled = monthOutside(cursor.year, month);
            return (
              <View key={month} className="w-1/3 px-[3px]">
                <Pressable
                  testID={testID ? `${testID}-month-${month}` : undefined}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  disabled={disabled}
                  onPress={() => {
                    setCursor((c) => ({ ...c, month }));
                    setMonths(false);
                  }}
                  className={cn('h-11 items-center justify-center rounded-[12px] active:opacity-70', selected ? 'bg-primary' : current ? 'bg-primary-tint' : 'bg-field')}
                  // A fixed-width border that only changes colour (a conditional border blanks rounded views on Android).
                  style={{ borderWidth: 1.5, borderColor: current && !selected ? colors.primary : 'transparent', opacity: disabled ? 0.4 : 1 }}
                >
                  <Text weight={selected ? 'bold' : 'semibold'} className={selected ? 'text-on-primary' : current ? 'text-primary' : 'text-ink'} style={{ fontSize: 13.5, lineHeight: 18 }}>
                    {t('time.monthName', { month })}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : (
        <View>
          <View className="flex-row pb-1">
            {weekdayOrder.map((d) => (
              <Text key={d} weight="semibold" className={cn('flex-1 text-center', d === '0' ? 'text-danger' : 'text-muted')} style={{ fontSize: 11.5, lineHeight: 15 }}>
                {t(`time.weekdayShort.${d}`)}
              </Text>
            ))}
          </View>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <View key={row} className="flex-row">
              {cells.slice(row * 7, row * 7 + 7).map((key, col) => {
                if (!key) return <View key={col} className="h-11 flex-1" />;
                const disabled = outside(key);
                const selected = key === value;
                const isToday = key === today;
                return (
                  <Pressable
                    key={key}
                    testID={testID ? `${testID}-${key}` : undefined}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled }}
                    disabled={disabled}
                    onPress={() => pick(key)}
                    className="h-11 flex-1 items-center justify-center"
                  >
                    <View
                      className={cn('h-10 w-10 items-center justify-center rounded-[12px]', selected ? 'bg-primary' : isToday ? 'bg-primary-tint' : undefined)}
                      style={{ borderWidth: 1.5, borderColor: isToday && !selected ? colors.primary : 'transparent' }}
                    >
                      <Text
                        numeric
                        weight={selected || isToday ? 'bold' : 'medium'}
                        className={selected ? 'text-on-primary' : disabled ? 'text-disabled-text' : col === 6 ? 'text-danger' : isToday ? 'text-primary' : 'text-ink'}
                        style={{ fontSize: 15, lineHeight: 20 }}
                      >
                        {parseDateKey(key).day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}
