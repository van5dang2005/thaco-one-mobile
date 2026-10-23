import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

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
  /** `capsule`: a white tile slides under the selected day, its weekday in red over a red rule (Lịch phòng's week band). */
  variant?: 'pill' | 'capsule';
};

/** Sunday's red on the glass band, as on a Vietnamese wall calendar: a deep, vivid red (user asked twice for it stronger). */
const SUNDAY = '#FF5A50';
/** The capsule's glide to a newly picked day: quick, settling without a wobble. */
const GLIDE = { damping: 22, stiffness: 280, mass: 0.7 };

/**
 * Seven-day strip on the blue header (v3): 56pt cells, radius 14; the selected day is white with blue text, weekends at
 * 45%. As `capsule` (Lịch phòng) a white tile glides under the selected day; every day white, Sunday in coral red.
 */
export function DayStrip({ value, onChange, start, days = 7, maxKey, marked, today, className = 'mt-3.5', testID, variant = 'pill' }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const keys = Array.from({ length: days }, (_, i) => addDays(start, i));

  if (variant === 'capsule') {
    return <CapsuleStrip keys={keys} value={value} onChange={onChange} maxKey={maxKey} marked={marked} today={today} className={className} testID={testID} />;
  }

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
              { borderWidth: ringed ? 1.5 : 0, borderColor: ringed ? onBlue(0.85) : 'transparent' },
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

type CapsuleProps = Pick<Props, 'value' | 'onChange' | 'maxKey' | 'marked' | 'today' | 'className' | 'testID'> & { keys: DateKey[] };

/** The selected day's red: its weekday, the rule under it, and Sunday's date (the tile is white in both themes). */
const RED = '#D0312D';
/** The selected day's date: the brand blue in both themes, since the tile is white in both. */
const TILE_INK = '#00539B';

/**
 * The week with a white tile under the selected day that glides to the next one picked. The tile holds a second copy
 * of the row in its own colours, slid back as far as the tile moves, so a label turns blue exactly where the tile
 * covers it, also mid-glide: the weekday in red with a short red rule under it, as on a wall calendar's page.
 * Today is ringed while another day is selected.
 */
function CapsuleStrip({ keys, value, onChange, maxKey, marked, today, className, testID }: CapsuleProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const count = keys.length;
  const index = keys.indexOf(value);
  const width = useSharedValue(0);
  const at = useSharedValue(Math.max(0, index));

  useEffect(() => {
    if (index >= 0) at.set(withSpring(index, GLIDE));
  }, [at, index]);

  const tile = useAnimatedStyle(() => ({ width: width.get() / count, transform: [{ translateX: (at.get() * width.get()) / count }] }));
  const lens = useAnimatedStyle(() => ({ width: width.get(), transform: [{ translateX: (-at.get() * width.get()) / count }] }));

  /** One day's weekday, the rule (red when `lit`, else a clear spacer so both copies line up), date and meeting dot. */
  const label = (key: DateKey, lit: boolean) => {
    const weekday = weekdayOf(key);
    const sunday = weekday === 0;
    const dot = marked?.has(key);
    const ink = lit ? (sunday ? RED : TILE_INK) : sunday ? SUNDAY : colors['header-name'];
    return (
      <View className="flex-1 items-center justify-center gap-0.5">
        <Text weight={lit || sunday ? 'bold' : 'semibold'} numberOfLines={1} maxFontSizeMultiplier={1.1} style={{ fontSize: 11, lineHeight: 14, letterSpacing: 0.2, color: lit ? RED : sunday ? SUNDAY : onBlue(0.86) }}>
          {t(`time.weekdayShort.${String(weekday) as '0'}`)}
        </Text>
        <View className="rounded-full" style={{ width: 14, height: 2, marginBottom: 1, backgroundColor: lit ? RED : 'transparent' }} />
        <Text weight="bold" numeric maxFontSizeMultiplier={1.2} style={{ color: ink, fontSize: 18, lineHeight: 22 }}>
          {String(parseDateKey(key).day).padStart(2, '0')}
        </Text>
        <View className="h-1 w-1 rounded-full" style={{ backgroundColor: dot ? (lit ? ink : onBlue(0.8)) : 'transparent' }} />
      </View>
    );
  };

  return (
    <View testID={testID} className={cn('h-14 flex-row', className)} accessibilityRole="tablist" onLayout={(e) => width.set(e.nativeEvent.layout.width)}>
      {keys.map((key) => {
        const weekday = weekdayOf(key);
        const disabled = !!maxKey && key > maxKey;
        const selected = key === value;
        const ringed = !selected && key === today;
        return (
          <Pressable
            key={key}
            testID={`${testID ?? 'day'}-${key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={`${t(`time.weekday.${String(weekday) as '0'}`)} ${parseDateKey(key).day}${marked?.has(key) ? `, ${t('booking.hasMeetings')}` : ''}`}
            disabled={disabled}
            onPress={() => onChange(key)}
            className="flex-1 rounded-[14px] active:opacity-70"
            style={{ opacity: disabled ? 0.3 : 1, borderWidth: ringed ? 1.5 : 0, borderColor: ringed ? onBlue(0.6) : 'transparent' }}
          >
            {label(key, false)}
          </Pressable>
        );
      })}
      <Animated.View
        pointerEvents="none"
        className="absolute bottom-0 left-0 top-0 rounded-[14px]"
        style={[{ backgroundColor: colors['header-name'], boxShadow: '0px 4px 12px rgba(0, 18, 48, 0.3)', opacity: index < 0 ? 0 : 1 }, tile]}
      >
        <View className="flex-1 overflow-hidden rounded-[14px]">
          <Animated.View className="h-14 flex-row" style={lens}>
            {keys.map((key) => (
              <View key={key} className="flex-1">
                {label(key, true)}
              </View>
            ))}
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}
