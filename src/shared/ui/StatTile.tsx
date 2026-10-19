import { View } from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';

import { PressableCard } from './Card';
import { Icon } from './Icon';
import { type AppIcon, CheckIcon, ChevronRightIcon } from './icons';
import { Text } from './Text';
import { type Tone, useToneColors } from './tones';

type Props = {
  icon: AppIcon;
  /** Status tone of the counter (`wait` by default). */
  tone?: Tone;
  /** A color of its own instead (Chờ đóng dấu: the Văn thư violet): `tint` for the discs, `solid` for the icon and count. */
  color?: { tint: string; solid: string };
  label: string;
  value?: number;
  /** One-line breakdown under the count. */
  hint?: string;
  hintTone?: 'danger' | 'warning';
  /** Used as a tab (Bưu phẩm của tôi): a 2pt ring in the tile's color and a filled ✓ disc in place of ›. */
  selected?: boolean;
  onPress: () => void;
  testID?: string;
};

/**
 * Counter tile of the Văn thư home (8a), two to a row: a tinted disc in the top-right corner (echoing the
 * header circles) holding the icon, the label, the count in the tile's color with a › disc saying it opens
 * a list, and a one-line breakdown.
 */
export function StatTile({ icon, tone = 'wait', color: own, label, value, hint, hintTone, selected, onPress, testID }: Props) {
  const { colors } = useTheme();
  const toneColor = useToneColors(tone);
  const color = own ?? toneColor;
  const tab = selected !== undefined;
  return (
    <PressableCard
      testID={testID}
      accessibilityRole={tab ? 'tab' : 'button'}
      accessibilityState={tab ? { selected } : undefined}
      accessibilityLabel={`${label}: ${value ?? ''}. ${hint ?? ''}`}
      onPress={onPress}
      className="min-h-[118px] flex-1 justify-between gap-2 p-3.5"
    >
      <View pointerEvents="none" style={{ position: 'absolute', width: 92, height: 92, borderRadius: 46, right: -26, top: -26, backgroundColor: color.tint }} />
      {/* Drawn over the card so the content does not move when the tab is selected. */}
      {selected ? <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 top-0 rounded-card" style={{ borderWidth: 2, borderColor: color.solid }} /> : null}
      <View className="flex-row items-start gap-2">
        <Text weight="semibold" numberOfLines={2} className="flex-1 text-ink-2" style={{ fontSize: 13, lineHeight: 17 }}>
          {label}
        </Text>
        <View className="h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: colors.elevated }}>
          <Icon icon={icon} size={16} rawColor={color.solid} />
        </View>
      </View>
      <View className="gap-0.5">
        <View className="flex-row items-center justify-between gap-2">
          <Text mono weight="bold" maxFontSizeMultiplier={1.2} style={{ fontSize: 30, lineHeight: 34, letterSpacing: -0.5, color: color.solid }}>
            {value === undefined ? '–' : String(value)}
          </Text>
          {/* Tells the tile opens a list; on a selected tab, that it is the list shown. */}
          <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: selected ? color.solid : color.tint }}>
            <Icon icon={selected ? CheckIcon : ChevronRightIcon} size={16} weight="bold" rawColor={selected ? colors.elevated : color.solid} />
          </View>
        </View>
        {hint ? (
          <Text numberOfLines={1} className={hintTone === 'danger' ? 'text-danger' : hintTone === 'warning' ? 'text-warning-text' : 'text-muted'} style={{ fontSize: 12, lineHeight: 16 }}>
            {hint}
          </Text>
        ) : null}
      </View>
    </PressableCard>
  );
}
