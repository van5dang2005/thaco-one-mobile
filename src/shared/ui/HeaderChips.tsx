import { Pressable, ScrollView } from 'react-native';

import { useTheme } from '@/core/theme/ThemeProvider';

import { onBlue, useHeaderColors } from './ScreenShell';
import { Text } from './Text';

export type HeaderChipOption<T extends string> = { value: T; label: string; count?: number; testID?: string };

/** Filter chips on the blue header, scrolling sideways: the selected one is white with primary text, plus a mono count. */
export function HeaderChips<T extends string>({ options, value, onChange, testID }: { options: HeaderChipOption<T>[]; value: T; onChange: (value: T) => void; testID?: string }) {
  const { colors } = useTheme();
  const { fg } = useHeaderColors();
  return (
    <ScrollView testID={testID} horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={option.testID}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.count === undefined ? option.label : `${option.label}, ${option.count}`}
            onPress={() => onChange(option.value)}
            hitSlop={{ top: 6, bottom: 6 }}
            className="h-[34px] flex-row items-center gap-1.5 rounded-full px-3.5 active:opacity-80"
            style={{ backgroundColor: active ? fg : onBlue(0.14) }}
          >
            <Text weight={active ? 'bold' : 'semibold'} numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ fontSize: 13, lineHeight: 17, color: active ? colors.primary : fg }}>
              {option.label}
            </Text>
            {option.count !== undefined ? (
              <Text mono weight="bold" maxFontSizeMultiplier={1.2} style={{ fontSize: 12, lineHeight: 15, color: active ? colors.primary : onBlue(0.75) }}>
                {String(option.count)}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
