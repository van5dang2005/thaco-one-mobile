import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';
import { addDays, parseDateKey, weekdayOf, type DateKey } from '@/core/time/vn';
import { cn } from '@/shared/lib/cn';
import { onBlue } from '@/shared/ui/ScreenShell';
import { Text } from '@/shared/ui/Text';

type Props = {
  value: DateKey;
  onChange: (key: DateKey) => void;
  /** First day shown (usually today, or the Monday of the shown week). */
  start: DateKey;
  days?: number;
  /** Days after this cannot be picked (room's `maxAdvanceRegistrationDays`). */
  maxKey?: DateKey;
  /** Days with meetings: a 4pt dot under the date. */
  marked?: ReadonlySet<DateKey>;
  /** Ringed in white while another day is selected (Lịch phòng). */
  today?: DateKey;
  className?: string;
  testID?: string;
};

/** Seven-day strip on the blue header (v3): 56pt cells, radius 14; the selected day is white with blue text, weekends at 45%. */
export function DayStrip({ value, onChange, start, days = 7, maxKey, marked, today, className = 'mt-3.5', testID }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const keys = Array.from({ length: days }, (_, i) => addDays(start, i));

  return (
    <View testID={testID} className={cn('flex-row gap-1', className)} accessibilityRole="tablist">
      {keys.map((key) => {
        const selected = key === value;
        const weekday = weekdayOf(key);
        const weekend = weekday === 0 || weekday === 6;
        const disabled = !!maxKey && key > maxKey;
        const fg = selected ? colors.header : colors['header-name'];
        const dot = marked?.has(key);
        const ringed = !selected && key === today;
        return (
          <Pressable
            key={key}
            testID={`${testID ?? 'day'}-${key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={`${t(`time.weekday.${String(weekday) as '0'}`)} ${parseDateKey(key).day}${dot ? `, ${t('booking.hasMeetings')}` : ''}`}
            disabled={disabled}
            onPress={() => onChange(key)}
            className="h-14 flex-1 items-center justify-center gap-0.5 rounded-[14px] active:opacity-80"
            style={[
              // Today keeps full strength even on a weekend, so its ring reads.
              { backgroundColor: selected ? colors['header-name'] : 'transparent', opacity: disabled ? 0.3 : !selected && !ringed && weekend ? 0.45 : 1 },
              ringed ? { borderWidth: 1.5, borderColor: onBlue(0.85) } : null,
            ]}
          >
            <Text weight={selected ? 'bold' : 'medium'} numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ fontSize: 11, lineHeight: 14, color: selected ? colors.header : onBlue(0.75) }}>
              {t(`time.weekdayShort.${String(weekday) as '0'}`)}
            </Text>
            <Text weight="bold" numeric maxFontSizeMultiplier={1.2} style={{ color: fg, fontSize: 18, lineHeight: 22 }}>
              {String(parseDateKey(key).day).padStart(2, '0')}
            </Text>
            <View className="h-1 w-1 rounded-full" style={{ backgroundColor: dot ? (selected ? colors.header : onBlue(0.8)) : 'transparent' }} />
          </Pressable>
        );
      })}
    </View>
  );
}
